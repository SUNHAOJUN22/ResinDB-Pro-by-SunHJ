import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDBProductAdapter } from '@/lib/adapters/IndexedDBProductAdapter';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';
import type { MaterialRecord } from '@/lib/adapters/types';

const LAB_KEY = 'resindb_pro_my_lab_data';

const labRecord: MaterialRecord = {
  id: 'lab-transaction-1',
  source: 'my_lab',
  category: 'PP',
  grade: 'PP-LAB-TRANSACTION-1',
  manufacturer: 'Synthetic transaction regression',
  properties: { density: { value: 0.91, unit: 'g/cm³' } },
  timestamp: 0,
};
const secondLabRecord: MaterialRecord = {
  ...labRecord,
  id: 'lab-transaction-2',
  grade: 'PP-LAB-TRANSACTION-2',
};

describe('IndexedDB product deletion transaction', () => {
  beforeEach(() => {
    const values: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values[key] ?? null,
        setItem: (key: string, value: string) => { values[key] = String(value); },
        removeItem: (key: string) => { delete values[key]; },
        clear: () => { for (const key in values) delete values[key]; },
      },
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('preserves the lab mirror when the IndexedDB transaction aborts', async () => {
    const original = JSON.stringify([labRecord, secondLabRecord]);
    localStorage.setItem(LAB_KEY, original);

    const deleteRequest = vi.fn().mockResolvedValue(undefined);
    let rejectTransaction!: (reason: DOMException) => void;
    const done = new Promise<void>((_resolve, reject) => {
      rejectTransaction = reject;
    });
    const transaction = { store: { delete: deleteRequest }, done };
    const database = { transaction: vi.fn(() => transaction) };
    const adapter = new IndexedDBProductAdapter();
    vi.spyOn(adapter as any, 'getDB').mockResolvedValue(database);

    const abortError = new DOMException('Synthetic transaction abort', 'AbortError');
    const deletion = adapter.delete([labRecord.id, secondLabRecord.id]);
    await vi.waitFor(() => expect(deleteRequest).toHaveBeenCalledTimes(2));
    rejectTransaction(abortError);

    await expect(deletion).rejects.toBe(abortError);
    expect(localStorage.getItem(LAB_KEY)).toBe(original);
    expect(UniversalStorageBridge.getLabRecords().map((record) => record.id)).toEqual([
      labRecord.id,
      secondLabRecord.id,
    ]);
  });
});
