import { describe, expect, it } from 'vitest';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';

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
