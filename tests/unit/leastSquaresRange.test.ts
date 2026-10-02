import { describe, expect, it } from 'vitest';
import { solveLeastSquares } from '@/compute/leastSquares';

describe('least-squares floating-point range', () => {
  it.each([1e-250, 1, 1e250])('retains rank under uniform scaling by %s', (scale) => {
    const result = solveLeastSquares(
      [[scale], [2 * scale], [3 * scale]],
      [2 * scale, 4 * scale, 6 * scale],
    );
    expect(result.diagnostics.rank).toBe(1);
    expect(result.solution[0]).toBeCloseTo(2, 12);
    expect(Number.isFinite(result.diagnostics.residualNorm)).toBe(true);
    expect(result.diagnostics.residualNorm / scale).toBeLessThan(1e-12);
  });

  it('retains a finite preconditioner when a column norm exceeds Number.MAX_VALUE', () => {
    const result = solveLeastSquares([[1.5e308], [1.5e308]], [1.5e308, 1.5e308]);
    expect(result.solution[0]).toBeCloseTo(1, 12);
    expect(Number.isFinite(result.diagnostics.residualNorm)).toBe(true);
  });

  it('rejects an unrepresentable coefficient instead of returning Infinity', () => {
    expect(() => solveLeastSquares([[1e-250]], [1e250])).toThrow(RangeError);
  });
});
