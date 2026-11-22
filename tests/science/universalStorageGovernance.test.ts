import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDBProductAdapter } from '@/lib/adapters/IndexedDBProductAdapter';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import type { MaterialRecord } from '@/lib/adapters/types';
import type { Product } from '@/types/index';

const LAB_KEY = 'resindb_pro_my_lab_data';
type Declaration = 'UNKNOWN' | 'INVALID' | 'CONFLICT' | 'VALID';

function product(kind: Declaration): Product {
  const raw = { value: 900, unit: 'kg/m³' };
  const quantity = canonicalizeCoreProperty('density', raw, ['SYNTHETIC-REGRESSION']);
  if (kind === 'UNKNOWN' || kind === 'INVALID') {
    quantity.status = kind;
    delete quantity.canonical;
    quantity.reasonCodes = ['EXTERNAL_REVIEW_REQUIRED'];
  } else if (kind === 'CONFLICT') {
    quantity.canonical!.value = 900;
  }
  return {
    id: `synthetic-${kind}`, gradeName: 'Synthetic storage governance regression',
    manufacturer: 'Synthetic fixture', manufacturerId: 'fixture', categoryIds: ['root_plastic'],
    createdAt: '2026-01-01', updatedAt: '2026-01-01', isExperimental: true,
    properties: { density: { ...raw, quantity } },
    governance: {
      sourceType: 'SYNTHETIC', recordStatus: 'NOT_FOR_RELEASE', confidentiality: 'INTERNAL',
      license: 'UNSPECIFIED', provenanceRefs: ['SYNTHETIC-REGRESSION'],
    },
  };
}

function storedRecord(): MaterialRecord {
  return JSON.parse(localStorage.getItem(LAB_KEY) || '[]')[0];
}

function readProduct(): Product {
  return UniversalStorageBridge.recordToProduct(UniversalStorageBridge.getLabRecords()[0]);
}

/** Controlled requests isolate mirror semantics; this is not a browser transaction test. */
function adapterFixture() {
  const rows = new Map<string, Product>();
  const store = {
    clear: async () => { rows.clear(); },
    add: async (row: Product) => { rows.set(row.id, structuredClone(row)); },
  };
  const database = {
    transaction: () => ({ store, done: Promise.resolve(), abort() {} }),
    getAll: async () => [...rows.values()].map(row => structuredClone(row)),
  };
  const adapter = Object.assign(new IndexedDBProductAdapter(), {
    getDB: async () => database, simulateLatency: async () => {},
  });
  return { adapter, rows };
}

