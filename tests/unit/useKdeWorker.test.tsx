import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sharedWorkerPool } from '@/compute/workerPool';
import { useKdeWorker } from '@/hooks/workers/useKdeWorker';

class FakeWorker {
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  private requests = 0;

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener) this.listeners.get(type)?.delete(listener);
  }

  postMessage(): void {
    const response = this.requests++ === 0
      ? { type: 'KDE_CALCULATED', payload: { grid: [{ x: 1, y: 1, z: 1 }] } }
      : { type: 'ERROR', error: 'KDE workload exceeds resource budget' };
    queueMicrotask(() => {
      const event = new MessageEvent('message', { data: response });
      for (const listener of [...(this.listeners.get('message') ?? [])]) {
        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
      }
    });
  }

  terminate(): void {}
}

afterEach(() => {
  cleanup();
  sharedWorkerPool.disposeKey('KDE_CALCULATED');
  vi.unstubAllGlobals();
});

describe('useKdeWorker failed-request state', () => {
  it('clears stale output and exposes a failed replacement to the caller', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { result } = renderHook(useKdeWorker);
    const points = [{ x: 1, y: 1 }];

    act(() => result.current.calculateKde(points));
    await waitFor(() => expect(result.current.kdeResult).toEqual({ grid: [{ x: 1, y: 1, z: 1 }] }));

    act(() => result.current.calculateKde(points));
    await waitFor(() => expect(result.current.isCalculating).toBe(false));

    expect(result.current.kdeResult).toBeNull();
    expect(result.current.error).toBe('KDE workload exceeds resource budget');
  });
});
