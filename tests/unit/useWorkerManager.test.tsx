import { useParetoWorker } from '@/hooks/workers/useParetoWorker';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sharedWorkerPool } from '@/compute/workerPool';
import { useWorkerManager } from '@/hooks/workers/useWorkerManager';
import { useKMeansWorker } from '@/hooks/workers/useKMeansWorker';
import { kmeansBackendProfileStore } from '@/compute/kmeansBackendProfileStore';
import { clearKMeansWorkloadSnapshot, getKMeansWorkloadSnapshot } from '@/compute/kmeansWorkloadStore';
import type { KMeansResponse } from '@/workers/kmeansWorker';

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
  sharedWorkerPool.disposeKey('KMEANS_RESULT');
  clearKMeansWorkloadSnapshot();
  vi.restoreAllMocks();
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

describe('K-Means replacement while a backend profile is loading', () => {
  const missingProfile = {
    status: 'missing' as const,
    profile: null,
    environment: null,
    reason: null,
    savedAt: null,
    migration: null,
    migrationHistory: [],
  };

  function response(id: string): Extract<KMeansResponse, { type: 'KMEANS_RESULT' }> {
    return {
      type: 'KMEANS_RESULT',
      payload: {
        clusters: { [id]: 0 },
        k: 1,
        centroids: [[0]],
        silhouetteScore: null,
        reproducibility: {
          seed: 'handoff-test',
          seedSource: 'user',
          randomAlgorithm: 'xoshiro128**',
          randomAlgorithmVersion: '1.0.0',
          modelVersion: 'kmeans-plus-plus-adaptive-silhouette-f64-wasm-4.0.1',
        },
        modelSelection: {
          method: 'full-silhouette',
          evaluatedSamples: 1,
          totalSamples: 1,
          candidateCount: 0,
          missingValuesImputed: 0,
        },
        performance: {
          inputTransport: 'row-major-f64-transferable',
          numericInputBytes: 8,
          matrixStorage: 'row-major-float64',
          assignmentStorage: 'int32',
          lloydIterations: 1,
          distanceEvaluations: 1,
          assignmentKernel: null,
        },
      },
    };
  }

  function setup() {
    const workers: HookWorker[] = [];
    vi.stubGlobal('Worker', class extends HookWorker {
      constructor() {
        super();
        workers.push(this);
      }
    });
    const load = vi.spyOn(kmeansBackendProfileStore, 'load').mockResolvedValue(missingProfile);
    const hook = renderHook(useKMeansWorker);
    return { ...hook, workers, load };
  }

  function pendingProfile() {
    let resolve!: (value: typeof missingProfile) => void;
    const promise = new Promise<typeof missingProfile>((done) => { resolve = done; });
    return { promise, resolve };
  }

  it('invalidates active old work before awaiting the replacement profile and accepts the new result', async () => {
    const { result, workers, load } = setup();
    await act(async () => {
      await result.current.computeKMeans([{ id: 'old', values: { x: 1 } }], ['x']);
    });
    const profile = pendingProfile();
    load.mockReturnValueOnce(profile.promise);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.computeKMeans([{ id: 'new', values: { x: 2 } }], ['x']);
    });
    await act(async () => {
      workers[0].emit(response('old'));
      await Promise.resolve();
    });

    expect(result.current.clusters).toEqual({});
    expect(workers[0].terminated).toBe(true);
    expect(getKMeansWorkloadSnapshot()).toBeNull();
    await act(async () => {
      profile.resolve(missingProfile);
      await pending;
    });
    expect(workers).toHaveLength(2);
    await act(async () => {
      workers[1].emit(response('new'));
      await Promise.resolve();
    });
    expect(result.current.clusters).toEqual({ new: 0 });
    expect(result.current.isComputingKMeans).toBe(false);
  });

  it('clears completed results and workload as soon as a new nonempty cohort is requested', async () => {
    const { result, workers, load } = setup();
    await act(async () => {
      await result.current.computeKMeans([{ id: 'old', values: { x: 1 } }], ['x']);
      workers[0].emit(response('old'));
      await Promise.resolve();
    });
    expect(result.current.clusters).toEqual({ old: 0 });
    expect(getKMeansWorkloadSnapshot()).not.toBeNull();
    const profile = pendingProfile();
    load.mockReturnValueOnce(profile.promise);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.computeKMeans([{ id: 'new', values: { x: 2 } }], ['x']);
    });

    expect(result.current.clusters).toEqual({});
    expect(result.current.bestK).toBe(0);
    expect(result.current.performance).toBeNull();
    expect(result.current.reproducibility).toBeNull();
    expect(getKMeansWorkloadSnapshot()).toBeNull();
    await act(async () => {
      profile.resolve(missingProfile);
      await pending;
    });
  });

  it('invalidates an old success already queued for delivery before the replacement profile resolves', async () => {
    const { result, workers, load } = setup();
    await act(async () => {
      await result.current.computeKMeans([{ id: 'old', values: { x: 1 } }], ['x']);
    });
    const profile = pendingProfile();
    load.mockReturnValueOnce(profile.promise);
    let pending!: Promise<void>;
    await act(async () => {
      workers[0].emit(response('old'));
      pending = result.current.computeKMeans([{ id: 'new', values: { x: 2 } }], ['x']);
      await Promise.resolve();
    });

    expect(result.current.clusters).toEqual({});
    expect(result.current.performance).toBeNull();
    await act(async () => {
      profile.resolve(missingProfile);
      await pending;
    });
  });
});
