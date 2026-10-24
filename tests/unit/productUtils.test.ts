import { describe, expect, it } from 'vitest';
import type { Product } from '@/types/index';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import {
  calculateCompleteness,
  getComparableNumericPropertyKeys,
  getDynamicColumns,
  getVisibleNumericPropertyKeys,
  getPerformanceFingerprint,
  getProductValidationWarnings,
  getValidPropertiesCount,
  isPlaceholderValue,
} from '@/utils/productUtils';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    gradeName: 'PP-ZERO',
    manufacturerId: 'm-1',
    manufacturer: 'Test Lab',
    categoryIds: ['cat_pp'],
    properties: {},
    createdAt: '2026-07-28',
    updatedAt: '2026-07-28',
    ...overrides,
  };
}

describe('product data quality utilities', () => {
  it('preserves zero and legitimate categorical text as real values', () => {
    expect(isPlaceholderValue(0)).toBe(false);
    expect(isPlaceholderValue('0')).toBe(false);
    expect(isPlaceholderValue('UL94 V-0')).toBe(false);
    expect(isPlaceholderValue('none')).toBe(false);
    expect(isPlaceholderValue('无')).toBe(false);
    expect(isPlaceholderValue(Number.NaN)).toBe(true);
  });

  it('counts zero-valued and categorical properties', () => {
    expect(getValidPropertiesCount({
      Shrinkage: { value: 0 },
      Flammability: { value: 'V-0' },
      Missing: { value: 'N/A' },
    })).toBe(2);
  });

  it('includes a zero-valued measured property in completeness scoring', () => {
    const withZero = product({
      properties: {
        Density: { value: 0, standard: 'ISO 1183' },
        MFR: { value: 0, standard: 'ISO 1133' },
      },
    });
    const withoutValues = product({
      properties: {
        Density: { value: 'N/A', standard: 'ISO 1183' },
        MFR: { value: 'N/A', standard: 'ISO 1133' },
      },
    });
    expect(calculateCompleteness(withZero)).toBeGreaterThan(calculateCompleteness(withoutValues));
  });

  it('builds deterministic dynamic columns when products omit properties', () => {
    const columns = getDynamicColumns([
      product({ properties: { Density: { value: 0.9 } } }),
      product({ id: 'p-2', properties: { MFR: { value: 2 } } }),
    ]);
    expect(columns.slice(0, 2).map((column) => column.key)).toEqual(['gradeName', 'manufacturer']);
    expect(columns.map((column) => column.key)).toEqual(expect.arrayContaining(['Density', 'MFR']));
  });

  it('marks only complete, comparable quantity columns as numeric', () => {
    const columns = getDynamicColumns([
      product({ properties: { Density: {
        value: 0.9,
        unit: 'g/cm3',
        quantity: canonicalizeCoreProperty('Density', { value: 0.9, unit: 'g/cm3' }),
      } } }),
      product({ id: 'p-2', properties: { Density: {
        value: 900,
        unit: 'kg/m3',
        quantity: canonicalizeCoreProperty('Density', { value: 900, unit: 'kg/m3' }),
      } } }),
    ]);

    expect(columns.find((column) => column.key === 'Density')?.type).toBe('number');
  });

  it('keeps legacy and canonical values comparable only when their declared units match', () => {
    const canonicalAndLegacy = getDynamicColumns([
      product({ properties: { Density: {
        value: 0.9,
        unit: 'g/cm3',
        quantity: canonicalizeCoreProperty('Density', { value: 0.9, unit: 'g/cm3' }),
      } } }),
      product({ id: 'p-2', properties: { Density: { value: 0.95, unit: 'g/cm3' } } }),
    ]);
    const mixedUnits = getDynamicColumns([
      product({ properties: { Density: {
        value: 0.9,
        unit: 'g/cm3',
        quantity: canonicalizeCoreProperty('Density', { value: 0.9, unit: 'g/cm3' }),
      } } }),
      product({ id: 'p-2', properties: { Density: { value: 950, unit: 'kg/m3' } } }),
    ]);

    expect(canonicalAndLegacy.find((column) => column.key === 'Density')?.type).toBe('number');
    expect(mixedUnits.find((column) => column.key === 'Density')?.type).not.toBe('number');
  });

  it('does not infer a numeric criterion from unitless, mixed, or condition-incompatible data', () => {
    const mfr = (value: number, temperature: number) => ({
      value,
      unit: 'g/10min',
      method: 'ISO 1133',
      temperature,
      load: 2.16,
      quantity: canonicalizeCoreProperty('MFR', {
        value,
        unit: 'g/10min',
        method: 'ISO 1133',
        temperature,
        load: 2.16,
      }),
    });
    const columns = getDynamicColumns([
      product({ properties: {
        Unitless: { value: 1 },
        Mixed: { value: '12abc' },
        MFR: mfr(2, 190),
      } }),
      product({ id: 'p-2', properties: {
        Unitless: { value: 2 },
        Mixed: { value: 12, unit: 'count' },
        MFR: mfr(4, 230),
      } }),
    ]);

    expect(columns.find((column) => column.key === 'Unitless')?.type).not.toBe('number');
    expect(columns.find((column) => column.key === 'Mixed')?.type).not.toBe('number');
    expect(columns.find((column) => column.key === 'MFR')?.type).not.toBe('number');
  });

  it('uses quantity raw conditions as the comparison basis and rejects conflicting top-level copies', () => {
    const mfr = (value: number, rawTemperature: number, declaredTemperature: number) => ({
      value,
      unit: 'g/10min',
      method: 'ISO 1133',
      temperature: declaredTemperature,
      load: 2.16,
      quantity: canonicalizeCoreProperty('MFR', {
        value,
        unit: 'g/10min',
        method: 'ISO 1133',
        temperature: rawTemperature,
        load: 2.16,
      }),
    });
    const columns = getDynamicColumns([
      product({ properties: { MFR: mfr(2, 190, 190) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, 230, 190) } }),
    ]);

    expect(columns.find((column) => column.key === 'MFR')?.type).not.toBe('number');
    expect(getComparableNumericPropertyKeys([
      product({ properties: { MFR: mfr(2, 190, 190) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, 190, 190) } }),
    ])).toContain('MFR');
  });

  it('treats raw condition objects as equal regardless of key insertion order', () => {
    const mfr = (value: number, conditions: Record<string, unknown>) => ({
      value,
      unit: 'g/10min',
      method: 'ISO 1133',
      temperature: 190,
      load: 2.16,
      quantity: canonicalizeCoreProperty('MFR', {
        value,
        unit: 'g/10min',
        method: 'ISO 1133',
        temperature: 190,
        load: 2.16,
        conditions,
      }),
    });
    const sameConditionsDifferentOrder = [
      product({ properties: { MFR: mfr(2, { humidity: 20, atmosphere: 'N2' }) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, { atmosphere: 'N2', humidity: 20 }) } }),
    ];

    expect(getComparableNumericPropertyKeys(sameConditionsDifferentOrder)).toContain('MFR');
    const visibleMfrColumns = getDynamicColumns(sameConditionsDifferentOrder)
      .map((column) => column.key === 'MFR' ? { ...column, visible: true } : column);
    expect(getVisibleNumericPropertyKeys(visibleMfrColumns, sameConditionsDifferentOrder)).toContain('MFR');

    const genuinelyDifferentConditions = [
      product({ properties: { MFR: mfr(2, { humidity: 20, atmosphere: 'N2' }) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, { atmosphere: 'N2', humidity: 50 }) } }),
    ];
    expect(getComparableNumericPropertyKeys(genuinelyDifferentConditions)).not.toContain('MFR');

    const orderedArrayConditions = [
      product({ properties: { MFR: mfr(2, { sequence: [1, 2] }) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, { sequence: [2, 1] }) } }),
    ];
    expect(getComparableNumericPropertyKeys(orderedArrayConditions)).not.toContain('MFR');

    const mapConditionMfr = (value: number, declaration: string) => {
      const property = mfr(value, {});
      property.quantity.raw.conditions = new Map([['condition', declaration]]) as unknown as Record<string, unknown>;
      return property;
    };
    const unsupportedConditionObjects = [
      product({ properties: { MFR: mapConditionMfr(2, 'A') } }),
      product({ id: 'p-2', properties: { MFR: mapConditionMfr(4, 'B') } }),
    ];
    expect(getComparableNumericPropertyKeys(unsupportedConditionObjects)).not.toContain('MFR');

    const overflowConditions = JSON.parse('{"humidity":1e400,"atmosphere":"N2"}') as Record<string, unknown>;
    const nullHumidityConditions = { humidity: null, atmosphere: 'N2' };
    expect(Number.isFinite(overflowConditions.humidity)).toBe(false);
    expect(getComparableNumericPropertyKeys([
      product({ properties: { MFR: mfr(2, overflowConditions) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, nullHumidityConditions) } }),
    ])).not.toContain('MFR');

    const roundedLargeInteger = JSON.parse('{"humidity":9007199254740993}') as Record<string, unknown>;
    const representableLargeInteger = JSON.parse('{"humidity":9007199254740992}') as Record<string, unknown>;
    expect(roundedLargeInteger.humidity).toBe(representableLargeInteger.humidity);
    expect(getComparableNumericPropertyKeys([
      product({ properties: { MFR: mfr(2, roundedLargeInteger) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, representableLargeInteger) } }),
    ])).not.toContain('MFR');

    const omittedConditions = { atmosphere: 'N2', humidity: undefined };
    const absentConditions = { atmosphere: 'N2' };
    expect(getComparableNumericPropertyKeys([
      product({ properties: { MFR: mfr(2, omittedConditions) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, absentConditions) } }),
    ])).not.toContain('MFR');

    const prototypeHookConditions = [
      product({ properties: { MFR: mfr(2, { humidity: 20 }) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, { humidity: 80 }) } }),
    ];
    const priorArrayToJson = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
    let keysWithArrayToJsonHook: string[];
    try {
      Object.defineProperty(Array.prototype, 'toJSON', { configurable: true, value: () => 'constant' });
      keysWithArrayToJsonHook = getComparableNumericPropertyKeys(prototypeHookConditions);
    } finally {
      if (priorArrayToJson) Object.defineProperty(Array.prototype, 'toJSON', priorArrayToJson);
      else Reflect.deleteProperty(Array.prototype, 'toJSON');
    }
    expect(keysWithArrayToJsonHook).not.toContain('MFR');
  });

  it('re-evaluates comparable property keys for the current cohort instead of stale column types', () => {
    const mfr = (value: number, temperature: number) => ({
      value,
      unit: 'g/10min',
      method: 'ISO 1133',
      temperature,
      load: 2.16,
    });
    const initialProducts = [
      product({ properties: { MFR: mfr(2, 190) } }),
      product({ id: 'p-2', properties: { MFR: mfr(4, 190) } }),
    ];
    const staleColumns = getDynamicColumns(initialProducts);
    const changedCohort = [initialProducts[0], product({ id: 'p-2', properties: { MFR: mfr(4, 230) } })];

    expect(staleColumns.find((column) => column.key === 'MFR')?.type).toBe('number');
    expect(getVisibleNumericPropertyKeys(staleColumns, changedCohort)).not.toContain('MFR');
  });

  it('requires legacy core properties to satisfy their quantity contract', () => {
    const columns = getDynamicColumns([
      product({ properties: {
        MFR: { value: 2, unit: 'g/10min' },
        tensileYield: { value: 20, unit: 'MPa' },
      } }),
      product({ id: 'p-2', properties: {
        MFR: { value: 4, unit: 'g/10min' },
        tensileYield: { value: 22, unit: 'MPa' },
      } }),
    ]);
    const completeLegacyMfr = (value: number) => ({
      value,
      unit: 'g/10min',
      method: 'ISO 1133',
      temperature: 190,
      load: 2.16,
    });
    const completeColumns = getDynamicColumns([
      product({ properties: { MFR: completeLegacyMfr(2) } }),
      product({ id: 'p-2', properties: { MFR: completeLegacyMfr(4) } }),
    ]);

    expect(columns.find((column) => column.key === 'MFR')?.type).not.toBe('number');
    expect(columns.find((column) => column.key === 'tensileYield')?.type).not.toBe('number');
    expect(completeColumns.find((column) => column.key === 'MFR')?.type).toBe('number');
  });

  it('fails closed on malformed canonical quantity dimensions', () => {
    const malformed = {
      value: 0.9,
      unit: 'test-unit',
      quantity: {
        raw: { value: 0.9, unit: 'test-unit' },
        canonical: { value: 0.9, unit: 'test-unit', dimension: 42 },
        status: 'VALID',
        reasonCodes: [],
        provenanceRefs: [],
      },
    } as unknown as Product['properties'][string];

    const columns = getDynamicColumns([product({ properties: { TestProperty: malformed } })]);

    expect(columns.find((column) => column.key === 'TestProperty')?.type).not.toBe('number');
  });

  it('uses finite values only in the performance fingerprint', () => {
    const fingerprint = getPerformanceFingerprint(product({
      properties: {
        MFR: { value: 'not measured' },
        '弯曲模量': { value: Number.POSITIVE_INFINITY },
        HDT: { value: 120 },
      },
    }));
    expect(fingerprint[0]).toBe(0);
    expect(fingerprint[1]).toBe(0);
    expect(fingerprint[2]).toBe(120);
    expect(fingerprint.every(Number.isFinite)).toBe(true);
  });

  it('validates English property aliases without treating missing fields as zero', () => {
    const warnings = getProductValidationWarnings(product({
      properties: {
        Density: { value: 3.1 },
        MFR: { value: 600 },
        'Tensile Strength': { value: 600 },
        'Flexural Modulus': { value: 60_000 },
      },
    }), (key) => key);
    expect(warnings).toHaveLength(4);

    const noWarnings = getProductValidationWarnings(product({
      properties: { Density: { value: 'N/A' } },
    }), (key) => key);
    expect(noWarnings).toEqual([]);
  });
});
