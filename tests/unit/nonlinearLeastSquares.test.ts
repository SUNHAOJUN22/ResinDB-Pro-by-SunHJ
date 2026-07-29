import { describe, expect, it } from 'vitest';
import { solveBoundedNonlinearLeastSquares } from '@/compute/nonlinearLeastSquares';

describe('bounded nonlinear least squares', () => {
  it('recovers a bounded exponential model without explicit matrix inversion', () => {
    const x = new Float64Array([-2, -1, 0, 1, 2, 3]);
    const expectedScale = 3.5;
    const expectedExponent = -0.4;
    const y = Float64Array.from(x, (value) => expectedScale * Math.exp(expectedExponent * value));

    const result = solveBoundedNonlinearLeastSquares({
      parameters: [
        { initial: 2, min: 0.1, max: 20 },
        { initial: -0.1, min: -2, max: 1 },
      ],
      observationCount: x.length,
      evaluateResiduals(parameters, residuals) {
        for (let index = 0; index < x.length; index++) {
          residuals[index] = Math.log(parameters[0]) + parameters[1] * x[index] - Math.log(y[index]);
        }
      },
    });

    expect(result.converged).toBe(true);
    expect(result.parameters[0]).toBeCloseTo(expectedScale, 6);
    expect(result.parameters[1]).toBeCloseTo(expectedExponent, 6);
    expect(result.objective).toBeLessThan(1e-16);
    expect(result.jacobianDiagnostics?.rank).toBe(2);
    expect(result.evaluations).toBeGreaterThan(1);
  });

  it('rejects underdetermined systems and invalid bounds', () => {
    expect(() => solveBoundedNonlinearLeastSquares({
      parameters: [{ initial: 1, min: 0, max: 2 }],
      observationCount: 1,
      evaluateResiduals() {},
    })).toThrow(/parameterCount \+ 1/);

    expect(() => solveBoundedNonlinearLeastSquares({
      parameters: [{ initial: 1, min: 2, max: 0 }],
      observationCount: 2,
      evaluateResiduals() {},
    })).toThrow(/min < max/);
  });
});
