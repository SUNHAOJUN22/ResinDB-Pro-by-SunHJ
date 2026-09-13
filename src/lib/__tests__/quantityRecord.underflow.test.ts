import { describe, expect, it } from 'vitest';
import { canonicalizeCoreProperty, parseFiniteReal } from '@/lib/quantityRecord';

const method = 'declared test method';

describe('nonzero conversion underflow is not a measured zero', () => {
  const scaledUnits = [
    ['density', 'kg/m³'],
    ['tensileYield', 'Pa'],
    ['flexuralModulus', 'Pa'],
    ['izodImpact', 'J/m²'],
    ['charpyImpact', 'J/m²'],
  ] as const;

  for (const [key, unit] of scaledUnits) {
    it.each([1, -1])(`rejects ${key} underflow with sign %s`, (sign) => {
      const raw = { value: sign * Number.MIN_VALUE, unit, method, sampleId: 'synthetic-boundary' };
      const result = canonicalizeCoreProperty(key, raw, ['fixture:underflow']);
      expect(result.status).toBe('INVALID');
      expect(result.canonical).toBeUndefined();
      expect(result.reasonCodes).toEqual(['CONVERSION_UNDERFLOW']);
      expect(result.raw).toEqual(raw);
      expect(result.provenanceRefs).toEqual(['fixture:underflow']);
    });
  }

  for (const [key, unit] of scaledUnits.filter(([key]) => key !== 'density')) {
    it.each([0, -0])(`preserves ${key} explicit zero %s`, (value) => {
      const result = canonicalizeCoreProperty(key, { value, unit, method });
      expect(result.status).toBe('VALID');
      expect(result.canonical?.value).toBe(value);
      expect(result.reasonCodes).toEqual([]);
    });
  }

  it.each([1, 2, 4])('preserves representable subnormal %s', (scale) => {
    const value = scale * Number.MIN_VALUE;
    const result = canonicalizeCoreProperty('tensileYield', { value, unit: 'MPa', method });
    expect(result.status).toBe('VALID');
    expect(result.canonical?.value).toBe(value);
  });
});


describe('decimal text underflow is distinct from a measured zero', () => {
  const underflowTexts = [
    '1e-400', '-1e-400', '+.1e-9999', '1E-999', '2e-324', '-2e-324',
    '  10.0e-999  ', `0.${'0'.repeat(400)}1`,
  ];

  it.each(underflowTexts)('rejects nonzero text rounded to zero: %s', (value) => {
    expect(parseFiniteReal(value)).toBeNull();
    const raw = { value, unit: 'MPa', method, sampleId: 'synthetic-text-boundary' };
    const result = canonicalizeCoreProperty('tensileYield', raw, ['fixture:numeric-text']);
    expect(result.status).toBe('INVALID');
    expect(result.canonical).toBeUndefined();
    expect(result.reasonCodes).toEqual(['PARSING_UNDERFLOW']);
    expect(result.raw).toEqual(raw);
    expect(result.provenanceRefs).toEqual(['fixture:numeric-text']);
  });

  it.each(['0', '-0', '+0.0', '0e-9999', '-00.000e+9999', '.0E+999', '0.000e-0001'])(
    'preserves explicit decimal zero and its sign: %s', (value) => {
      expect(parseFiniteReal(value)).toBe(Number(value));
      const result = canonicalizeCoreProperty('tensileYield', { value, unit: 'MPa', method });
      expect(result.status).toBe('VALID');
      expect(result.canonical?.value).toBe(Number(value));
    },
  );

  it.each(['5e-324', '1e-323', '-5e-324', '-1e-323', '2.5', '1e308'])(
    'preserves representable numeric text: %s', (value) => {
      expect(parseFiniteReal(value)).toBe(Number(value));
    },
  );

  it('keeps parsing and conversion-stage failures separate', () => {
    const result = canonicalizeCoreProperty('tensileYield', {
      value: '5e-324', unit: 'Pa', method,
    });
    expect(result.status).toBe('INVALID');
    expect(result.reasonCodes).toEqual(['CONVERSION_UNDERFLOW']);
  });

  it.each([
    ['density', 'g/cm³'], ['mfr', 'g/10 min'], ['tensileYield', 'MPa'],
    ['flexuralModulus', 'MPa'], ['izodImpact', 'kJ/m²'], ['charpyImpact', 'kJ/m²'],
  ])('blocks parsing underflow in the %s contract', (key, unit) => {
    const result = canonicalizeCoreProperty(key, {
      value: '1e-400', unit, method, temperature: 230, load: 2.16,
    });
    expect(result.status).toBe('INVALID');
    expect(result.canonical).toBeUndefined();
    expect(result.reasonCodes).toEqual(['PARSING_UNDERFLOW']);
  });
});
