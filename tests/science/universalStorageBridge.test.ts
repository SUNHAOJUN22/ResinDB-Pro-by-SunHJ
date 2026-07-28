import { beforeEach, describe, expect, it } from 'vitest';
import type { MaterialRecord } from '@/lib/adapters/types';
import type { Product } from '@/types/index';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';

const LAB_KEY = 'resindb_pro_my_lab_data';
const OPEN_KEY = 'resindb_pro_open_market_data';

function record(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
  return {
    id: 'lab-1',
    source: 'my_lab',
    category: 'PP',
    grade: 'PP-LAB-1',
    manufacturer: 'Research Lab',
    properties: {
      density: { value: 0.9, unit: 'g/cm³' },
      mfr: { value: 2.1, unit: 'g/10min' },
    },
    timestamp: Date.parse('2026-07-28T00:00:00Z'),
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-pp',
    gradeName: 'PP-TEST',
    manufacturerId: 'm-test',
    manufacturer: 'Test Maker',
    categoryIds: ['cat_pp'],
    properties: {
      Density: { value: 0.91 },
      MFR: { value: 3.5 },
    },
    createdAt: '2026-07-28',
    updatedAt: '2026-07-28',
    ...overrides,
  };
}

describe('UniversalStorageBridge scientific conversion', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips finite properties and retains MFR conditions', () => {
    const source = record({
      properties: {
        density: { value: 0.91, unit: 'g/cm³', standard: 'ISO 1183' },
        mfr: { value: 3.2, unit: 'g/10min', temp: '230℃', load: '2.16kg' },
      },
    });
    const converted = UniversalStorageBridge.recordToProduct(source);
    expect(converted.categoryIds).toContain('cat_pp');
    expect(converted.properties['熔体质量流动速率']).toMatchObject({
      value: 3.2,
      temperature: '230℃',
      load: '2.16kg',
    });
    expect(UniversalStorageBridge.productToRecord(converted, 'my_lab').properties.mfr).toMatchObject({
      value: 3.2,
      temp: '230℃',
      load: '2.16kg',
    });
  });

  it('defaults PP MFR temperature to 230℃ and ignores non-finite values', () => {
    const converted = UniversalStorageBridge.productToRecord(product({
      properties: {
        Density: { value: 'bad-value' },
        MFR: { value: 2.5 },
        Modulus: { value: Number.POSITIVE_INFINITY },
      },
    }));
    expect(converted.properties.density).toBeUndefined();
    expect(converted.properties.flexuralModulus).toBeUndefined();
    expect(converted.properties.mfr).toMatchObject({ temp: '230℃', load: '2.16kg' });
  });

  it('saves, replaces and deletes validated laboratory records', () => {
    UniversalStorageBridge.saveLabRecord(record());
    UniversalStorageBridge.saveLabRecord(record({ properties: {
      density: { value: 0.92, unit: 'g/cm³' },
      mfr: { value: 4, unit: 'g/10min' },
    } }));
    const saved = UniversalStorageBridge.getLabRecords().filter((item) => item.id === 'lab-1');
    expect(saved).toHaveLength(1);
    expect(saved[0].properties.mfr?.value).toBe(4);
    UniversalStorageBridge.deleteLabRecord('lab-1');
    expect(JSON.parse(localStorage.getItem(LAB_KEY) || '[]').some((item: MaterialRecord) => item.id === 'lab-1')).toBe(false);
  });

  it('rejects records below the two-property scientific minimum', () => {
    expect(() => UniversalStorageBridge.saveLabRecord(record({
      properties: { density: { value: 0.91, unit: 'g/cm³' } },
    }))).toThrow('validationErrorMinProps');
  });


  it('falls back to a safe date for a non-finite timestamp', () => {
    const converted = UniversalStorageBridge.recordToProduct(record({ timestamp: Number.POSITIVE_INFINITY }));
    expect(Number.isFinite(Date.parse(converted.createdAt))).toBe(true);
  });

  it('deduplicates open-market records by grade and manufacturer', () => {
    UniversalStorageBridge.saveOpenMarketRecord(record({ id: 'market-a', source: 'open_market', grade: 'DUP', manufacturer: 'Maker' }));
    UniversalStorageBridge.saveOpenMarketRecord(record({ id: 'market-b', source: 'open_market', grade: 'DUP', manufacturer: 'Maker', properties: {
      density: { value: 0.92, unit: 'g/cm³' },
      mfr: { value: 5, unit: 'g/10min' },
    } }));
    const duplicates = UniversalStorageBridge.getOpenMarketRecords().filter((item) => item.grade === 'DUP' && item.manufacturer === 'Maker');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].id).toBe('market-b');
  });

  it('does not return an arbitrary market record for an empty grade query', () => {
    localStorage.setItem(OPEN_KEY, JSON.stringify([record({ source: 'open_market' })]));
    expect(UniversalStorageBridge.findOpenMarketGrade('PP', '   ')).toBeNull();
  });

  it('matches exact category before a cross-category grade duplicate', () => {
    localStorage.setItem(OPEN_KEY, JSON.stringify([
      record({ id: 'pe-same', source: 'open_market', category: 'HDPE', grade: 'SAME' }),
      record({ id: 'pp-same', source: 'open_market', category: 'PP', grade: 'SAME' }),
    ]));
    expect(UniversalStorageBridge.findOpenMarketGrade('PP', 'SAME')?.id).toBe('pp-same');
  });
});
