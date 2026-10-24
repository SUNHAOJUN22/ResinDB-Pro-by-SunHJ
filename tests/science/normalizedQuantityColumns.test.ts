import { describe, expect, it, vi } from 'vitest';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';
import { getComparableNumericPropertyKeys, getDynamicColumns } from '@/utils/productUtils';
import type { MaterialRecord } from '@/lib/adapters/types';

vi.mock('@/data/resinData', () => ({
  LAB_RECORDS: [], OPEN_MARKET_RECORDS: [], PRODUCT_CATALOG: [], CATEGORY_TREE: [],
  PROPERTY_GROUPS: {}, MANUFACTURERS: [], REFERENCES: [],
  categoryIdFromText: () => 'category-test', categoryNameFromId: () => 'HDPE',
}));

function material(): MaterialRecord {
  return {
    id: 'normalized-quantity-column', source: 'open_market', category: 'HDPE', grade: 'Grade A',
    manufacturer: 'Lab', timestamp: 1,
    properties: {
      density: { value: 900, unit: 'kg/m³', method: 'ISO 1183' },
      mfr: { value: 12, unit: 'g/10min', method: 'ISO 1133', temp: 190, load: 2.16 },
    },
  };
}

describe('normalized canonical quantities remain comparable after storage bridging', () => {
  it('admits canonical density and MFR with numeric temp alias through the actual bridge', () => {
    const product = UniversalStorageBridge.recordToProduct(material());
    expect(product.properties['密度']).toMatchObject({ value: 0.9, unit: 'g/cm³', quantity: { raw: { value: 900, unit: 'kg/m³' }, status: 'VALID' } });
    expect(product.properties['熔体质量流动速率']).toMatchObject({ value: 12, unit: 'g/10 min', temperature: 190, load: 2.16, quantity: { raw: { temp: 190 }, status: 'VALID' } });
    expect(getComparableNumericPropertyKeys([product])).toEqual(expect.arrayContaining(['密度', '熔体质量流动速率']));
    expect(getDynamicColumns([product]).filter((column) => ['密度', '熔体质量流动速率'].includes(column.key)).every((column) => column.type === 'number')).toBe(true);
  });

  it('fails closed when a canonical value, unit, condition, or validity status conflicts', () => {
    const product = UniversalStorageBridge.recordToProduct(material());
    const density = product.properties['密度'];
    density.value = 9;
    expect(getComparableNumericPropertyKeys([product])).not.toContain('密度');

    const mfr = product.properties['熔体质量流动速率'];
    mfr.temperature = 230;
    expect(getComparableNumericPropertyKeys([product])).not.toContain('熔体质量流动速率');

    const unknown = UniversalStorageBridge.recordToProduct(material());
    unknown.properties['密度'].quantity!.status = 'UNKNOWN';
    delete unknown.properties['密度'].quantity!.canonical;
    expect(getComparableNumericPropertyKeys([unknown])).not.toContain('密度');
  });
});
