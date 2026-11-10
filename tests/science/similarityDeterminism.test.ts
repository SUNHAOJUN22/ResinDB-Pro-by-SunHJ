import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types/index';

interface WorkerScope {
  onmessage?: (event: MessageEvent) => void;
  postMessage(value: unknown): void;
}

function product(id: string, value: number): Product {
  return {
    id,
    gradeName: id.toUpperCase(),
    manufacturerId: 'm',
    manufacturer: 'Determinism fixture',
    categoryIds: ['cat_pp'],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    properties: { F1: { value }, F2: { value } },
  };
}

async function calculate(products: Product[]): Promise<Record<string, unknown>> {
  vi.resetModules();
  const replies: unknown[] = [];
  const scope: WorkerScope = { postMessage: (value) => replies.push(value) };
  vi.stubGlobal('self', scope);
  try {
    await import('@/workers/similarityWorker');
    expect(scope.onmessage).toBeTypeOf('function');
    scope.onmessage!({
      data: {
        type: 'CALCULATE_SIMILARITY',
        payload: {
          products,
          features: ['F1', 'F2'],
          threshold: 0.99,
          maxEdges: 1,
        },
      },
    } as MessageEvent);
  } finally {
    vi.unstubAllGlobals();
  }
  const response = [...replies].reverse().find((value) => (
    value !== null
    && typeof value === 'object'
    && (value as { type?: unknown }).type === 'SIMILARITY_CALCULATED'
  )) as { payload?: Record<string, unknown> } | undefined;
  expect(response?.payload).toBeDefined();
  return response!.payload!;
}

describe('similarity Top-K determinism', () => {
  it('selects the same canonical edge under permutations and equal scores', async () => {
    const a = product('a', 1);
    const b = product('b', 1);
    const c = product('c', 2);
    const d = product('d', 2);
    const first = await calculate([c, d, a, b]);
    const second = await calculate([a, b, c, d]);
    const firstEdges = first.edges as Array<Record<string, unknown>>;
    const secondEdges = second.edges as Array<Record<string, unknown>>;
    expect(firstEdges).toEqual(secondEdges);
    expect(firstEdges).toHaveLength(1);
    expect(firstEdges[0]).toMatchObject({ source: 'a', target: 'b' });
    expect(firstEdges[0].value as number).toBeCloseTo(1, 12);
    expect(first.modelVersion).toBe('zscore-cosine-overlap-canonical-f64-4.1.0');
    expect(first.diagnostics).toMatchObject({
      edgesAboveThreshold: 2,
      edgesReturned: 1,
      edgeObjectsAllocated: 1,
      truncated: true,
    });
  });
});
