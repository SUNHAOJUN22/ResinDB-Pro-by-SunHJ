import { afterEach, describe, expect, it, vi } from 'vitest';
import { chiSquareUpperTailQuantile, chiSquareUpperTailQuantileWilsonHilferty } from '@/compute/distributions';
import references from '../fixtures/chi-square-isf-reference.json';

interface Reply {
  type: string;
  error?: string;
  payload?: { threshold: number; mean: Record<string, number>; distances: { id: string }[]; diagnostics: Record<string, unknown> };
}
async function analyze(data: unknown[], alpha = 0.05): Promise<Reply> {
  vi.resetModules();
  const replies: Reply[] = [];
  const scope = { onmessage: undefined as ((event: MessageEvent) => void) | undefined, postMessage: (reply: Reply) => replies.push(reply) };
  vi.stubGlobal('self', scope);
  await import('@/workers/mahalanobisWorker');
  scope.onmessage!({ data: { type: 'CALCULATE_MAHALANOBIS', payload: { data, features: ['x', 'y'], alpha } } } as MessageEvent);
  expect(replies).toHaveLength(1);
  return replies[0];
}
afterEach(() => vi.unstubAllGlobals());
const data = [
  { _id: 'a', name: 'A', x: 0, y: 1 },
  { _id: 'b', name: 'B', x: 1, y: 3 },
  { _id: 'c', name: 'C', x: 2, y: 2 },
  { _id: 'd', name: 'D', x: 3, y: 5 },
];

describe('upper-tail numerical contract', () => {
  it.each(references.cases)('matches independent reference df=$df alpha=$alpha', ({ df, alpha, expected }) => {
    const actual = chiSquareUpperTailQuantile(df, alpha);
    expect(Number.isFinite(actual)).toBe(true);
    expect(Math.abs(actual - expected) / expected).toBeLessThan(2e-10);
  });
  it.each([0.05, 1e-20, 1e-100, 1e-300, Number.MIN_VALUE])('has the exact df=2 exponential inverse at alpha=%s', alpha => {
    expect(chiSquareUpperTailQuantile(2, alpha)).toBe(-2 * Math.log(alpha));
  });
  it('keeps the explicitly approximate compatibility function finite without 1-alpha cancellation', () => {
    expect(chiSquareUpperTailQuantileWilsonHilferty(2, 1e-20)).toBeGreaterThan(0);
    expect(chiSquareUpperTailQuantileWilsonHilferty(2, 0.05)).toBeCloseTo(5.9369, 3);
  });
  it.each([0, -1, Infinity, NaN, 0.5, 1])('rejects invalid alpha=%s', alpha => {
    expect(() => chiSquareUpperTailQuantile(2, alpha)).toThrow(RangeError);
  });
  it.each([0, -1, 1.5, Infinity, NaN, 1000001])('rejects unsupported degrees of freedom=%s', df => {
    expect(() => chiSquareUpperTailQuantile(df, 0.05)).toThrow(RangeError);
  });
  it('is monotonic in the upper-tail probability', () => {
    const values = [0.49, 0.05, 1e-12, 1e-50, 1e-300].map(alpha => chiSquareUpperTailQuantile(10, alpha));
    values.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(values[index]));
  });
});

describe('direct Worker message boundary', () => {
  it.each([null, '', '1', false, true, undefined, NaN, Infinity, -Infinity, [], {}])('excludes non-observations without coercion: %s', async value => {
    const result = await analyze([...data, { _id: 'bad', name: 'invalid', x: value, y: 3 }]);
    expect(result.type).toBe('MAHALANOBIS_RESULT');
    expect(result.payload?.diagnostics).toMatchObject({ observations: 4, suppliedObservations: 5, excludedObservations: 1 });
    expect(result.payload?.mean.x).toBe(1.5);
    expect(result.payload?.distances.map(row => row.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('retains a real zero observation', async () => {
    const result = await analyze(data);
    expect(result.payload?.diagnostics).toMatchObject({ observations: 4, excludedObservations: 0 });
    expect(result.payload?.distances[0].id).toBe('a');
  });
  it('uses a finite tail-stable threshold in the actual Worker', async () => {
    const result = await analyze(data, 1e-20);
    expect(result.type).toBe('MAHALANOBIS_RESULT');
    expect(result.payload?.threshold).toBe(-2 * Math.log(1e-20));
    expect(result.payload?.diagnostics).toMatchObject({ thresholdApproximation: 'numerical-inverse-gamma', screeningOnly: true });
  });
  it('fails closed if filtering leaves n <= p', async () => {
    const result = await analyze([data[0], data[1], { _id: 'bad', name: 'bad', x: null, y: 3 }]);
    expect(result.type).toBe('ERROR');
  });
});
