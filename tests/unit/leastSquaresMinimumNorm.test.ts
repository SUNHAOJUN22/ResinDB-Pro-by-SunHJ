import { describe, expect, it } from 'vitest';
import { solveLeastSquares } from '@/compute/leastSquares';

function expectVector(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    if (value === 0) expect(Math.abs(actual[index])).toBeLessThan(1e-12);
    else expect(actual[index] / value).toBeCloseTo(1, 11);
  });
}

describe('least-squares minimum norm in the original coefficient coordinates', () => {
  it.each([1e-250, 1, 1e250])('retains the analytic rank-one solution under common scaling by %s', (scale) => {
    // A = u v^T, b = u, v = [1, 2, 0]: x = v / (v^T v).
    const result = solveLeastSquares(
      [[scale, 2 * scale, 0], [2 * scale, 4 * scale, 0], [-scale, -2 * scale, 0]],
      [scale, 2 * scale, -scale],
    );
    expectVector(result.solution, [1 / 5, 2 / 5, 0]);
    expect(result.diagnostics.rank).toBe(1);
    expect(result.diagnostics.solver).toBe('svd-jacobi-pseudoinverse');
    expect(result.diagnostics.residualNorm / scale).toBeLessThan(1e-12);
    // The original-coordinate null vector [2, -1, 0] must be orthogonal to x.
    expect(Math.abs(2 * result.solution[0] - result.solution[1])).toBeLessThan(1e-12);
  });

  it('minimizes residual first, then coefficient norm for an inconsistent rank-one system', () => {
    // u=[1,2], v=[1,2], b=[1,0]: u^T b/(u^T u)=1/5.
    const result = solveLeastSquares([[1, 2], [2, 4]], [1, 0]);
    expectVector(result.solution, [1 / 25, 2 / 25]);
    expect(result.diagnostics.residualNorm).toBeCloseTo(Math.sqrt(4 / 5), 12);
  });

  it.each([
    [1, 2],
    [10, 0.2],
    [-3, 4],
  ])('uses the original metric after changing the two column scales to %s and %s', (a, b) => {
    const result = solveLeastSquares([[a, b], [2 * a, 2 * b]], [1, 2]);
    expectVector(result.solution, [a / (a * a + b * b), b / (a * a + b * b)]);
  });

  it.each([{ order: [0, 1, 2, 3] }, { order: [3, 2, 0, 1] }])('preserves a rank-two underdetermined solution under column order $order', ({ order }) => {
    // The independent constraints are x0+2*x1=1 and 3*x2=3; x3 is free.
    const design = [[1, 2, 0, 0], [0, 0, 3, 0]];
    const reference = [1 / 5, 2 / 5, 1, 0];
    const result = solveLeastSquares(design.map((row) => order.map((column) => row[column])), [1, 3]);
    expectVector(result.solution, order.map((column) => reference[column]));
    expect(result.diagnostics.rank).toBe(2);
    expect(result.diagnostics.residualNorm).toBeLessThan(1e-12);
  });

  it('preserves independently scaled resolved constraints without globally discarding a row', () => {
    const result = solveLeastSquares([[1e-100, 2e-100, 0], [0, 0, 1e100]], [1, 1]);
    expectVector(result.solution, [2e99, 4e99, 1e-100]);
    expect(result.diagnostics.rank).toBe(2);
    expect(result.diagnostics.residualNorm).toBeLessThan(1e-12);
  });

  it('constructs the minimum-norm direction directly instead of subtracting enormous null-space components', () => {
    const result = solveLeastSquares([[1, 1e200]], [1e200]);
    // (1, 10^200)/(1+10^400) * 10^200 rounds to (10^-200, 1).
    expectVector(result.solution, [1e-200, 1]);
    expect(result.diagnostics.rank).toBe(1);
  });

  it('converges when Jacobi rotations resolve very small residual columns in an ordinary rank-one design', () => {
    const u = [1, 3, -1];
    const v = [0.01, -0.1, 4, -40, 0];
    const result = solveLeastSquares(u.map((factor) => v.map((value) => factor * value)), [0, 4, 3]);
    // u^T b=9, u^T u=11, v^T v=1616.0101, ||b||^2=25.
    expectVector(result.solution, v.map((value) => (9 / 11) * value / 1616.0101));
    expect(result.diagnostics.rank).toBe(1);
    expect(result.diagnostics.residualNorm).toBeCloseTo(Math.sqrt(25 - 81 / 11), 12);
  });

  it('keeps the unique full-column-rank SVD solution when the condition policy selects it', () => {
    const result = solveLeastSquares([[1, 0], [0, 2], [1, 1]], [3, -2, 2], { conditionLimit: 1.1 });
    expectVector(result.solution, [3, -1]);
    expect(result.diagnostics.solver).toBe('svd-jacobi-pseudoinverse');
    expect(result.diagnostics.rank).toBe(2);
  });

  it('keeps finite coefficients when their orthogonal-coordinate norm overflows', () => {
    const result = solveLeastSquares([[1e-300, 1e-300, 1e-300]], [4e8]);
    expectVector(result.solution, [4 / 3 * 1e308, 4 / 3 * 1e308, 4 / 3 * 1e308]);
    expect(result.diagnostics.residualNorm / 4e8).toBeLessThan(1e-12);
  });

  it('retains an independent tiny coefficient while another constraint needs scaled intermediate coordinates', () => {
    const result = solveLeastSquares(
      [[1e-300, 1e-300, 1e-300, 0, 0, 0], [0, 0, 0, 1e300, 1e300, 1e300]],
      [4e8, 1],
    );
    expectVector(result.solution, [4 / 3 * 1e308, 4 / 3 * 1e308, 4 / 3 * 1e308, 1e-300 / 3, 1e-300 / 3, 1e-300 / 3]);
    expect(result.diagnostics.rank).toBe(2);
  });

  it('retains zero targets, deterministic repeats and input ownership', () => {
    const design = [[1, 2], [2, 4]];
    const before = structuredClone(design);
    const first = solveLeastSquares(design, [0, 0]);
    const repeated = solveLeastSquares(design, [0, 0]);
    expect(first).toEqual(repeated);
    expect(first.solution).toEqual([0, 0]);
    expect(design).toEqual(before);
    expect(first.diagnostics.rank).toBe(1);
    expect(() => solveLeastSquares([[0, 0]], [1])).toThrow(/zero numerical rank/);
    expect(() => solveLeastSquares([[1e-300, 1e-300]], [1e20])).toThrow(/coefficient exceeds/);
  });
});
