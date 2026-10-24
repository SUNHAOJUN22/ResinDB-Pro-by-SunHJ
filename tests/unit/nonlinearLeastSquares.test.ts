import { describe, expect, it } from 'vitest';
import { solveBoundedNonlinearLeastSquares } from '@/compute/nonlinearLeastSquares';

describe('bounded nonlinear least squares', () => {
  const x = new Float64Array([-2, -1, 0, 1, 2, 3]);
  const expectedScale = 3.5;
  const expectedExponent = -0.4;
  const y = Float64Array.from(x, (value) => expectedScale * Math.exp(expectedExponent * value));

  function solve(useAnalyticJacobian: boolean) {
    return solveBoundedNonlinearLeastSquares({
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
      ...(useAnalyticJacobian
        ? {
            evaluateJacobian(parameters: Float64Array, jacobian: Float64Array) {
              for (let index = 0; index < x.length; index++) {
                const offset = index * 2;
                jacobian[offset] = 1 / parameters[0];
                jacobian[offset + 1] = x[index];
              }
            },
          }
        : {}),
    });
  }

  it('recovers a bounded exponential model without explicit matrix inversion', () => {
    const result = solve(false);

    expect(result.converged).toBe(true);
    expect(result.parameters[0]).toBeCloseTo(expectedScale, 6);
    expect(result.parameters[1]).toBeCloseTo(expectedExponent, 6);
    expect(result.objective).toBeLessThan(1e-16);
    expect(result.jacobianMethod).toBe('central-finite-difference');
    expect(result.jacobianDiagnostics?.rank).toBe(2);
    expect(result.evaluations).toBeGreaterThan(1);
  });

  it('uses an analytic physical-parameter Jacobian with equivalent results and fewer residual evaluations', () => {
    const finiteDifference = solve(false);
    const analytic = solve(true);

    expect(analytic.converged).toBe(true);
    expect(analytic.parameters[0]).toBeCloseTo(finiteDifference.parameters[0], 7);
    expect(analytic.parameters[1]).toBeCloseTo(finiteDifference.parameters[1], 7);
    expect(analytic.objective).toBeLessThan(1e-16);
    expect(analytic.jacobianMethod).toBe('analytic');
    expect(analytic.jacobianDiagnostics?.rank).toBe(2);
    expect(analytic.evaluations).toBeLessThan(finiteDifference.evaluations / 2);
  });

  it('handles large finite Jacobian columns without overflowing the damping scale', () => {
    const result = solveBoundedNonlinearLeastSquares({
      parameters: [{ initial: 2, min: 0, max: 4 }],
      observationCount: 3,
      maxIterations: 20,
      evaluateResiduals(parameters, residuals) {
        for (let index = 0; index < residuals.length; index++) {
          residuals[index] = (parameters[0] - 2) * 1e155 + 1e152;
        }
      },
      evaluateJacobian(_parameters, jacobian) {
        jacobian.fill(1e155);
      },
    });

    expect(result.parameters[0]).toBeLessThan(2);
    expect(result.objective).toBeLessThan(3e304);
    expect(result.termination).not.toBe('damping-limit');
  });

  it('rejects a finite residual vector whose squared objective is not representable', () => {
    expect(() => solveBoundedNonlinearLeastSquares({
      parameters: [{ initial: 1, min: 0, max: 2 }],
      observationCount: 2,
      evaluateResiduals(_parameters, residuals) {
        residuals.fill(1e200);
      },
    })).toThrow(/objective exceeds the finite floating-point range/);
  });

  it('rejects non-finite analytic Jacobians', () => {
    expect(() => solveBoundedNonlinearLeastSquares({
      parameters: [{ initial: 1, min: 0, max: 2 }],
      observationCount: 2,
      evaluateResiduals(parameters, residuals) {
        residuals[0] = parameters[0] - 1;
        residuals[1] = parameters[0] - 1;
      },
      evaluateJacobian(_parameters, jacobian) {
        jacobian[0] = Number.NaN;
        jacobian[1] = 1;
      },
    })).toThrow(/Jacobian produced a non-finite value/);
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

  it('rejects a truly unrepresentable step norm rather than comparing Infinity to Infinity', () => {
    // The initial objective is 4e306. Four finite coordinate updates near
    // -1e308 have a combined norm near 2e308, beyond binary64's finite range.
    expect(() => solveBoundedNonlinearLeastSquares({
      parameters: Array.from({ length: 4 }, () => ({ initial: 0, min: -1, max: 1 })),
      observationCount: 5,
      maxIterations: 1,
      initialDamping: 1e-300,
      evaluateResiduals(parameters, residuals) {
        for (let index = 0; index < 4; index++) {
          const position = parameters[index];
          residuals[index] = 1e153 * (1 - position * position) + 2e-155 * position;
        }
        residuals[4] = 0;
      },
      evaluateJacobian(parameters, jacobian) {
        jacobian.fill(0);
        for (let index = 0; index < 4; index++) {
          jacobian[index * 4 + index] = -2e153 * parameters[index] + 2e-155;
        }
      },
    })).toThrow(/vector norm exceeds the finite floating-point range/);
  });
});
