const INVERSE_NORMAL_A = [
  -3.969683028665376e1,
  2.209460984245205e2,
  -2.759285104469687e2,
  1.38357751867269e2,
  -3.066479806614716e1,
  2.506628277459239,
] as const;

const INVERSE_NORMAL_B = [
  -5.447609879822406e1,
  1.615858368580409e2,
  -1.556989798598866e2,
  6.680131188771972e1,
  -1.328068155288572e1,
] as const;

const INVERSE_NORMAL_C = [
  -7.784894002430293e-3,
  -3.223964580411365e-1,
  -2.400758277161838,
  -2.549732539343734,
  4.374664141464968,
  2.938163982698783,
] as const;

const INVERSE_NORMAL_D = [
  7.784695709041462e-3,
  3.224671290700398e-1,
  2.445134137142996,
  3.754408661907416,
] as const;

const INVERSE_NORMAL_LOWER = 0.02425;
const INVERSE_NORMAL_UPPER = 1 - INVERSE_NORMAL_LOWER;

export function inverseStandardNormal(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new RangeError('Normal probability must lie strictly between zero and one');
  }
  if (probability < INVERSE_NORMAL_LOWER) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((INVERSE_NORMAL_C[0] * q + INVERSE_NORMAL_C[1]) * q + INVERSE_NORMAL_C[2]) * q
      + INVERSE_NORMAL_C[3]) * q + INVERSE_NORMAL_C[4]) * q + INVERSE_NORMAL_C[5])
      / ((((INVERSE_NORMAL_D[0] * q + INVERSE_NORMAL_D[1]) * q + INVERSE_NORMAL_D[2]) * q
        + INVERSE_NORMAL_D[3]) * q + 1);
  }
  if (probability > INVERSE_NORMAL_UPPER) {
    const q = Math.sqrt(-2 * Math.log1p(-probability));
    return -(((((INVERSE_NORMAL_C[0] * q + INVERSE_NORMAL_C[1]) * q + INVERSE_NORMAL_C[2]) * q
      + INVERSE_NORMAL_C[3]) * q + INVERSE_NORMAL_C[4]) * q + INVERSE_NORMAL_C[5])
      / ((((INVERSE_NORMAL_D[0] * q + INVERSE_NORMAL_D[1]) * q + INVERSE_NORMAL_D[2]) * q
        + INVERSE_NORMAL_D[3]) * q + 1);
  }
  const q = probability - 0.5;
  const r = q * q;
  return (((((INVERSE_NORMAL_A[0] * r + INVERSE_NORMAL_A[1]) * r + INVERSE_NORMAL_A[2]) * r
    + INVERSE_NORMAL_A[3]) * r + INVERSE_NORMAL_A[4]) * r + INVERSE_NORMAL_A[5]) * q
    / (((((INVERSE_NORMAL_B[0] * r + INVERSE_NORMAL_B[1]) * r + INVERSE_NORMAL_B[2]) * r
      + INVERSE_NORMAL_B[3]) * r + INVERSE_NORMAL_B[4]) * r + 1);
}

export function chiSquareUpperTailQuantileWilsonHilferty(
  degreesOfFreedom: number,
  upperTailAlpha: number,
): number {
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom < 1) {
    throw new RangeError('Chi-square degrees of freedom must be a positive integer');
  }
  if (!Number.isFinite(upperTailAlpha) || upperTailAlpha <= 0 || upperTailAlpha >= 0.5) {
    throw new RangeError('Upper-tail alpha must lie between zero and 0.5');
  }
  // Preserve the upper tail instead of subtracting it from one.
  const z = -inverseStandardNormal(upperTailAlpha);
  const correction = 2 / (9 * degreesOfFreedom);
  const transformed = 1 - correction + z * Math.sqrt(correction);
  return degreesOfFreedom * Math.max(0, transformed) ** 3;
}


