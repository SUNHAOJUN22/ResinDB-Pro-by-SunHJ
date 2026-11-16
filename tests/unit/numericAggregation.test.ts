import { describe, expect, it } from 'vitest';
import { summarizeFinite, summarizeFiniteNumbers } from '@/lib/numericAggregation';

describe('finite numeric aggregation', () => {
  it('summarizes finite observations and ignores invalid values', () => {
    const summary = summarizeFinite(
      [3, Number.NaN, -2, Number.POSITIVE_INFINITY, 7, undefined],
      (value) => value,
    );

    expect(summary).toEqual({
      count: 3,
      minimum: -2,
      maximum: 7,
      sum: 8,
      mean: 8 / 3,
    });
  });

  it('uses compensated summation for cancellation-prone inputs', () => {
    const summary = summarizeFiniteNumbers([1e16, 1, -1e16]);
    expect(summary?.sum).toBe(1);
    expect(summary?.mean).toBeCloseTo(1 / 3, 15);
  });

  it('returns null when no finite number is present', () => {
    expect(summarizeFiniteNumbers([Number.NaN, Number.NEGATIVE_INFINITY])).toBeNull();
  });

  it('keeps a representable mean when the finite-input sum exceeds the numeric range', () => {
    const summary = summarizeFiniteNumbers([Number.MAX_VALUE, Number.MAX_VALUE]);
    expect(summary?.mean).toBe(Number.MAX_VALUE);
    expect(summary?.sum).toBe(Number.POSITIVE_INFINITY);
  });

  it('recovers a finite total after intermediate overflow and cancellation', () => {
    const summary = summarizeFiniteNumbers([1e308, 1e308, 7, -1e308, -1e308]);
    expect(summary?.sum).toBeCloseTo(7, 12);
    expect(summary?.mean).toBeCloseTo(1.4, 12);
  });

  it.each([
    [1e308, 1e308, 1e-100, -1e308, -1e308],
    [1e308, 1e-100, 1e308, -1e308, -1e308],
    [1e-100, 1e308, 1e308, -1e308, -1e308],
    [-1e308, -1e308, 1e-100, 1e308, 1e308],
  ])('preserves a tiny residual across overflow for ordering %j', (...values) => {
    const positive = summarizeFiniteNumbers(values);
    const negative = summarizeFiniteNumbers(values.map((value) => -value));
    expect(positive?.sum).toBe(1e-100);
    expect(positive?.mean).toBe(2e-101);
    expect(negative?.sum).toBe(-1e-100);
    expect(negative?.mean).toBe(-2e-101);
  });

  it('handles overflow when the compensation is added only at finalization', () => {
    const summary = summarizeFiniteNumbers([Number.MAX_VALUE, 2 ** 969, 2 ** 969]);
    expect(summary?.sum).toBe(Number.POSITIVE_INFINITY);
    expect(summary?.mean).toBe(5.992310449541053e307);
  });

  it('rounds the mean directly from the accumulator after overflow', () => {
    const summary = summarizeFiniteNumbers([
      Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE,
      1, Number.EPSILON / 2,
    ]);
    expect(summary?.sum).toBe(1);
    expect(summary?.mean).toBe(0.16666666666666669);
  });

  it.each([
    [1, 0, 0],
    [3, 0, 0],
    [1, 8, 2],
    [-1, -8, -2],
  ])('rounds subnormal residuals to nearest even (%d, %d)', (first, second, meanUnits) => {
    const summary = summarizeFiniteNumbers([
      1e308, 1e308, -1e308, -1e308,
      first * Number.MIN_VALUE, second * Number.MIN_VALUE,
    ]);
    expect(summary?.sum).toBe((first + second) * Number.MIN_VALUE);
    expect(summary?.mean).toBe(meanUnits * Number.MIN_VALUE);
  });

  it('returns a finite negative mean when the total is negative infinity', () => {
    const summary = summarizeFiniteNumbers([-Number.MAX_VALUE, -Number.MAX_VALUE]);
    expect(summary?.sum).toBe(Number.NEGATIVE_INFINITY);
    expect(summary?.mean).toBe(-Number.MAX_VALUE);
  });

  it('scans one million generated values without argument spreading', () => {
    function* values() {
      for (let index = 0; index < 1_000_000; index += 1) yield index - 500_000;
    }

    const summary = summarizeFiniteNumbers(values());
    expect(summary?.count).toBe(1_000_000);
    expect(summary?.minimum).toBe(-500_000);
    expect(summary?.maximum).toBe(499_999);
    expect(summary?.sum).toBe(-500_000);
  });
});
