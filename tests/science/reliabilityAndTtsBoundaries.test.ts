import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeibullResponse } from '@/workers/weibullWorker';
import type { WlfResponse } from '@/workers/wlfWorker';

afterEach(() => vi.unstubAllGlobals());

async function runWorker<T>(loader: () => Promise<unknown>, payload: unknown): Promise<T> {
  vi.resetModules();
  const replies: unknown[] = [];
  const scope: { onmessage?: (event: MessageEvent) => void; postMessage: (value: unknown) => void } = {
    postMessage: (value) => replies.push(value),
  };
  vi.stubGlobal('self', scope);
  await loader();
  scope.onmessage!({ data: payload } as MessageEvent);
  return replies.at(-1) as T;
}

function weibullSamples(shape: number, scale: number): number[] {
  return Array.from({ length: 5 }, (_, index) => {
    const probability = (index + 1 - 0.3) / 5.4;
    return Math.exp(Math.log(scale) + Math.log(-Math.log1p(-probability)) / shape);
  });
}

function weibull(data: number[]) {
  return runWorker<WeibullResponse>(() => import('@/workers/weibullWorker'), {
    type: 'CALCULATE_WEIBULL', payload: { data },
  });
}

type Curve = { temp: number; points: { rate: number; visc: number }[] };

function curve(temp: number, intercept = 3): Curve {
  return {
    temp,
    points: [-2, -1, 0, 1, 2].map((x) => ({ rate: 10 ** x, visc: 10 ** (intercept - 0.5 * x) })),
  };
}

function wlf(curves: Curve[], refTemp = 20) {
  return runWorker<WlfResponse>(() => import('@/workers/wlfWorker'), {
    type: 'CALCULATE_WLF', payload: { curves, refTemp },
  });
}

function expectFiniteTree(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (Array.isArray(value)) value.forEach(expectFiniteTree);
  else if (value && typeof value === 'object') Object.values(value).forEach(expectFiniteTree);
}

describe('Weibull quantiles across numerical scales', () => {
  it.each([[2, 100], [0.003, 1e200], [5, 1e-250]])(
    'recovers an analytical Weibull population with shape %s and scale %s',
    async (shape, scale) => {
      const data = weibullSamples(shape, scale);
      expect(data.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
      const result = await weibull(data);
      expect(result.type, result.error).toBe('WEIBULL_RESULT');
      expectFiniteTree(result.payload);
      const expectedQuantile = Math.exp(Math.log(scale) + Math.log(-Math.log1p(-0.05)) / shape);
      expect(expectedQuantile).toBeGreaterThan(0);
      expect(result.payload!.m / shape).toBeCloseTo(1, 10);
      expect(result.payload!.eta / scale).toBeCloseTo(1, 10);
      expect(result.payload!.safeValue95 / expectedQuantile).toBeCloseTo(1, 9);
      expect(result.payload!.rSquared).toBeCloseTo(1, 12);
      expect(result.payload!.failureProbabilityForSafeValue).toBe(0.05);
    },
  );

  it('rejects a positive failure quantile that cannot be represented', async () => {
    const data = weibullSamples(0.003, 1e100);
    expect(data.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
    const result = await weibull(data);
    expect(result.type).toBe('ERROR');
    expect(result.error).toMatch(/quantile|represent/i);
  });
});

describe('WLF temperature identity and finite master curves', () => {
  it.each([
    [curve(20), curve(20, 3.25)],
    [curve(20), curve(40, 3.25), curve(40, 2.75)],
  ])('rejects repeated temperature identities before shifting', async (...curves) => {
    const result = await wlf(curves);
    expect(result.type).toBe('ERROR');
    expect(result.error).toMatch(/distinct|duplicate|temperature/i);
  });

  it('keeps the reference curve unchanged when distinct temperatures are reordered', async () => {
    const reference = curve(20);
    const result = await wlf([curve(40, 3.25), reference, curve(60, 2.75)]);
    expect(result.type, result.error).toBe('WLF_RESULT');
    expectFiniteTree(result.payload);
    expect(result.payload!.refTemp).toBe(20);
    expect(result.payload!.shiftFactors.find((factor) => factor.temp === 20)!.aT).toBe(1);
    expect(result.payload!.masterCurve.find((item) => item.temp === 20)!.points).toEqual(
      reference.points.map((point) => ({ ...point, originalRate: point.rate, originalVisc: point.visc })),
    );
    expect(result.payload!.shiftFactors.find((factor) => factor.temp === 40)!.logAT).toBeCloseTo(0.5, 10);
    expect(result.payload!.shiftFactors.find((factor) => factor.temp === 60)!.logAT).toBeCloseTo(-0.5, 10);
  });

  it.each([1e-200, 1e200])('preserves a finite known shift under viscosity scale %s', async (scale) => {
    const curves = [curve(20), curve(40, 3.25)].map((item) => ({
      ...item,
      points: item.points.map((point) => ({ rate: point.rate * 1e100, visc: point.visc * scale })),
    }));
    const result = await wlf(curves);
    expect(result.type, result.error).toBe('WLF_RESULT');
    expectFiniteTree(result.payload);
    expect(result.payload!.shiftFactors[1].logAT).toBeCloseTo(0.5, 10);
    result.payload!.masterCurve.forEach((item) => item.points.forEach((point) => {
      expect(point.rate).toBeGreaterThan(0);
      expect(point.visc).toBeGreaterThan(0);
    }));
  });

  it('rejects a master curve whose shifted viscosity overflows', async () => {
    const reference = { temp: 20, points: [1, 10, 100].map((rate) => ({ rate, visc: 1e308 / Math.sqrt(rate) })) };
    const shifted = { temp: 40, points: reference.points.map((point) => ({ ...point, rate: point.rate * 1e9 })) };
    const result = await wlf([reference, shifted]);
    expect(result.type).toBe('ERROR');
    expect(result.error).toMatch(/master.curve|represent|finite/i);
  });

  it('rejects a master curve whose nonzero shifted shear rate underflows', async () => {
    const reference = { temp: 20, points: [1, 10, 100].map((rate) => ({ rate, visc: 100 / Math.sqrt(rate) })) };
    const shifted = {
      temp: 40,
      points: [
        { rate: Number.MIN_VALUE, visc: 200 },
        ...reference.points.map((point) => ({ ...point, rate: point.rate * 1e9 })),
      ],
    };
    const result = await wlf([reference, shifted]);
    expect(result.type).toBe('ERROR');
    expect(result.error).toMatch(/master.curve|represent|finite/i);
  });
});
