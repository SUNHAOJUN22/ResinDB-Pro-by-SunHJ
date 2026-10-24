import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { IndexedDBProductAdapter } from '@/lib/adapters/IndexedDBProductAdapter';
import { nativeImportRecord } from '@/lib/importProductRecord';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import type { Product } from '@/types/index';

const record = (): Product => ({
  id: 'p&"1', gradeName: '<Grade & "one">', manufacturer: 'M & N', manufacturerId: 'm', categoryIds: ['a&b'], createdAt: '2026-10-22', updatedAt: '2026-10-22', priority: 8, tags: ['private'],
  properties: { density: { value: 1000, unit: 'kg/m³', method: 'ISO 1183', sampleId: 'sample-A', batchId: 'batch-B', provenanceRefs: ['source'], quantity: canonicalizeCoreProperty('density', { value: 1000, unit: 'kg/m³' }, ['source']) } },
  governance: { sourceType: 'IMPORTED', recordStatus: 'NOT_FOR_RELEASE', confidentiality: 'RESTRICTED', license: 'private & review', provenanceRefs: ['source'] },
});
const text = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob); });
const adapter = () => Object.assign(new IndexedDBProductAdapter(), { simulateLatency: async () => undefined });

describe('actual adapter metadata and structured export contracts', () => {
  it('round-trips full JSON declarations without loss', async () => {
    const original = record();
    const output = JSON.parse(await text(await adapter().exportReport([original], 'json')));
    expect(nativeImportRecord(output[0])).toEqual(original);
  });
  it('round-trips CSV through RecordJSON including units, quantity and governance', async () => {
    const original = record();
    const csv = await text(await adapter().exportReport([original], 'csv'));
    const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true });
    expect(parsed.errors).toEqual([]);
    expect(parsed.meta.fields).toContain('PropertiesJSON');
    expect(nativeImportRecord(parsed.data[0])).toEqual(original);
  });
  it('neutralizes spreadsheet formulas in CSV display cells while retaining lossless RecordJSON', async () => {
    const original: Product = {
      ...record(),
      id: '=HYPERLINK("https://example.invalid","open")',
      gradeName: ' =1+1',
      manufacturer: '\t=HYPERLINK("https://example.invalid","open")',
      categoryIds: ['-1+1'],
      properties: {
        ...record().properties,
        '@SUM(1,1)': { value: '+2+2', unit: 'unit' },
        '＝1+1': { value: '\r\n=1+1', unit: 'text' },
      },
    };

    const csv = await text(await adapter().exportReport([original], 'csv'));
    const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true });
    const row = parsed.data[0];

    expect(parsed.errors).toEqual([]);
    expect(row.ID).toBe(`\t${original.id}`);
    expect(row.Grade).toBe(`\t${original.gradeName}`);
    expect(row.Manufacturer).toBe(`'${original.manufacturer}`);
    expect(row.Category).toBe('\t-1+1');
    expect(parsed.meta.fields).toContain('\t@SUM(1,1)');
    expect(row['\t@SUM(1,1)']).toBe('\t+2+2');
    expect(parsed.meta.fields).toContain("'＝1+1");
    expect(row["'＝1+1"]).toBe("'\r\n=1+1");
    expect(nativeImportRecord(row)).toEqual(original);

    const alternateSeparatorCsv = await text(await adapter().exportReport([
      { ...original, manufacturer: 'Vendor;=1+1' },
    ], 'csv'));
    expect(alternateSeparatorCsv).toContain('"Vendor;=1+1"');
  });
  it('escapes XML identities and preserves complete property/governance payloads', async () => {
    const original = record();
    const xml = new DOMParser().parseFromString(await text(await adapter().exportReport([original], 'xml')), 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect(xml.querySelector('Product')?.getAttribute('id')).toBe(original.id);
    expect(xml.querySelector('GradeName')?.textContent).toBe(original.gradeName);
    expect(JSON.parse(xml.querySelector('Metadata')!.textContent!)).toEqual(original.properties.density);
    expect(JSON.parse(xml.querySelector('Governance')!.textContent!)).toEqual(original.governance);
  });
  it('preserves governance, tags and priority in both create paths', async () => {
    const stored: Product[] = [];
    const add = async (_store: string | Product, product?: Product) => { stored.push(product ?? _store as Product); };
    const instance = adapter();
    Object.assign(instance, { getDB: async () => ({ add, transaction: () => ({ store: { add }, done: Promise.resolve() }) }) });
    const created = await instance.create(record());
    const [batched] = await instance.batchCreate([{ ...record(), id: 'second' }]);
    for (const product of [created, batched]) expect(product).toMatchObject({ governance: record().governance, tags: ['private'], priority: 8 });
    expect(stored).toHaveLength(2);
  });
  it('recanonicalizes batch edits while preserving metadata and updating the cache after commit', async () => {
    const original = record();
    const stored: Product[] = [];
    const instance = adapter();
    Object.assign(instance, { cachedProducts: [original], getDB: async () => ({ transaction: () => ({ store: { get: async () => original, put: async (value: Product) => { stored.push(value); } }, done: Promise.resolve() }) }) });
    await instance.batchUpdate([original.id], { _propertyUpdates: { density: 1200 } });
    expect(stored[0].properties.density).toMatchObject({ value: 1200, sampleId: 'sample-A', batchId: 'batch-B', quantity: { canonical: { value: 1.2 } } });
    expect((await instance.search('', null))[0].properties.density).toEqual(stored[0].properties.density);
  });
  it('does not poison the cache when the database transaction fails', async () => {
    const original = record();
    let reject!: (reason: Error) => void;
    const done = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
    const instance = adapter();
    Object.assign(instance, { cachedProducts: [original], getDB: async () => ({ transaction: () => ({ store: { get: async () => original, put: async () => { reject(new Error('transaction aborted')); } }, done }) }) });
    await expect(instance.batchUpdate([original.id], { _propertyUpdates: { density: 1200 } })).rejects.toThrow('transaction aborted');
    expect((await instance.search('', null))[0]).toEqual(original);
  });
  it('rejects malformed governance and quantity payloads instead of flattening them', () => {
    expect(() => nativeImportRecord({ ...record(), governance: { confidentiality: 'PUBLIC' } })).toThrow();
    expect(() => nativeImportRecord({ ...record(), properties: { density: { value: 1, quantity: { status: 'VALID' } } } })).toThrow();
  });
});

