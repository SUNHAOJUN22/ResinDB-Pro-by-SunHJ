import { describe, expect, it } from 'vitest';
import {
  CORE_QUANTITY_CONTRACTS,
  canonicalizeCoreProperty,
  canonicalizeQuantity,
  parseFiniteReal,
  resolveCorePropertyKey,
} from '@/lib/quantityRecord';

const method = 'declared test method';

describe('strict quantity contract', () => {
  it('converts 905 kg/m³ to 0.905 g/cm³ while preserving raw data', () => {
    const result = canonicalizeCoreProperty('density', { value: 905, unit: 'kg/m³' });
    expect(result.status).toBe('VALID');
    expect(result.raw).toMatchObject({ value: 905, unit: 'kg/m³' });
    expect(result.canonical).toEqual({ value: 0.905, unit: 'g/cm³', dimension: 'mass_density' });
  });

  it('converts 1.5 GPa to 1500 MPa', () => {
    const result = canonicalizeQuantity(
      { value: 1.5, unit: 'GPa', method },
      CORE_QUANTITY_CONTRACTS.tensileYield,
    );
    expect(result.status).toBe('VALID');
    expect(result.canonical?.value).toBe(1500);
  });

  it('rejects an incompatible impact unit rather than relabeling it', () => {
    const result = canonicalizeCoreProperty('izodImpact', {
      value: 12,
      unit: 'J/m',
      method,
    });
    expect(result.status).toBe('INVALID');
    expect(result.canonical).toBeUndefined();
  });

  it('keeps condition-dependent MFR unknown until method, temperature, and load exist', () => {
    const incomplete = canonicalizeCoreProperty('MFR', { value: 12, unit: 'g/10 min' });
    expect(incomplete.status).toBe('UNKNOWN');
    expect(incomplete.reasonCodes).toEqual(expect.arrayContaining([
      'MISSING_METHOD', 'MISSING_TEMPERATURE', 'MISSING_LOAD',
    ]));
    const complete = canonicalizeCoreProperty('熔体质量流动速率', {
      value: 12,
      unit: 'g/10 min',
      method,
      temperature: 230,
      load: 2.16,
    });
    expect(complete.status).toBe('VALID');
  });

  it('rejects booleans and non-finite values', () => {
    expect(parseFiniteReal(true)).toBeNull();
    expect(canonicalizeCoreProperty('density', { value: true, unit: 'g/cm³' }).status).toBe('INVALID');
    expect(canonicalizeCoreProperty('density', { value: Number.NaN, unit: 'g/cm³' }).status).toBe('INVALID');
  });

  it('does not equate physical zero with unknown', () => {
    const zero = canonicalizeQuantity(
      { value: 0, unit: 'MPa', method },
      CORE_QUANTITY_CONTRACTS.tensileYield,
    );
    expect(zero.status).toBe('VALID');
    expect(zero.canonical?.value).toBe(0);
    const missing = canonicalizeQuantity(
      { value: '', unit: 'MPa', method },
      CORE_QUANTITY_CONTRACTS.tensileYield,
    );
    expect(missing.status).toBe('UNKNOWN');
    expect(missing.canonical).toBeUndefined();
  });
});