describe('scientific quantity governance through public storage boundaries', () => {
  beforeEach(() => {
    const values = new Map<string, string>([[LAB_KEY, '[]']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
      removeItem: (key: string) => { values.delete(key); },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['UNKNOWN', 'INVALID'] as const)('does not promote an explicit %s during save/read/conversion', status => {
    const source = product(status);
    const original = structuredClone(source);
    UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(source, 'my_lab'));
    const expected = source.properties.density.quantity;
    expect(storedRecord().properties.density).toMatchObject(expected!);
    expect(readProduct().properties['密度'].quantity).toEqual(expected);
    expect(readProduct().governance).toEqual(source.governance);
    expect(source).toEqual(original);
  });

  it('does not treat a legacy marker accompanied by a rejection as initial validation', () => {
    const source = product('UNKNOWN');
    source.properties.density.quantity!.reasonCodes.unshift('UNVALIDATED_LEGACY_PROPERTY');
    UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(source, 'my_lab'));
    expect(readProduct().properties['密度'].quantity).toMatchObject({
      status: 'UNKNOWN', reasonCodes: expect.arrayContaining(['UNVALIDATED_LEGACY_PROPERTY', 'EXTERNAL_REVIEW_REQUIRED']),
    });
    expect(readProduct().properties['密度'].quantity?.canonical).toBeUndefined();
  });

  it('does not promote an explicitly UNKNOWN quantity carrying only the legacy marker', () => {
    const source = product('UNKNOWN');
    source.properties.density.quantity!.reasonCodes = ['UNVALIDATED_LEGACY_PROPERTY'];
    UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(source, 'my_lab'));
    expect(readProduct().properties['密度'].quantity).toEqual(source.properties.density.quantity);
    expect(readProduct().properties['密度'].quantity?.canonical).toBeUndefined();
  });

  it('quarantines a VALID canonical value that contradicts its preserved raw declaration', () => {
    const source = product('CONFLICT');
    UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(source, 'my_lab'));
    const quantity = readProduct().properties['密度'].quantity;
    expect(quantity).toMatchObject({
      raw: { value: 900, unit: 'kg/m³' }, status: 'INVALID',
      reasonCodes: expect.arrayContaining(['CANONICAL_RAW_MISMATCH']),
      provenanceRefs: ['SYNTHETIC-REGRESSION'],
    });
    expect(quantity?.canonical).toBeUndefined();
    expect(storedRecord().properties.density?.canonical).toBeUndefined();
  });

  it('keeps an already consistent VALID quantity and its governance', () => {
    const source = product('VALID');
    UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(source, 'my_lab'));
    expect(readProduct().properties['密度'].quantity).toEqual(source.properties.density.quantity);
    expect(readProduct().governance).toEqual(source.governance);
  });

  it('still admits a complete legacy density without an embedded quantity', () => {
    const source = product('VALID');
    delete source.properties.density.quantity;
    const intermediate = UniversalStorageBridge.productToRecord(source, 'my_lab');
    UniversalStorageBridge.saveLabRecord(intermediate);
    expect(readProduct().properties['密度'].quantity).toMatchObject({
      raw: { value: 900, unit: 'kg/m³' }, status: 'VALID',
      canonical: { value: 0.9, unit: 'g/cm³', dimension: 'mass_density' },
    });
  });

  it('keeps initial legacy Charpy and Izod normalization in their separate families', () => {
    const source = product('VALID');
    source.properties = {
      'Charpy Impact': { value: 12000, unit: 'J/m²', standard: 'ISO 179-1', referenceId: 'SYNTHETIC-CHARPY' },
      'Izod Impact': { value: 7, unit: 'kJ/m²', standard: 'ISO 180', referenceId: 'SYNTHETIC-IZOD' },
    };
    UniversalStorageBridge.saveLabRecord(UniversalStorageBridge.productToRecord(source, 'my_lab'));
    const returned = readProduct();
    expect(returned.properties['简支梁缺口冲击强度'].quantity).toMatchObject({
      status: 'VALID', canonical: { value: 12, unit: 'kJ/m²' },
      raw: { value: 12000, standard: 'ISO 179-1', referenceId: 'SYNTHETIC-CHARPY' },
    });
    expect(returned.properties['悬臂梁缺口冲击强度'].quantity).toMatchObject({
      status: 'VALID', canonical: { value: 7, unit: 'kJ/m²' },
      raw: { value: 7, standard: 'ISO 180', referenceId: 'SYNTHETIC-IZOD' },
    });
  });

  it.each(['UNKNOWN', 'INVALID'] as const)('keeps historical %s reads conservative without rewriting bytes', status => {
    const source = product(status);
    const bytes = JSON.stringify([UniversalStorageBridge.productToRecord(source, 'my_lab')], null, 2);
    localStorage.setItem(LAB_KEY, bytes);
    const write = vi.spyOn(localStorage, 'setItem');
    expect(readProduct().properties['密度'].quantity).toEqual(source.properties.density.quantity);
    expect(localStorage.getItem(LAB_KEY)).toBe(bytes);
    expect(write).not.toHaveBeenCalled();
  });

  it.each(['UNKNOWN', 'INVALID', 'CONFLICT'] as const)('preserves the governed %s state across snapshot and mirror restoration', async kind => {
    const source = product(kind);
    const original = structuredClone(source);
    const { adapter, rows } = adapterFixture();
    await adapter.restoreSnapshot([source]);
    const [authoritative] = await adapter.readAuthoritative();
    const quantity = authoritative.properties.density.quantity;
    expect(quantity?.status).toBe(kind === 'CONFLICT' ? 'INVALID' : kind);
    expect(readProduct().properties['密度'].quantity).toEqual(quantity);
    expect(storedRecord().properties.density).toMatchObject(quantity!);
    expect(rows.get(source.id)).toEqual(original);
    expect(source).toEqual(original);
  });
});
