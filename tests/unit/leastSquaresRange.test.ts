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

  it.each([
    { columns: 2, sign: 1 }, { columns: 2, sign: -1 },
    { columns: 3, sign: 1 }, { columns: 3, sign: -1 },
  ])('rejects RHS normalization that would silently erase a nonzero target ($columns columns, sign $sign)', ({ columns, sign }) => {
    const design = columns === 2
      ? [[1e200, 0], [0, 1e-200]]
      : [[1e200, 0, 0], [0, 1e-200, 0]];
    // The exact independent constraints require x0=1, x1=sign. A tiny absolute
    // residual cannot justify returning x1=0 after losing the second target.
    expect(() => solveLeastSquares(design, [1e200, sign * 1e-200]))
      .toThrow(/target normalization would discard a nonzero observation/);
  });

  it.each([2, 3])('retains a representable RHS ratio with %s columns', (columns) => {
    const design = columns === 2
      ? [[1e150, 0], [0, 1e-150]]
      : [[1e150, 0, 0], [0, 1e-150, 0]];
    const result = solveLeastSquares(design, [1e150, 1e-150]);
    expect(result.solution[0]).toBeCloseTo(1, 12);
    expect(result.solution[1]).toBeCloseTo(1, 12);
    if (columns === 3) expect(result.solution[2]).toBe(0);
    expect(result.diagnostics.rank).toBe(2);
  });

  it('retains genuine zero RHS observations and an entirely zero RHS', () => {
    const design = [[1e200, 0, 0], [0, 1e-200, 0]];
    expect(solveLeastSquares(design, [1e200, 0]).solution).toEqual([1, 0, 0]);
    expect(solveLeastSquares(design, [0, -0]).solution).toEqual([0, 0, 0]);
  });
});
