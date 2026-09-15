import { describe, expect, it } from 'vitest';
import type { Product, PropertyValue } from '@/types/index';
import { buildFiniteRadarProjection } from '@/utils/radarProjection';

function product(values: Record<string, unknown>): Product {
  const properties: Record<string, PropertyValue> = {};
  for (const [key, value] of Object.entries(values)) {
    properties[key] = { value: value as PropertyValue['value'] };
  }
  return {
    id: 'radar-fixture',
    gradeName: 'Radar Fixture',
    manufacturerId: 'm',
    manufacturer: 'Demo',
    categoryIds: ['cat_pp'],
    createdAt: '2025-01-01',
    updatedAt: '2026-01-01',
    properties,
  };
}

describe('finite radar projection', () => {
  it('preserves real zero while rejecting missing, partial, boolean and non-finite inputs', () => {
    const result = buildFiniteRadarProjection(
      product({
        A: 0,
        B: '2.5',
        C: '3e1',
        D: '12abc',
        E: true,
        F: Number.NaN,
      }),
      {
        preferredKeys: ['A', 'B', 'C', 'D', 'E', 'F'],
        minimumDimensions: 3,
        maximumDimensions: 6,
      },
    );

    expect(result.status).toBe('OK');
    expect(result.keys).toEqual(['A', 'B', 'C']);
    expect(result.values).toEqual([0, 2.5, 30]);
    expect(result.omittedKeys).toEqual(['D', 'E', 'F']);
  });

  it('returns an explicit insufficient-data state instead of padding with zeros', () => {
    const result = buildFiniteRadarProjection(
      product({ A: 1, B: 'missing', C: undefined }),
      {
        preferredKeys: ['A', 'B', 'C'],
        minimumDimensions: 3,
        maximumDimensions: 5,
      },
    );

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.keys).toEqual(['A']);
    expect(result.values).toEqual([1]);
    expect(result.values).not.toContain(0);
  });

  it('adds deterministic finite fallback properties without changing preferred order', () => {
    const result = buildFiniteRadarProjection(
      product({ Preferred: 4, Zeta: 6, Alpha: 5, Broken: '' }),
      {
        preferredKeys: ['Preferred'],
        minimumDimensions: 3,
        maximumDimensions: 3,
      },
    );

    expect(result.status).toBe('OK');
    expect(result.keys).toEqual(['Preferred', 'Alpha', 'Zeta']);
    expect(result.values).toEqual([4, 5, 6]);
  });

  it('treats governed quantity status as authoritative and uses only VALID canonical values', () => {
    const fixture = product({ InvalidRaw: 10, Canonical: 'not-a-number', RealZero: 0, UnknownRaw: 4, Legacy: 1 });
    fixture.properties.InvalidRaw.quantity = {
      raw: { value: 10, unit: 'MPa' },
      status: 'INVALID',
      reasonCodes: ['synthetic-invalid'],
      provenanceRefs: [],
    };
    fixture.properties.Canonical.quantity = {
      raw: { value: 'not-a-number', unit: 'MPa' },
      canonical: { value: 2.5, unit: 'MPa', dimension: 'pressure' },
      status: 'VALID',
      reasonCodes: [],
      provenanceRefs: ['synthetic:test'],
    };
    fixture.properties.UnknownRaw.quantity = {
      raw: { value: 4, unit: 'MPa' },
      status: 'UNKNOWN',
      reasonCodes: ['synthetic-unknown'],
      provenanceRefs: [],
    };

    const result = buildFiniteRadarProjection(fixture, {
      preferredKeys: ['InvalidRaw', 'Canonical', 'RealZero', 'UnknownRaw', 'Legacy'],
      minimumDimensions: 3,
      maximumDimensions: 5,
    });

    expect(result.status).toBe('OK');
    expect(result.keys).toEqual(['Canonical', 'RealZero', 'Legacy']);
    expect(result.values).toEqual([2.5, 0, 1]);
    expect(result.omittedKeys).toEqual(['InvalidRaw', 'UnknownRaw']);
  });

  it('rejects VALID governed quantities that lack a finite canonical value instead of falling back', () => {
    const fixture = product({ A: 7, B: 2, C: 3, D: 4 });
    fixture.properties.A.quantity = {
      raw: { value: 7 },
      status: 'VALID',
      reasonCodes: [],
      provenanceRefs: [],
    };

    const result = buildFiniteRadarProjection(fixture, {
      preferredKeys: ['A', 'B', 'C', 'D'],
      minimumDimensions: 3,
      maximumDimensions: 4,
    });

    expect(result.status).toBe('OK');
    expect(result.keys).toEqual(['B', 'C', 'D']);
    expect(result.values).toEqual([2, 3, 4]);
    expect(result.omittedKeys).toEqual(['A']);
  });

  it('rejects inconsistent dimension limits', () => {
    expect(() =>
      buildFiniteRadarProjection(product({ A: 1 }), {
        minimumDimensions: 4,
        maximumDimensions: 3,
      }),
    ).toThrow(RangeError);
  });
});
