import { inverseStandardNormal } from './distributions';

/** Right-continuous empirical CDF, for a finite sample already sorted ascending. */
export function empiricalCdf(sortedValues: readonly number[], threshold: number): number {
  if (sortedValues.length === 0 || Number.isNaN(threshold)) {
    throw new RangeError('An empirical CDF requires a non-empty sample and a valid threshold');
  }
  let lower = 0;
  let upper = sortedValues.length;
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (sortedValues[middle] <= threshold) lower = middle + 1;
    else upper = middle;
  }
  return lower / sortedValues.length;
}

function adaptiveSimpson(
  f: (angle: number) => number, lower: number, upper: number,
  left: number, center: number, right: number, whole: number,
  tolerance: number, depth: number,
): number {
  const middle = (lower + upper) / 2;
  const leftCenter = f((lower + middle) / 2);
  const rightCenter = f((middle + upper) / 2);
  const leftIntegral = (middle - lower) / 6 * (left + 4 * leftCenter + center);
  const rightIntegral = (upper - middle) / 6 * (center + 4 * rightCenter + right);
  const refinement = leftIntegral + rightIntegral - whole;
  if (depth === 0 || Math.abs(refinement) <= 15 * tolerance) {
    return leftIntegral + rightIntegral + refinement / 15;
  }
  return adaptiveSimpson(f, lower, middle, left, leftCenter, center, leftIntegral, tolerance / 2, depth - 1)
    + adaptiveSimpson(f, middle, upper, center, rightCenter, right, rightIntegral, tolerance / 2, depth - 1);
}

/**
 * Gaussian-copula CDF, independent of the display density grid.
 * Integrates Plackett's correlation derivative after r = sin(theta), removing
 * its square-root singularity. Boundary and independent cases are exact.
 * Reference: https://doi.org/10.1093/biomet/41.3-4.351
 */
export function gaussianCopulaCdf(u: number, v: number, rho: number): number {
  if (![u, v, rho].every(Number.isFinite) || u < 0 || u > 1 || v < 0 || v > 1 || Math.abs(rho) > 1) {
    throw new RangeError('Copula probabilities must be in [0, 1] and correlation in [-1, 1]');
  }
  if (u === 0 || v === 0) return 0;
  if (u === 1) return v;
  if (v === 1) return u;
  if (rho === 0) return u * v;
  if (rho === 1) return Math.min(u, v);
  if (rho === -1) return Math.max(0, u + v - 1);

  const a = inverseStandardNormal(u);
  const b = inverseStandardNormal(v);
  const differenceSquared = (a - b) ** 2;
  const sumSquared = (a + b) ** 2;
  const integrand = (angle: number) => {
    const correlation = Math.sin(angle);
    // This positive-sum form avoids cancellation when a and b are close.
    return Math.exp(-differenceSquared / (4 * (1 - correlation)) - sumSquared / (4 * (1 + correlation)));
  };
  const end = Math.asin(rho);
  const left = integrand(0);
  const center = integrand(end / 2);
  const right = integrand(end);
  const whole = end / 6 * (left + 4 * center + right);
  const probability = u * v + adaptiveSimpson(integrand, 0, end, left, center, right, whole, 1e-11, 18) / (2 * Math.PI);
  // Numerical rounding must respect the copula's Fréchet bounds.
  return Math.max(Math.max(0, u + v - 1), Math.min(Math.min(u, v), probability));
}
