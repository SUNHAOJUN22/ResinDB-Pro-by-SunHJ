import { describe, expect, it } from 'vitest';
import { matchesPropertyCondition, parsePropertyCondition } from '@/lib/propertySearch';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import { sandboxCarreau, sandboxWeibull, sandboxWlf } from '@/lib/sandboxModels';

describe('whole-string property search', () => {
  it('distinguishes exponents, signed ranges, and malformed comparisons', () => {
    expect(matchesPropertyCondition({ value: 0.001 }, parsePropertyCondition('1e-3'), 'value')).toBe(true);
    expect(matchesPropertyCondition({ value: -2 }, parsePropertyCondition('-3--1'), 'value')).toBe(true);
    expect(matchesPropertyCondition({ value: 1 }, parsePropertyCondition('>0.9'), 'value')).toBe(true);
    for (const input of ['>0.9junk', '>=Infinity', '<1e-999', '3-1', '1e-999']) {
      expect(matchesPropertyCondition({ value: 1 }, parsePropertyCondition(input), 'value')).toBe(false);
    }
    expect(matchesPropertyCondition({ value: '12abc' }, parsePropertyCondition('12'), 'value')).toBe(false);
  });
  it('uses canonical values and never resurrects explicit quantity rejections', () => {
    const valid = { value: 950, quantity: canonicalizeCoreProperty('density', { value: 950, unit: 'kg/m³' }) };
    expect(matchesPropertyCondition(valid, parsePropertyCondition('0.9-1'), 'density')).toBe(true);
    const unknown = { value: 950, quantity: canonicalizeCoreProperty('density', { value: 950 }) };
    expect(matchesPropertyCondition(unknown, parsePropertyCondition('>0'), 'density')).toBe(false);
  });
});

describe('local teaching model input boundaries', () => {
  it('matches transparent model equations on valid inputs', () => {
    expect(sandboxCarreau(2400, 0.155, 10, 0.35)).toBeCloseTo(2400 * (1 + 1.55 ** 2) ** (-0.65 / 2), 10);
    expect(sandboxWlf(25, 25, 17.44, 51.6)).toBe(1);
    expect(sandboxWeibull(1000, 5000, 2)).toBeCloseTo(100 * Math.exp(-0.04), 12);
    expect(sandboxWeibull(0, 5000, 2)).toBe(100);
  });
  it('rejects invalid domains instead of clamping input or substituting zero', () => {
    expect(sandboxCarreau(2400, -0.155, 10, 0.35)).toBeNull();
    expect(sandboxCarreau(2400, 0.155, 10, 2)).toBeNull();
    expect(sandboxCarreau(Number.NaN, 0, 0, 0)).toBeNull();
    expect(sandboxWlf(0, 10, 17.44, 10)).toBeNull();
    expect(sandboxWeibull(-1, 5000, 2)).toBeNull();
    expect(sandboxWeibull(1000, 0, 2)).toBeNull();
    expect(sandboxWeibull(1000, 5000, 0)).toBeNull();
  });
  it('avoids avoidable Carreau overflow and rejects real output underflow', () => {
    expect(sandboxCarreau(2400, 1e200, 1e200, 0.5)).toBeCloseTo(2.4e-197, 205);
    expect(sandboxCarreau(1e-300, 1e200, 1e200, 0)).toBeNull();
    expect(sandboxWeibull(1e308, 1, 2)).toBeNull();
  });
});

describe('numeric-only formula arithmetic boundaries', () => {
  it('does not recover an overflow, domain error, or nonzero underflow through a fallback', async () => {
    const { FormulaEngine } = await import('@/lib/formulaParser');
    for (const expression of ['1e-300 * 1e-300', '1e-300 / 1e300', 'exp(-1000)', 'pow(1e-300, 2)', '(1e308 * 10) / 1e308', '1 / 0 || 3', 'sqrt(-1) || 0']) {
      const result = new FormulaEngine().compilePropertyResultGraph([{ id: 'f', name: 'F', expression, unit: '1' }])({});
      expect(result.f.status, expression).toBe('INVALID');
      expect(result.f.value).toBeNull();
    }
  });
  it('applies exponent precedence consistently to typed and numeric-only expressions', async () => {
    const { compileFormulaExpression } = await import('@/lib/formula/expressionParser');
    const { compileDimensionedExpression } = await import('@/lib/formula/dimensionedExpression');
    for (const [expression, expected] of [['-2^2', -4], ['(-2)^2', 4], ['2^-2', 0.25], ['2^3^2', 512], ['0 * 1e300', 0], ['2 - 2', 0]] as const) {
      expect(compileFormulaExpression(expression)({})).toBe(expected);
      expect(compileDimensionedExpression(expression)({}).value).toBe(expected);
    }
  });
});
