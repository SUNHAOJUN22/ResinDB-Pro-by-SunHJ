export interface FiniteNumericSummary {
  count: number;
  minimum: number;
  maximum: number;
  sum: number;
  mean: number;
}

export type FiniteNumericSelector<T> = (value: T, index: number) => unknown;

const binary64View = new DataView(new ArrayBuffer(8));
const fractionMask = (1n << 52n) - 1n;

/** Express a finite binary64 value as an exact integer multiple of 2^-1074. */
function binary64Units(value: number): bigint {
  binary64View.setFloat64(0, value);
  const bits = binary64View.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & fractionMask;
  const magnitude = exponent === 0
    ? fraction
    : ((1n << 52n) | fraction) << BigInt(exponent - 1);
  return bits >> 63n ? -magnitude : magnitude;
}

/** Round an exact total or mean once, including subnormals and overflow. */
function roundedBinary64(units: bigint, divisor = 1n): number {
  if (units === 0n) return 0;
  const negative = units < 0n;
  const numerator = negative ? -units : units;
  const integralUnits = numerator / divisor;
  let shift = Math.max(0, integralUnits.toString(2).length - 53);
  const denominator = divisor << BigInt(shift);
  let significand = numerator / denominator;
  const twiceRemainder = (numerator % denominator) * 2n;
  if (twiceRemainder > denominator
    || (twiceRemainder === denominator && (significand & 1n) !== 0n)) {
    significand += 1n;
  }
  if (significand === 1n << 53n) {
    significand >>= 1n;
    shift += 1;
  }
  return (negative ? -1 : 1) * Number(significand) * 2 ** (shift - 1074);
}

/**
 * Summarizes finite numeric observations in one pass.
 *
 * - Non-number and non-finite selector results are ignored.
 * - Minimum and maximum are updated without variadic argument spreading.
 * - The sum uses Neumaier compensated summation to reduce cancellation error.
 * - Range overflow switches to integer binary64 units without buffering inputs
 *   or discarding tiny residuals. The mean is rounded directly from this total.
 * - An unrepresentable total is signed Infinity, never incidental NaN.
 * - `null` means that no finite numeric observation was available.
 */
export function summarizeFinite<T>(
  values: Iterable<T>,
  selector: FiniteNumericSelector<T> = (value) => value,
): FiniteNumericSummary | null {
  let count = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let compensation = 0;
  let exactUnits: bigint | null = null;
  let index = 0;

  for (const item of values) {
    const selected = selector(item, index);
    index += 1;
    if (typeof selected !== 'number' || !Number.isFinite(selected)) continue;

    if (selected < minimum) minimum = selected;
    if (selected > maximum) maximum = selected;
    count += 1;

    if (exactUnits !== null) {
      exactUnits += binary64Units(selected);
      continue;
    }

    const next = sum + selected;
    const correction = Math.abs(sum) >= Math.abs(selected)
      ? (sum - next) + selected
      : (selected - next) + sum;
    const nextCompensation = compensation + correction;
    if (!Number.isFinite(next) || !Number.isFinite(nextCompensation)) {
      // Seed from the still-finite pre-step state, before overflow corrupts it.
      exactUnits = binary64Units(sum) + binary64Units(compensation) + binary64Units(selected);
      continue;
    }
    sum = next;
    compensation = nextCompensation;
  }

  if (count === 0) return null;
  const compensatedSum = sum + compensation;
  if (exactUnits === null && !Number.isFinite(compensatedSum)) {
    exactUnits = binary64Units(sum) + binary64Units(compensation);
  }
  return {
    count,
    minimum,
    maximum,
    sum: exactUnits === null ? compensatedSum : roundedBinary64(exactUnits),
    mean: exactUnits === null ? compensatedSum / count : roundedBinary64(exactUnits, BigInt(count)),
  };
}

export function summarizeFiniteNumbers(values: Iterable<number>): FiniteNumericSummary | null {
  return summarizeFinite(values);
}