describe('required measurement condition admission', () => {
  for (const field of ['temperature', 'load'] as const) {
    it.each(['', ' ', '\t\n'])('keeps blank %s unknown for '+field, (value) => {
      const result = canonicalizeCoreProperty('MFR', {
        value: 12, unit: 'g/10 min', method,
        conditions: { temperature: 230, load: 2.16, [field]: value },
      });
      expect(result.status).toBe('UNKNOWN');
      expect(result.canonical).toBeUndefined();
      expect(result.reasonCodes).toContain(`MISSING_${field.toUpperCase()}`);
      expect(result.raw.conditions?.[field]).toBe(value);
    });

    it.each([true, false, Number.NaN, Infinity, -Infinity, {}, []])(
      'rejects malformed condition %j for '+field, (value) => {
        const result = canonicalizeCoreProperty('MFR', {
          value: 12, unit: 'g/10 min', method,
          conditions: { temperature: 230, load: 2.16, [field]: value },
        });
        expect(result.status).toBe('INVALID');
        expect(result.canonical).toBeUndefined();
        expect(result.reasonCodes).toContain(`INVALID_${field.toUpperCase()}`);
        expect(result.raw.conditions?.[field]).toBe(value);
      },
    );
  }

  it.each([0, -20, 230, '230', '230 °C'])('preserves declared temperature %j', (temperature) => {
    const result = canonicalizeCoreProperty('MFR', {
      value: 12, unit: 'g/10 min', method, temperature, load: '2.16 kg',
    });
    expect(result.status).toBe('VALID');
    expect(result.canonical?.value).toBe(12);
    expect(result.raw.temperature).toBe(temperature);
  });

  it('checks top-level temperature and the legacy temp alias', () => {
    for (const temperatureField of ['temperature', 'temp'] as const) {
      const result = canonicalizeCoreProperty('MFR', {
        value: 12, unit: 'g/10 min', method, load: 2.16,
        [temperatureField]: Number.NaN,
        conditions: { temperature: 230 },
      });
      expect(result.status).toBe('INVALID');
      expect(result.reasonCodes).toContain('INVALID_TEMPERATURE');
    }
  });

  it('checks top-level load without falling back from an invalid declaration', () => {
    const result = canonicalizeCoreProperty('MFR', {
      value: 12, unit: 'g/10 min', method, temperature: 230, load: Infinity,
      conditions: { load: 2.16 },
    });
    expect(result.status).toBe('INVALID');
    expect(result.reasonCodes).toContain('INVALID_LOAD');
  });

  it('preserves optional-condition and nullish fallback behavior', () => {
    expect(canonicalizeCoreProperty('density', {
      value: 905, unit: 'kg/m3', conditions: { temperature: true },
    }).status).toBe('VALID');
    expect(canonicalizeCoreProperty('MFR', {
      value: 12, unit: 'g/10 min', method,
      conditions: { temperature: 230, load: 2.16 },
    }).status).toBe('VALID');
  });
});


describe('explicit quantity registry membership', () => {
  it.each(['constructor', 'CONSTRUCTOR', ' constructor ', 'con_struct_or', 'ｃｏｎｓｔｒｕｃｔｏｒ'])(
    'keeps the undeclared property %s unknown without invoking an inherited member',
    (key) => {
      expect(resolveCorePropertyKey(key)).toBeNull();
      const raw = { value: 1, unit: 'g/cm³' };
      const result = canonicalizeCoreProperty(key, raw, ['source:1']);
      expect(result.status).toBe('UNKNOWN');
      expect(result.reasonCodes).toEqual(['UNSUPPORTED_PROPERTY_CONTRACT']);
      expect(result.canonical).toBeUndefined();
      expect(result.raw).toEqual(raw);
      expect(result.provenanceRefs).toEqual(['source:1']);
    },
  );

  it.each([
    ['density', 'density'],
    ['密度', 'density'],
    ['MELT_MASS_FLOW_RATE', 'mfr'],
    ['tensile-yield', 'tensileYield'],
    ['ＦＬＥＸＵＲＡＬ　ＭＯＤＵＬＵＳ', 'flexuralModulus'],
  ])('preserves the explicitly declared alias %s', (key, expected) => {
    expect(resolveCorePropertyKey(key)).toBe(expected);
  });

  it('rejects a conversion factor supplied only by the prototype', () => {
    const factors: Record<string, number> = Object.create({ mpa: 1 });
    const contract = { ...CORE_QUANTITY_CONTRACTS.tensileYield, factors };
    const result = canonicalizeQuantity({ value: 2, unit: 'MPa', method }, contract);
    expect(result.status).toBe('INVALID');
    expect(result.reasonCodes).toEqual(['UNKNOWN_OR_INCOMPATIBLE_UNIT']);
    expect(result.canonical).toBeUndefined();
  });

  it('accepts an own factor without falling through to a different inherited value', () => {
    const factors: Record<string, number> = Object.create({ mpa: 1000 });
    factors.mpa = 1;
    const result = canonicalizeQuantity(
      { value: 2, unit: 'MPa', method },
      { ...CORE_QUANTITY_CONTRACTS.tensileYield, factors },
    );
    expect(result.status).toBe('VALID');
    expect(result.canonical?.value).toBe(2);
  });
});
