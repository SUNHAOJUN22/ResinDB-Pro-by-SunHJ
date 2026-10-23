import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopulaWorker } from '@/hooks/workers/useCopulaWorker';
import { empiricalCdf, gaussianCopulaCdf } from '@/compute/gaussianCopula';

const state = vi.hoisted(() => ({ result: {
  rho: 0,
  sortedX: [1, 2, 3, 4], sortedY: [1, 2, 3, 4],
  grid: [] as { u: number; v: number; z: number }[],
} }));
vi.mock('@/hooks/workers/useWorkerManager', () => ({
  useWorkerManager: () => ({ result: state.result, isCalculating: false, error: null, postMessage: vi.fn() }),
}));

beforeEach(() => {
  state.result = {
    rho: 0, sortedX: [1, 2, 3, 4], sortedY: [1, 2, 3, 4],
    grid: Array.from({ length: 49 }, (_, x) => Array.from({ length: 49 }, (_, y) => ({ u: (x + 1) / 50, v: (y + 1) / 50, z: 1 }))).flat(),
  };
});

describe('Gaussian-copula probability through the production hook', () => {
  it('includes all observed thresholds and returns one at both upper boundaries', () => {
    const { result } = renderHook(() => useCopulaWorker());
    expect(result.current.getJointFailureProb(4, 4)).toBe(1);
    expect(result.current.getJointFailureProb(100, 100)).toBe(1);
  });
  it('honors the exact one-dimensional margins', () => {
    const { result } = renderHook(() => useCopulaWorker());
    expect(result.current.getJointFailureProb(2, 100)).toBe(0.5);
    expect(result.current.getJointFailureProb(100, 3)).toBe(0.75);
    expect(result.current.getJointFailureProb(0, 3)).toBe(0);
  });
  it('computes the fitted probability independently of display-grid resolution', () => {
    state.result.grid = [{ u: 0.25, v: 0.25, z: 1 }];
    const { result } = renderHook(() => useCopulaWorker());
    expect(result.current.getJointFailureProb(2, 3)).toBe(0.375);
  });
  it('does not turn non-finite input into a probability', () => {
    const { result } = renderHook(() => useCopulaWorker());
    expect(result.current.getJointFailureProb(NaN, 3)).toBeNull();
    expect(result.current.getJointFailureProb(2, Infinity)).toBeNull();
  });
});

describe('Gaussian-copula numerical identities and independent reference values', () => {
  it('uses an inclusive empirical threshold consistently for ties and out-of-range values', () => {
    const sample = [1, 2, 2, 4];
    expect(empiricalCdf(sample, 0)).toBe(0);
    expect(empiricalCdf(sample, 2)).toBe(0.75);
    expect(empiricalCdf(sample, 4)).toBe(1);
    expect(empiricalCdf(sample, 100)).toBe(1);
    expect(() => empiricalCdf([], 0)).toThrow();
    expect(() => empiricalCdf(sample, NaN)).toThrow();
  });
  it.each([-0.999, -0.8, -0.2, 0, 0.2, 0.8, 0.999])('matches the analytic median quadrant for rho=%s', (rho) => {
    expect(gaussianCopulaCdf(0.5, 0.5, rho)).toBeCloseTo(0.25 + Math.asin(rho) / (2 * Math.PI), 12);
  });
  // Independently obtained with SciPy 1.17 integrate.quad of
  // integral[-infinity, Phi^-1(u)] phi(x) Phi((Phi^-1(v)-rho*x)/sqrt(1-rho²)) dx.
  // epsabs=epsrel=1e-12, limit=250; this is not the production angle integral.
  it.each([
    [0.1, 0.2, 0.7, 0.06899908105091679],
    [0.8, 0.3, -0.6, 0.17140116927744825],
    [0.001, 0.99, -0.95, 0.000007821934237957306],
    [0.01, 0.02, 0.95, 0.008801634325546176],
    [0.2, 0.201, 0.999, 0.19548161645178083],
    [0.9, 0.1, -0.999, 0.0031309403701035242],
    [0.999, 0.999, 0.5, 0.9980542591681946],
    [0.03, 0.7, 0.99, 0.03],
  ])('matches conditional-normal quadrature at (%s, %s, %s)', (u, v, rho, expected) => {
    expect(gaussianCopulaCdf(u, v, rho)).toBeCloseTo(expected, 8);
  });
  it('honors symmetry, reflection, independence and the singular limits', () => {
    for (const rho of [-1, -0.999, -0.6, 0, 0.6, 0.999, 1]) {
      expect(gaussianCopulaCdf(0.2, 0.8, rho)).toBeCloseTo(gaussianCopulaCdf(0.8, 0.2, rho), 10);
      expect(gaussianCopulaCdf(0.2, 0.8, -rho)).toBeCloseTo(0.2 - gaussianCopulaCdf(0.2, 0.2, rho), 8);
      expect(gaussianCopulaCdf(0, 0.8, rho)).toBe(0);
      expect(gaussianCopulaCdf(1, 0.8, rho)).toBe(0.8);
      expect(gaussianCopulaCdf(0.2, 1, rho)).toBe(0.2);
    }
    expect(gaussianCopulaCdf(0.2, 0.8, 0)).toBe(0.2 * 0.8);
    expect(gaussianCopulaCdf(0.2, 0.8, 1)).toBe(0.2);
    expect(gaussianCopulaCdf(0.8, 0.8, -1)).toBeCloseTo(0.6, 12);
  });
  it.each([[NaN, 0.5, 0], [0.5, Infinity, 0], [-0.1, 0.5, 0], [0.5, 1.1, 0], [0.5, 0.5, 1.01]])('rejects invalid parameters (%s, %s, %s)', (u, v, rho) => {
    expect(() => gaussianCopulaCdf(u, v, rho)).toThrow(RangeError);
  });
});
