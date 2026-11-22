import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDBProductAdapter } from '@/lib/adapters/IndexedDBProductAdapter';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';
import type { MaterialRecord } from '@/lib/adapters/types';
import type { Product } from '@/types/index';

const LAB_KEY = 'resindb_pro_my_lab_data';
const OPEN_KEY = 'resindb_pro_open_market_data';

function product(id: string, gradeName = id, isExperimental = true): Product {
  return {
    id, gradeName, manufacturer: 'Synthetic regression fixture', manufacturerId: 'synthetic',
    categoryIds: ['root_plastic'], properties: {}, isExperimental,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

/** Controlled IndexedDB request fixture; the actual adapter and storage bridge run. */
function storage(initial: Product[]) {
  const rows = new Map(initial.map(row => [row.id, structuredClone(row)]));
  const store = {
    get: async (id: string) => structuredClone(rows.get(id)),
    put: async (row: Product) => { rows.set(row.id, structuredClone(row)); },
    add: async (row: Product) => {
      if (rows.has(row.id)) throw new DOMException('Duplicate fixture identity', 'ConstraintError');
      rows.set(row.id, structuredClone(row));
    },
    delete: async (id: string) => { rows.delete(id); },
    clear: async () => { rows.clear(); },
  };
  const database = {
    get: async (_name: string, id: string) => store.get(id),
    getAll: async () => [...rows.values()].map(row => structuredClone(row)),
    add: async (_name: string, row: Product) => store.add(row),
    put: async (_name: string, row: Product) => store.put(row),
    transaction: () => ({ store, done: Promise.resolve(), abort() {} }),
  };
  const adapter = new IndexedDBProductAdapter();
  Object.assign(adapter, { getDB: async () => database, simulateLatency: async () => {} });
  return { adapter, database, rows };
}

function mirrorIds() {
  return UniversalStorageBridge.getLabRecords().map(row => row.id).sort();
}

describe('committed product state and experimental storage mirror', () => {
  beforeEach(() => {
    const values = new Map<string, string>([[LAB_KEY, '[]'], [OPEN_KEY, 'preserve-open-market-bytes']]);
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

  it('removes an undone experimental create from both the catalog and lab mirror', async () => {
    const { adapter } = storage([]);
    const beforeCreate = await adapter.readAuthoritative();
    await adapter.create(product('created'));
    expect(mirrorIds()).toEqual(['created']);
    await adapter.restoreSnapshot(beforeCreate);
    expect(await adapter.readAuthoritative()).toEqual([]);
    expect(mirrorIds()).toEqual([]);
    expect(localStorage.getItem(OPEN_KEY)).toBe('preserve-open-market-bytes');
  });

  it('restores a deleted experimental record to the mirror', async () => {
    const original = product('restored');
    const { adapter } = storage([]);
    await adapter.restoreSnapshot([original]);
    expect((await adapter.readAuthoritative()).map(row => row.id)).toEqual(['restored']);
    expect(mirrorIds()).toEqual(['restored']);
  });

  it('reconciles the whole snapshot, including restored content and removed identities', async () => {
    const { adapter } = storage([]);
    await adapter.create(product('kept', 'newer'));
    await adapter.create(product('removed'));
    await adapter.restoreSnapshot([product('kept', 'historical'), product('market', 'market', false)]);
    expect(mirrorIds()).toEqual(['kept']);
    expect(UniversalStorageBridge.getLabRecords()[0].grade).toBe('historical');
  });

  it.each(['mfr', 'MFR'])('preserves unrepresented laboratory metadata without reviving removed %s', async key => {
    const original: MaterialRecord = {
      id: 'metadata', source: 'my_lab', grade: 'Synthetic metadata fixture',
      manufacturer: 'Synthetic regression fixture', category: 'HDPE', timestamp: Date.parse('2026-01-01'),
      batchNo: 'SYNTHETIC-BATCH', description: 'Original laboratory annotation',
      properties: {
        density: { value: 0.95, unit: 'g/cm³' },
        [key]: { value: 2, unit: 'g/10min', method: 'ISO 1133', temperature: 190, load: 2.16 },
        customObservation: { value: 'retained source observation', referenceId: 'SYNTHETIC-SOURCE' },
      },
    };
    localStorage.setItem(LAB_KEY, JSON.stringify([original]));
    const snapshot = UniversalStorageBridge.recordToProduct(original);
    delete snapshot.properties['熔体质量流动速率'];
    const { adapter } = storage([snapshot]);
    await adapter.restoreSnapshot([snapshot]);
    const [restored] = JSON.parse(localStorage.getItem(LAB_KEY) || '[]') as MaterialRecord[];
    expect(restored.batchNo).toBe(original.batchNo);
    expect(restored.description).toBe(original.description);
    expect(restored.properties.customObservation).toEqual(original.properties.customObservation);
    expect(restored.properties[key]).toBeUndefined();
    expect(restored.properties.density?.status).toBe('VALID');
  });

  it('preserves source-only metadata while the snapshot owns governed quantities and record status', async () => {
    const previous: MaterialRecord = {
      ...UniversalStorageBridge.productToRecord(product('kept')),
      batchNo: 'SYNTHETIC-BATCH', description: 'Preserve this source annotation',
      properties: {
        Density: { value: 0.95, unit: 'g/cm³' },
        MFR: { value: 2, unit: 'g/10min' },
        '熔体质量流动速率(MFR)': { value: 3, unit: 'g/10min' },
        glassTransition: {
          value: 90, unit: '°C', raw: { value: 90, unit: '°C' },
          status: 'INVALID', reasonCodes: ['SOURCE_REVIEW_REQUIRED'], provenanceRefs: ['ORIGINAL-SOURCE'],
        },
      },
      governance: {
        sourceType: 'IMPORTED', recordStatus: 'IMPORTED', confidentiality: 'RESTRICTED',
        license: 'PROJECT-CONTROLLED', provenanceRefs: ['ORIGINAL-SOURCE'],
      },
    };
    const snapshot: Product = {
      ...product('kept'),
      properties: {
        density: {
          value: 1000, unit: 'kg/m³', quantity: {
            raw: { value: 1000, unit: 'kg/m³' }, status: 'UNKNOWN',
            reasonCodes: ['SNAPSHOT_REVIEW_REQUIRED'], provenanceRefs: ['SNAPSHOT-SOURCE'],
          },
        },
      },
      governance: {
        sourceType: 'SYNTHETIC', recordStatus: 'NOT_FOR_RELEASE', confidentiality: 'INTERNAL',
        license: 'UNSPECIFIED', provenanceRefs: ['SNAPSHOT-SOURCE'],
      },
    };
    const before = structuredClone({ previous, snapshot });
    localStorage.setItem(LAB_KEY, JSON.stringify([previous, UniversalStorageBridge.productToRecord(product('removed'))]));
    const { adapter } = storage([]);
    await adapter.restoreSnapshot([snapshot]);
    const records = JSON.parse(localStorage.getItem(LAB_KEY) || '[]') as MaterialRecord[];
    expect(records.map(record => record.id)).toEqual(['kept']);
    const [restored] = records;
    expect(restored.batchNo).toBe(previous.batchNo);
    expect(restored.description).toBe(previous.description);
    expect(Object.keys(restored.properties).sort()).toEqual(['density', 'glassTransition']);
    expect(restored.properties.glassTransition).toEqual(previous.properties.glassTransition);
    expect(restored.properties.density).toMatchObject(snapshot.properties.density.quantity!);
    expect(restored.properties.density?.canonical).toBeUndefined();
    expect(restored.governance).toEqual(snapshot.governance);
    expect({ previous, snapshot }).toEqual(before);
  });

  it.each(['update', 'batchUpdate', 'importRecords'] as const)('%s removes a record reclassified as nonexperimental from the mirror', async operation => {
    const { adapter } = storage([]);
    const saved = await adapter.create(product('reclassified'));
    if (operation === 'update') await adapter.update({ ...saved, isExperimental: false });
    else if (operation === 'batchUpdate') await adapter.batchUpdate([saved.id], { isExperimental: false });
    else await adapter.importRecords([{ ...saved, isExperimental: false }]);
    expect((await adapter.readAuthoritative())[0].isExperimental).toBe(false);
    expect(mirrorIds()).toEqual([]);
  });

  it('keeps the established experimental update behavior', async () => {
    const { adapter } = storage([]);
    const saved = await adapter.create(product('unchanged-kind'));
    await adapter.update({ ...saved, gradeName: 'new grade' });
    expect(mirrorIds()).toEqual(['unchanged-kind']);
    expect(UniversalStorageBridge.getLabRecords()[0].grade).toBe('new grade');
  });

  it.each(['update', 'batchUpdate', 'importRecords'] as const)('%s does not create a lab mirror for an unrelated commercial record', async operation => {
    const original = product('commercial-only', 'commercial-only', false);
    const { adapter } = storage([original]);
    localStorage.removeItem(LAB_KEY);
    const write = vi.spyOn(localStorage, 'setItem');
    if (operation === 'update') await adapter.update({ ...original, gradeName: 'changed' });
    else if (operation === 'batchUpdate') await adapter.batchUpdate([original.id], { gradeName: 'changed' });
    else await adapter.importRecords([{ ...original, gradeName: 'changed' }]);
    expect((await adapter.readAuthoritative())[0].gradeName).toBe('changed');
    expect(localStorage.getItem(LAB_KEY)).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('validates every replacement record before publishing a new mirror', () => {
    const raw = JSON.stringify([UniversalStorageBridge.productToRecord(product('original'))]);
    localStorage.setItem(LAB_KEY, raw);
    const write = vi.spyOn(localStorage, 'setItem');
    expect(() => UniversalStorageBridge.replaceLabRecords([
      UniversalStorageBridge.productToRecord(product('replacement')),
      null as unknown as MaterialRecord,
    ])).toThrow('INVALID_MATERIAL_RECORD');
    expect(localStorage.getItem(LAB_KEY)).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });

  it('preserves existing mirror bytes if its write fails after the catalog commits', async () => {
    const { adapter } = storage([]);
    await adapter.create(product('original'));
    const raw = localStorage.getItem(LAB_KEY);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
    });
    await adapter.restoreSnapshot([product('replacement')]);
    expect((await adapter.readAuthoritative()).map(row => row.id)).toEqual(['replacement']);
    expect(localStorage.getItem(LAB_KEY)).toBe(raw);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('does not publish a replacement mirror before the storage transaction commits', async () => {
    const { adapter, database } = storage([]);
    await adapter.create(product('original'));
    let rejectCompletion!: (error: Error) => void;
    const done = new Promise<void>((_resolve, reject) => { rejectCompletion = reject; });
    let requestsIssued!: () => void;
    const issued = new Promise<void>(resolve => { requestsIssued = resolve; });
    const transaction = {
      store: {
        clear: async () => {},
        add: async () => { requestsIssued(); },
      },
      done,
      abort() {},
    };
    Object.assign(database, { transaction: () => transaction });
    const restoration = adapter.restoreSnapshot([product('replacement')]);
    const failure = new Error('Synthetic storage transaction abort');
    const rejected = expect(restoration).rejects.toBe(failure);
    await issued;
    expect(mirrorIds()).toEqual(['original']);
    rejectCompletion(failure);
    await rejected;
    expect(mirrorIds()).toEqual(['original']);
  });

  it('does not erase unreadable existing lab bytes during best-effort mirroring', async () => {
    const { adapter } = storage([]);
    localStorage.setItem(LAB_KEY, '{broken input');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await adapter.restoreSnapshot([product('restored')]);
    expect(localStorage.getItem(LAB_KEY)).toBe('{broken input');
    expect((await adapter.readAuthoritative()).map(row => row.id)).toEqual(['restored']);
    error.mockRestore();
  });
});