describe('import persistence and duplicate identities', () => {
  it('uses incoming nested quantity provenance when replacing a measured value', async () => {
    const original = record();
    const incoming: Product = {
      ...original,
      properties: {
        density: {
          value: 950,
          unit: 'kg/m³',
          quantity: canonicalizeCoreProperty('density', { value: 950, unit: 'kg/m³' }, ['source:new']),
        },
      },
    };
    const stored: Product[] = [];
    const instance = adapter();
    Object.assign(instance, {
      getDB: async () => ({
        transaction: () => ({
          store: {
            get: async (id: string) => id === original.id ? original : undefined,
            put: async (product: Product) => { stored.push(product); },
          },
          done: Promise.resolve(),
        }),
      }),
    });

    const [imported] = await instance.importRecords([incoming]);

    expect(stored[0].properties.density.quantity).toMatchObject({
      raw: { value: 950, unit: 'kg/m³' },
      provenanceRefs: ['source:new'],
    });
    expect(imported.properties.density.quantity?.provenanceRefs).toEqual(['source:new']);
  });

  it('updates nested quantity provenance when the raw measurement is unchanged', async () => {
    const original = record();
    const incoming: Product = {
      ...original,
      properties: {
        density: {
          value: 1000,
          unit: 'kg/m³',
          quantity: canonicalizeCoreProperty('density', { value: 1000, unit: 'kg/m³' }, ['source:new']),
        },
      },
    };
    const stored: Product[] = [];
    const instance = adapter();
    Object.assign(instance, {
      getDB: async () => ({
        transaction: () => ({
          store: {
            get: async (id: string) => id === original.id ? original : undefined,
            put: async (product: Product) => { stored.push(product); },
          },
          done: Promise.resolve(),
        }),
      }),
    });

    const [imported] = await instance.importRecords([incoming]);

    expect(stored[0].properties.density.quantity?.provenanceRefs).toEqual(['source:new']);
    expect(imported.properties.density.quantity?.provenanceRefs).toEqual(['source:new']);
  });

  it('atomically replaces existing IDs and adds new IDs without duplicate cache entries', async () => {
    const original = record();
    const stored: Product[] = [];
    const instance = adapter();
    Object.assign(instance, { cachedProducts: [original], getDB: async () => ({ transaction: () => ({ store: { get: async (id: string) => id === original.id ? original : undefined, put: async (product: Product) => { stored.push(product); } }, done: Promise.resolve() }) }) });
    const imported = await instance.importRecords([{ ...original, gradeName: 'Updated', properties: { density: { ...original.properties.density, value: 1200 } } }, { ...record(), id: 'new-id' }]);
    expect(imported).toHaveLength(2);
    expect(stored[0].properties.density.quantity?.canonical?.value).toBe(1.2);
    expect(stored[0].governance).toEqual(original.governance);
    const result = await instance.search('', null);
    expect(result).toHaveLength(2);
    expect(new Set(result.map(product => product.id)).size).toBe(2);
    expect(result.find(product => product.id === original.id)?.gradeName).toBe('Updated');
  });
  it('leaves cache untouched after an import transaction aborts', async () => {
    const original = record();
    let reject!: (error: Error) => void;
    const done = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
    const instance = adapter();
    Object.assign(instance, { cachedProducts: [original], getDB: async () => ({ transaction: () => ({ store: { get: async () => original, put: async () => { reject(new Error('atomic import aborted')); } }, abort() {}, done }) }) });
    await expect(instance.importRecords([{ ...original, gradeName: 'Not committed' }])).rejects.toThrow('atomic import aborted');
    expect((await instance.search('', null))[0]).toEqual(original);
  });
  it('routes existing remote IDs through update and detects partial create responses', async () => {
    const { persistImportedProducts } = await import('@/lib/importProducts');
    const { vi } = await import('vitest');
    const original = record();
    const update = vi.fn(async (product: Product) => product);
    const batchCreate = vi.fn(async (products: Partial<Product>[]) => products as Product[]);
    const remote = Object.assign(adapter(), { importRecords: undefined, update, batchCreate });
    const incoming = [{ ...original, gradeName: 'Updated' }, { ...original, id: 'new' }];
    expect(await persistImportedProducts(remote, incoming, [original])).toHaveLength(2);
    expect(update).toHaveBeenCalledWith(incoming[0]);
    expect(batchCreate).toHaveBeenCalledWith([incoming[1]]);
    batchCreate.mockResolvedValue([]);
    await expect(persistImportedProducts(remote, [incoming[1]], [])).rejects.toThrow('IMPORT_CREATE_RESULT_MISMATCH');
  });
});