// Lanczos log-gamma on the positive half-integers needed for integer chi-square df.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
] as const;
function logGamma(shape: number): number {
  const z = shape - 1;
  let sum = LANCZOS[0] as number;
  for (let index = 1; index < LANCZOS.length; index++) sum += LANCZOS[index] / (z + index);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Log of the regularized upper incomplete gamma; avoids losing tiny tails. */
function logGammaUpper(shape: number, x: number, normalization: number): number {
  if (x === 0) return 0;
  const logFactor = shape * Math.log(x) - x - normalization;
  const epsilon = 4 * Number.EPSILON;
  const maximumIterations = 10000;
  if (x < shape + 1) {
    let term = 1 / shape;
    let sum = term;
    for (let iteration = 1; iteration <= maximumIterations; iteration++) {
      term *= x / (shape + iteration);
      sum += term;
      if (Math.abs(term) <= Math.abs(sum) * epsilon) {
        const lower = Math.exp(logFactor) * sum;
        if (!(lower >= 0 && lower < 1)) throw new RangeError('Incomplete-gamma series left its numerical range');
        return Math.log1p(-lower);
      }
    }
  } else {
    // Modified Lentz evaluation of the positive upper-tail continued fraction.
    const tiny = 1e-300;
    let b = x + 1 - shape;
    let c = 1 / tiny;
    let d = 1 / b;
    let fraction = d;
    for (let iteration = 1; iteration <= maximumIterations; iteration++) {
      const numerator = -iteration * (iteration - shape);
      b += 2;
      d = b + numerator * d;
      if (Math.abs(d) < tiny) d = d < 0 ? -tiny : tiny;
      c = b + numerator / c;
      if (Math.abs(c) < tiny) c = c < 0 ? -tiny : tiny;
      d = 1 / d;
      const update = d * c;
      fraction *= update;
      if (Math.abs(update - 1) <= epsilon) {
        if (!(fraction > 0) || !Number.isFinite(fraction)) throw new RangeError('Incomplete-gamma fraction left its numerical range');
        return logFactor + Math.log(fraction);
      }
    }
  }
  throw new RangeError('Incomplete-gamma evaluation did not converge within its budget');
}

/**
 * Numerical chi-square inverse survival function, Q(df/2, q/2) = alpha.
 * Supports integer 1 <= df <= 1e6 and 0 < alpha < 0.5, including subnormal tails.
 * df=2 is exact apart from Math.log rounding. Other df use log-tail bracketing.
 * This improves the distribution quantile; it does not calibrate outlier rates
 * when the mean/covariance are estimated or regularized from the same sample.
 */
export function chiSquareUpperTailQuantile(degreesOfFreedom: number, upperTailAlpha: number): number {
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom < 1 || degreesOfFreedom > 1e6) {
    throw new RangeError('Chi-square degrees of freedom must be an integer between 1 and 1000000');
  }
  if (!Number.isFinite(upperTailAlpha) || upperTailAlpha <= 0 || upperTailAlpha >= 0.5) {
    throw new RangeError('Upper-tail alpha must lie between zero and 0.5');
  }
  if (degreesOfFreedom === 2) return -2 * Math.log(upperTailAlpha);
  const shape = degreesOfFreedom / 2;
  const normalization = logGamma(shape);
  const target = Math.log(upperTailAlpha);
  let lower = 0;
  let upper = Math.max(degreesOfFreedom, 1);
  let bracketed = false;
  for (let attempt = 0; attempt < 64; attempt++) {
    if (logGammaUpper(shape, upper / 2, normalization) <= target) {
      bracketed = true;
      break;
    }
    upper *= 2;
  }
  if (!bracketed) throw new RangeError('Chi-square quantile could not be bracketed');
  for (let iteration = 0; iteration < 160; iteration++) {
    const middle = lower + (upper - lower) / 2;
    if (middle === lower || middle === upper || upper - lower <= 8 * Number.EPSILON * Math.max(1, middle)) {
      return middle;
    }
    if (logGammaUpper(shape, middle / 2, normalization) > target) lower = middle;
    else upper = middle;
  }
  throw new RangeError('Chi-square quantile did not converge within its budget');
}
