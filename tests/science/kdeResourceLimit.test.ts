import { describe, expect, it, vi } from 'vitest';

interface WorkerScope {
  onmessage?: (event: MessageEvent) => void;
  postMessage(value: unknown): void;
}

describe('bivariate KDE resource budget regression', () => {
  it('rejects a workload above the operation budget before allocating the grid', async () => {
    vi.resetModules();
    const replies: unknown[] = [];
    const scope: WorkerScope = { postMessage: (value) => replies.push(value) };
    vi.stubGlobal('self', scope);
    await import('@/workers/kdeWorker');

    const points = Array.from({ length: 20_001 }, (_, index) => ({
      x: index % 101,
      y: Math.floor(index / 101) % 97,
    }));
    scope.onmessage!({
      data: { type: 'CALCULATE_KDE', payload: { points, gridSize: 50 } },
    } as MessageEvent);
    vi.unstubAllGlobals();

    expect(replies.at(-1)).toMatchObject({
      type: 'ERROR',
      error: expect.stringContaining('50000000 grid-kernel operation budget'),
    });
  });
});
