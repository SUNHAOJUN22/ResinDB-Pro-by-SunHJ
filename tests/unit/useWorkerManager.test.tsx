import { useParetoWorker } from '@/hooks/workers/useParetoWorker';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sharedWorkerPool } from '@/compute/workerPool';
import { useWorkerManager } from '@/hooks/workers/useWorkerManager';

class HookWorker {
  readonly posts: { message: unknown; transfer: Transferable[] }[] = [];
  terminated = false;
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.posts.push({ message, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    const event = new MessageEvent('message', { data });
    for (const listener of [...(this.listeners.get('message') ?? [])]) {
      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    }
  }
}

afterEach(() => {
  cleanup();
  sharedWorkerPool.disposeKey('hook-manager-test');
  sharedWorkerPool.disposeKey('PARETO_RESULT');
  vi.unstubAllGlobals();
});

describe('useWorkerManager', () => {
  it('stays lazy until the first task and exposes progress, result, task metadata, and transferables', async () => {
    const workers: HookWorker[] = [];
    const onSuccess = vi.fn();
    const factory = () => {
      const worker = new HookWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    };
    const { result, unmount } = renderHook(() => useWorkerManager<
      { type: 'RUN'; values: Float64Array },
      { sum: number }
    >(factory, 'DONE', { poolKey: 'hook-manager-test', onSuccess }));

    expect(workers).toHaveLength(0);
    const values = new Float64Array([1, 2, 3]);
    let taskId = '';
    act(() => {
      taskId = result.current.postMessage(
        { type: 'RUN', values },
        { transfer: [values.buffer], priority: 'interactive' },
      );
    });

    expect(taskId).not.toBe('');
    expect(workers).toHaveLength(1);
    expect(result.current.isCalculating).toBe(true);
    expect(result.current.activeTaskId).toBe(taskId);
    expect(workers[0].posts[0].transfer).toEqual([values.buffer]);

    act(() => {
      workers[0].emit({ type: 'PROGRESS', payload: { ratio: 0.4, phase: 'running' } });
    });
    expect(result.current.progress).toEqual({ ratio: 0.4, phase: 'running' });

    act(() => {
      workers[0].emit({ type: 'DONE', payload: { sum: 6 } });
    });
    await waitFor(() => expect(result.current.isCalculating).toBe(false));
    expect(result.current.result).toEqual({ sum: 6 });
    expect(result.current.progress).toEqual({ ratio: 1 });
    expect(result.current.activeTaskId).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith({ sum: 6 });

    unmount();
  });

  it('cancels superseded work without surfacing a user-facing error', async () => {
    const workers: HookWorker[] = [];
    const factory = () => {
      const worker = new HookWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    };
    const { result } = renderHook(() => useWorkerManager<{ id: number }, { id: number }>(
      factory,
      'DONE',
      { poolKey: 'hook-manager-test' },
    ));

    act(() => {
      result.current.postMessage({ id: 1 });
      result.current.postMessage({ id: 2 });
    });

    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    act(() => workers[1].emit({ type: 'DONE', payload: { id: 2 } }));
    await waitFor(() => expect(result.current.result).toEqual({ id: 2 }));
    expect(result.current.error).toBeNull();
  });
});


describe('cancelled or changed cohorts cannot revive stale results', () => {
  it('invalidates an already resolved promise before its queued success callback', async () => {
    const worker = new HookWorker();
    const onSuccess = vi.fn();
    const factory = () => worker as unknown as Worker;
    const { result } = renderHook(() => useWorkerManager<{ id: number }, { id: number }>(factory, 'DONE', { poolKey: 'hook-manager-test', onSuccess }));
    await act(async () => {
      result.current.postMessage({ id: 1 });
      worker.emit({ type: 'DONE', payload: { id: 1 } });
      result.current.cancel();
      result.current.setResult(null);
      await Promise.resolve();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.isCalculating).toBe(false);
    expect(result.current.activeTaskId).toBeNull();
    expect(result.current.workerRef.current).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
  it('cancels Pareto work when data is cleared', async () => {
    const workers: HookWorker[] = [];
    vi.stubGlobal('Worker', class extends HookWorker { constructor() { super(); workers.push(this); } });
    const { result } = renderHook(useParetoWorker);
    act(() => { result.current.computePareto([{ id: 'old', values: { x: 1 } }], [{ key: 'x', minimize: true }]); });
    await act(async () => {
      result.current.computePareto([], []);
      workers[0].emit({ type: 'PARETO_RESULT', payload: { paretoIds: ['old'] } });
      await Promise.resolve();
    });
    expect(workers[0].terminated).toBe(true);
    expect(result.current.paretoFrontIds.size).toBe(0);
    expect(result.current.isComputingPareto).toBe(false);
  });
  it('clears an old frontier immediately when a new cohort starts', async () => {
    const workers: HookWorker[] = [];
    vi.stubGlobal('Worker', class extends HookWorker { constructor() { super(); workers.push(this); } });
    const { result } = renderHook(useParetoWorker);
    act(() => { result.current.computePareto([{ id: 'old', values: { x: 1 } }], [{ key: 'x', minimize: true }]); });
    await act(async () => { workers[0].emit({ type: 'PARETO_RESULT', payload: { paretoIds: ['old'] } }); await Promise.resolve(); });
    expect([...result.current.paretoFrontIds]).toEqual(['old']);
    act(() => { result.current.computePareto([{ id: 'new', values: { x: 2 } }], [{ key: 'x', minimize: true }]); });
    expect(result.current.paretoFrontIds.size).toBe(0);
    await act(async () => { workers.at(-1)!.emit({ type: 'PARETO_RESULT', payload: { paretoIds: ['new'] } }); await Promise.resolve(); });
    expect([...result.current.paretoFrontIds]).toEqual(['new']);
  });
});
