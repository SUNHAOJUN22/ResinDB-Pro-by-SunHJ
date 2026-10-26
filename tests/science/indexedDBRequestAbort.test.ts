import { afterEach, describe, expect, it, vi } from 'vitest';
import { wrap } from 'idb';
import { IndexedDBProductAdapter } from '@/lib/adapters/IndexedDBProductAdapter';
import type { Product } from '@/types/index';

// Owned EventTarget fixtures exercise the real idb wrapper and its two separate
// request/transaction promises. This is not a native-browser IndexedDB test.
class RequestFixture extends EventTarget { error: DOMException | null = null; result: unknown; }
class CursorFixture { advance() {} continue() {} continuePrimaryKey() {} }
class StoreFixture {
  constructor(private transaction: TransactionFixture) {}
  get() { return this.transaction.failRequest(); }
  put() { return this.transaction.failRequest(); }
  add() { return this.transaction.failRequest(); }
  delete() { return this.transaction.failRequest(); }
  clear() { return this.transaction.failRequest(); }
}
class TransactionFixture extends EventTarget {
  error: DOMException | null = null;
  objectStoreNames = ['products'];
  storeFixture = new StoreFixture(this);
  requestError = new DOMException('Request failed before transaction completion', 'ConstraintError');
  objectStore() { return this.storeFixture; }
  abort() { this.dispatchEvent(new Event('abort')); }
  failRequest() {
    const request = new RequestFixture();
    queueMicrotask(() => {
      request.error = this.requestError;
      request.dispatchEvent(new Event('error'));
      this.error = new DOMException('Transaction aborted', 'AbortError');
      this.abort();
    });
    return request;
  }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('IndexedDB request failures preserve the original error and observe completion', () => {
  it.each(['batchUpdate', 'batchCreate', 'delete', 'restoreSnapshot'] as const)('%s observes tx.done before a request can reject', async operation => {
    vi.stubGlobal('IDBRequest', RequestFixture);
    vi.stubGlobal('IDBTransaction', TransactionFixture);
    vi.stubGlobal('IDBObjectStore', StoreFixture);
    vi.stubGlobal('IDBCursor', CursorFixture);
    vi.stubGlobal('IDBDatabase', class {});
    vi.stubGlobal('IDBIndex', class {});
    const raw = new TransactionFixture();
    const tx = wrap(raw as unknown as IDBTransaction);
    // The test runner observes rejection independently to keep a baseline
    // failure from becoming an unhandled-rejection failure in another test.
    void tx.done.catch(() => undefined);
    const observe = vi.spyOn(tx.done, 'catch');
    const sample: Product = { id: 'a', gradeName: 'A', manufacturer: 'Lab', manufacturerId: 'lab', categoryIds: [], properties: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
    const adapter = Object.assign(new IndexedDBProductAdapter(), {
      simulateLatency: async () => undefined,
      getDB: async () => ({ transaction: () => tx, getAll: async () => [sample] }),
    });
    const original = await adapter.search('', null);
    const pending = operation === 'batchUpdate' ? adapter.batchUpdate(['a'], { manufacturer: 'Changed' })
      : operation === 'batchCreate' ? adapter.batchCreate([sample])
        : operation === 'delete' ? adapter.delete(['a']) : adapter.restoreSnapshot([]);
    await expect(pending).rejects.toBe(raw.requestError);
    expect(await adapter.search('', null)).toEqual(original);
    expect(observe).toHaveBeenCalled();
  });
});
