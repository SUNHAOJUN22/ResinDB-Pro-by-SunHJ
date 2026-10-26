import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRowMajorFloat64Matrix } from '@/compute/numericBuffers';
import type { RSMResponse } from '@/workers/rsmWorker';

afterEach(() => vi.unstubAllGlobals());

describe('rank-deficient RSM original-coordinate reference fit', () => {
  it('propagates lossy RHS normalization as a worker error without a fitted surface', async () => {
    vi.resetModules();
    const replies: RSMResponse[] = [];
    const scope: { onmessage?: (event: MessageEvent) => void; postMessage(value: RSMResponse): void } = {
      postMessage: (value) => replies.push(value),
    };
    vi.stubGlobal('self', scope);
    await import('@/workers/rsmWorker');
    const data = [-1, 0, 1].flatMap((x1) => [-1, 0, 1].map((x2) => ({
      x1, x2, y: x1 === -1 && x2 === -1 ? 1e200 : 1e-200,
    })));
    scope.onmessage!({ data: { type: 'CALCULATE_RSM', payload: { data, gridSize: 3 } } } as MessageEvent);
    expect(replies).toHaveLength(1);
    expect(replies[0].type).toBe('ERROR');
    expect(replies[0].error).toMatch(/target normalization would discard a nonzero observation/);
    expect(replies[0].payload).toBeUndefined();
  });

  it.each(['object', 'float64'] as const)('uses the analytic minimum-norm coefficients and surface with %s input', async (transport) => {
    vi.resetModules();
    const replies: RSMResponse[] = [];
    const scope: { onmessage?: (event: MessageEvent) => void; postMessage(value: RSMResponse): void } = {
      postMessage: (value) => replies.push(value),
    };
    vi.stubGlobal('self', scope);
    await import('@/workers/rsmWorker');
    const data = [-2, -1, 0, 1, 2, 3].map((x1) => ({ x1, x2: 2 * x1, y: 3 + 4 * x1 }));
    const payload = transport === 'object'
      ? { data, gridSize: 3 }
      : {
          matrix: createRowMajorFloat64Matrix(data.length, 3, (row, column) => (
            [data[row].x1, data[row].x2, data[row].y][column]
          )),
          gridSize: 3,
        };
    scope.onmessage!({ data: { type: 'CALCULATE_RSM', payload } } as MessageEvent);
    expect(replies).toHaveLength(1);
    expect(replies[0].type).toBe('RSM_CALCULATED');
    const result = replies[0].payload!;
    // Constraints: b0=3, b1+2*b2=4, b11+4*b22+2*b12=0.
    // Their independent Euclidean minimizers are [3], [.8,1.6], [0,0,0].
    [3, 0.8, 1.6, 0, 0, 0].forEach((value, index) => {
      expect(result.beta[index]).toBeCloseTo(value, 11);
    });
    expect(result.diagnostics.rank).toBe(3);
    expect(result.diagnostics.residualNorm).toBeLessThan(1e-10);
    expect(result.diagnostics.conditionNumberStatus).toBe('infinite');
    expect(result.stationaryPoint).toBeNull();
    for (const row of result.grid) {
      for (const point of row) {
        expect(point.y).toBeCloseTo(3 + 0.8 * point.x1 + 1.6 * point.x2, 10);
      }
    }
    // This checks the deterministic reference surface, not scientific validation
    // of predictions away from the observed one-dimensional design subspace.
    expect(result.beta[0] + result.beta[1]).toBeCloseTo(3.8, 11);
    expect(result.modelVersion).toBe('quadratic-rsm-qr-svd-f64-2.1.0');
  });
});
