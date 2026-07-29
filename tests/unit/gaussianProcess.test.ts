import { describe, expect, it } from 'vitest';
import {
  createGaussianProcessScratch,
  factorizeGaussianProcessRbf,
  predictGaussianProcessRbf,
  solveGaussianProcessAlpha,
} from '@/compute/gaussianProcess';

describe('allocation-conscious Gaussian-process kernel', () => {
  it('reproduces training targets within the configured noise scale', () => {
    const inputs = [[0], [0.25], [0.5], [0.75], [1]];
    const target = inputs.map(([value]) => Math.sin(value * Math.PI));
    const factorization = factorizeGaussianProcessRbf(inputs, {
      lengthScale: 0.35,
      noise: 1e-10,
    });
    const alpha = solveGaussianProcessAlpha(factorization, target);
    const scratch = createGaussianProcessScratch(inputs.length);

    for (let index = 0; index < inputs.length; index++) {
      const prediction = predictGaussianProcessRbf(
        factorization,
        alpha,
        inputs[index],
        scratch,
      );
      expect(prediction.mean).toBeCloseTo(target[index], 7);
      expect(prediction.variance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(prediction.standardDeviation)).toBe(true);
    }
    expect(factorization.inputs).toBeInstanceOf(Float64Array);
    expect(factorization.lower).toBeInstanceOf(Float64Array);
  });

  it('returns identical predictions when scratch buffers are reused', () => {
    const factorization = factorizeGaussianProcessRbf(
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      { lengthScale: 0.8, noise: 1e-6 },
    );
    const alpha = solveGaussianProcessAlpha(factorization, [0, 1, 1, 2]);
    const scratch = createGaussianProcessScratch(4);
    const first = predictGaussianProcessRbf(factorization, alpha, [0.4, 0.6], scratch);
    const second = predictGaussianProcessRbf(factorization, alpha, [0.4, 0.6], scratch);
    expect(second).toEqual(first);
  });
});
