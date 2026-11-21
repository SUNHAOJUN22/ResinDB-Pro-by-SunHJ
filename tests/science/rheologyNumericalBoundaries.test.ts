import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KineticsResponse } from '@/workers/kineticsWorker';
import type { PronyResponse } from '@/workers/pronyWorker';

const observations = [
  { omega: 0.1, storage: 100, loss: 20 },
  { omega: 1, storage: 150, loss: 35 },
  { omega: 10, storage: 220, loss: 50 },
  { omega: 100, storage: 300, loss: 45 },
];
const peaks = [{ beta: 5, tp: 120 }, { beta: 10, tp: 130 }, { beta: 20, tp: 141 }, { beta: 30, tp: 148 }];

afterEach(() => vi.unstubAllGlobals());

async function runWorker<T>(loader: () => Promise<unknown>, message: unknown): Promise<T> {
  vi.resetModules();
  const replies: unknown[] = [];
  const scope: { onmessage?: (event: MessageEvent) => void; postMessage: (value: unknown) => void } = {
    postMessage: (value) => replies.push(value),
  };
  vi.stubGlobal('self', scope);
  await loader();
  scope.onmessage!({ data: message } as MessageEvent);
  return replies.at(-1) as T;
}

function finiteTree(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (Array.isArray(value)) value.forEach(finiteTree);
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
}

async function fit(data = observations, numTerms = 2) {
  return runWorker<PronyResponse>(() => import('@/workers/pronyWorker'), {
    type: 'RUN_PRONY', payload: { data, numTerms },
  });
}

function fitted(response: PronyResponse) {
  expect(response.type, response.error).toBe('PRONY_RESULT');
  finiteTree(response.payload);
  return response.payload!;
}

async function kinetics(isoTemp: number) {
  return runWorker<KineticsResponse>(() => import('@/workers/kineticsWorker'), {
    type: 'RUN_KINETICS', payload: { data: peaks, isoTemp },
  });
}

describe('rheological numerical invariants', () => {
  it.each([1e-12, 1e-200, 1e200, 1e305])('preserves Prony modes and fit under modulus scale %s', async (scale) => {
    const reference = fitted(await fit());
    const transformed = fitted(await fit(observations.map((point) => ({
      ...point, storage: point.storage * scale, loss: point.loss * scale,
    }))));
    expect(transformed.optimization.converged).toBe(true);
    expect(transformed.terms).toHaveLength(reference.terms.length);
    expect(transformed.E_inf / scale).toBeCloseTo(reference.E_inf, 8);
    expect(transformed.E_sum / scale).toBeCloseTo(reference.E_sum, 8);
    expect(transformed.error_metric / scale).toBeCloseTo(reference.error_metric, 8);
    transformed.terms.forEach((term, index) => {
      expect(term.tau).toBe(reference.terms[index].tau);
      expect(term.E / scale).toBeCloseTo(reference.terms[index].E, 8);
    });
    transformed.points.forEach((point, index) => {
      expect(point.storage_fit / scale).toBeCloseTo(reference.points[index].storage_fit, 8);
      expect(point.loss_fit / scale).toBeCloseTo(reference.points[index].loss_fit, 8);
    });
    expect(transformed.abaqusCard).toBe(reference.abaqusCard);
  });

  it.each([1e-200, 1e200])('preserves a single Maxwell mode under frequency scale %s', async (scale) => {
    const reference = fitted(await fit(observations, 1));
    const transformed = fitted(await fit(observations.map((point) => ({ ...point, omega: point.omega * scale })), 1));
    expect(transformed.terms).toHaveLength(1);
    expect(transformed.terms[0].tau * scale).toBeCloseTo(reference.terms[0].tau, 12);
    expect(transformed.terms[0].E).toBeCloseTo(reference.terms[0].E, 8);
    expect(transformed.E_inf).toBeCloseTo(reference.E_inf, 8);
    expect(transformed.error_metric).toBeCloseTo(reference.error_metric, 8);
  });

  it('keeps zero-modulus input finite without inventing relaxation modes', async () => {
    const result = fitted(await fit(observations.map((point) => ({ ...point, storage: 0, loss: 0 }))));
    expect(result.E_inf).toBe(0);
    expect(result.E_sum).toBe(0);
    expect(result.terms).toEqual([]);
    expect(result.error_metric).toBe(0);
  });

  it('fits a finite two-mode reference when the raw Maxwell product squared overflows', async () => {
    const data = [
      { omega: 1e-80, storage: 1.5, loss: 0.5 },
      { omega: 1, storage: 2, loss: 2e-80 },
      { omega: 1e80, storage: 2.5, loss: 0.5 },
    ];
    const result = fitted(await fit(data));
    expect(result.terms).toHaveLength(2);
    expect(result.E_inf).toBeCloseTo(1, 2);
    result.terms.forEach((term) => expect(term.E).toBeCloseTo(1, 2));
    result.points.forEach((point, index) => {
      expect(point.storage_fit).toBeCloseTo(data[index].storage, 2);
      expect(point.loss_fit).toBeCloseTo(data[index].loss, 2);
    });
  });

  it('rejects unrepresentable nonzero modulus normalization', async () => {
    const result = await fit(observations.map((point) => ({ ...point, storage: 1e308, loss: 1e-300 })));
    expect(result.type).toBe('ERROR');
    expect(result.error).toMatch(/normaliz|represent/i);
  });

  it('keeps representable relaxation-time endpoints out of logspace rounding overflow', async () => {
    const minimumOmega = 5.56268464626801e-309;
    const reference = fitted(await fit(observations));
    const scale = minimumOmega / observations[0].omega;
    const result = fitted(await fit(observations.map((point) => ({ ...point, omega: point.omega * scale }))));
    expect(result.terms.at(-1)!.tau).toBe(1 / minimumOmega);
    expect(result.E_sum).toBeCloseTo(reference.E_sum, 7);
  });

  it('builds finite slow-kinetics times when the end time is representable', async () => {
    const baseline = await kinetics(100);
    expect(baseline.type).toBe('KINETICS_RESULT');
    const { E, A } = baseline.payload!;
    const isoTemp = -(E * 1000) / (8.31446261815324 * (Math.log(1e-306) - Math.log(A))) - 273.15;
    const result = await kinetics(isoTemp);
    expect(result.type, result.error).toBe('KINETICS_RESULT');
    finiteTree(result.payload);
    const curve = result.payload!.isoCurve;
    const end = curve.at(-1)!;
    expect(end.time).toBeGreaterThan(1e306);
    expect(end.alpha).toBeCloseTo(99, 12);
    expect(curve[0]).toEqual({ time: 0, alpha: 0 });
    curve.forEach((point, index) => expect(point.time / end.time).toBeCloseTo(index / 100, 14));
  });

  it('rejects kinetics whose 99-percent time cannot be represented', async () => {
    const baseline = await kinetics(100);
    const { E, A } = baseline.payload!;
    const isoTemp = -(E * 1000) / (8.31446261815324 * (Math.log(1e-308) - Math.log(A))) - 273.15;
    const result = await kinetics(isoTemp);
    expect(result.type).toBe('ERROR');
    expect(result.error).toMatch(/time.*represent|finite.*time/i);
  });
});
