import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductUpdates } from '@/types/index';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import { FormulaEngine } from '@/lib/formulaParser';

const mocks = vi.hoisted(() => ({
  search: vi.fn(), create: vi.fn(), update: vi.fn(), batchUpdate: vi.fn(),
  delete: vi.fn(), batchCreate: vi.fn(), restoreSnapshot: vi.fn(),
  toast: vi.fn(), history: vi.fn(), sidebar: vi.fn(),
  translate: (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock('@/lib/adapters', () => ({ default: mocks }));
vi.mock('@/hooks/datagrid/useColumns', () => ({ useColumns: () => ({ columns: [] }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: mocks.translate, tProp: mocks.translate, language: 'en' }) }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: mocks.toast }) }));
vi.mock('@/contexts/UIContext', () => ({ useUI: () => ({ setShowSidebar: mocks.sidebar }) }));
vi.mock('@/hooks/app/useHistory', () => ({ useHistory: () => ({ history: [], pushToHistory: mocks.history, restoreSnapshot: vi.fn() }) }));
import { DataProvider, useData } from '@/contexts/DataContext';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function product(id: string): Product {
  return {
    id, gradeName: `Grade ${id}`, manufacturer: 'Lab', manufacturerId: 'lab',
    categoryIds: [], properties: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}
let stored: Product[];
const wrapper = ({ children }: { children: React.ReactNode }) => <DataProvider>{children}</DataProvider>;
async function start() {
  const hook = renderHook(() => useData(), { wrapper });
  await waitFor(() => expect(hook.result.current.allProducts).toHaveLength(stored.length));
  return hook;
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear(); sessionStorage.clear();
  stored = [product('a'), product('b')];
  mocks.search.mockImplementation(async () => structuredClone(stored));
  mocks.update.mockImplementation(async (incoming: Product) => {
    stored = stored.map(row => row.id === incoming.id ? structuredClone(incoming) : row);
    return structuredClone(incoming);
  });
  mocks.batchUpdate.mockImplementation(async (ids: string[], updates: ProductUpdates) => {
    stored = stored.map(row => ids.includes(row.id) ? { ...row, ...structuredClone(updates) } : row);
  });
});
afterEach(cleanup);

describe('product mutations preserve the authoritative database under overlap', () => {
  it('does not erase a later successful product update when an earlier update fails', async () => {
    const failed = deferred<Product>();
    mocks.update.mockImplementationOnce(() => failed.promise);
    mocks.batchUpdate.mockImplementation(async (ids: string[], updates: ProductUpdates) => {
      if (updates.gradeName === 'Uncommitted A') return failed.promise;
      stored = stored.map(row => ids.includes(row.id) ? { ...row, ...updates } : row);
    });
    const hook = await start();
    let first!: Promise<unknown>;
    act(() => { first = hook.result.current.handleUpdate({ ...stored[0], gradeName: 'Uncommitted A' }); });
    await act(async () => { await hook.result.current.handleUpdate({ ...stored[1], gradeName: 'Committed B' }); });
    await act(async () => { failed.reject(new Error('A rejected')); await first; });
    expect(hook.result.current.allProducts).toEqual(stored);
    expect(hook.result.current.allProducts.find(row => row.id === 'b')?.gradeName).toBe('Committed B');
  });

  it('does not persist a pending failed name through the unrelated tagging operation', async () => {
    const failed = deferred<Product>();
    mocks.update.mockImplementationOnce(() => failed.promise);
    mocks.batchUpdate.mockImplementation(async (ids: string[], updates: ProductUpdates) => {
      if (updates.gradeName === 'Uncommitted A') return failed.promise;
      stored = stored.map(row => ids.includes(row.id) ? { ...row, ...updates } : row);
    });
    const hook = await start();
    let first!: Promise<unknown>;
    act(() => { first = hook.result.current.handleUpdate({ ...stored[0], gradeName: 'Uncommitted A' }); });
    await act(async () => { await hook.result.current.handleBatchTagging(['a'], ['reviewed'], 'append'); });
    await act(async () => { failed.reject(new Error('A rejected')); await first; });
    expect(stored[0].gradeName).toBe('Grade a');
    expect(stored[0].tags).toEqual(['reviewed']);
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('reconciles all partial tagging writes before reporting the batch failure', async () => {
    const later = deferred<Product>();
    // Baseline uses full updates; the corrected scoped path uses batchUpdate.
    mocks.update.mockImplementation((incoming: Product) => {
      if (incoming.id === 'a') return Promise.reject(new Error('A rejected'));
      return later.promise.then(() => {
        stored[1] = structuredClone(incoming); return incoming;
      });
    });
    mocks.batchUpdate.mockImplementation((ids: string[], updates: ProductUpdates) => {
      if (ids.includes('a')) return Promise.reject(new Error('A rejected'));
      return later.promise.then(() => { stored[1] = { ...stored[1], ...updates }; });
    });
    const hook = await start();
    let settled = false;
    let tagging!: Promise<unknown>;
    act(() => { tagging = hook.result.current.handleBatchTagging(['a', 'b'], ['tag'], 'append').then(() => { settled = true; }); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const settledBeforeRemainingWrite = settled;
    await act(async () => { later.resolve(product('b')); await tagging; });
    expect(settledBeforeRemainingWrite).toBe(false);
    expect(hook.result.current.allProducts).toEqual(stored);
    expect(stored[1].tags).toEqual(['tag']);
  });

  it('serializes conflicting scoped writes so an older completion cannot overwrite the newer value', async () => {
    const gate = deferred();
    mocks.batchUpdate.mockImplementationOnce(async (ids: string[], updates: ProductUpdates) => {
      await gate.promise;
      stored = stored.map(row => ids.includes(row.id) ? { ...row, ...updates } : row);
    });
    const hook = await start();
    let older!: Promise<unknown>; let newer!: Promise<unknown>;
    act(() => { older = hook.result.current.handleBatchUpdate(['a'], { manufacturer: 'Older' }); });
    await waitFor(() => expect(mocks.batchUpdate).toHaveBeenCalledTimes(1));
    act(() => { newer = hook.result.current.handleBatchUpdate(['a'], { manufacturer: 'Newer' }); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const callsBeforeRelease = mocks.batchUpdate.mock.calls.length;
    await act(async () => { gate.resolve(); await Promise.all([older, newer]); });
    expect(callsBeforeRelease).toBe(1);
    expect(stored[0].manufacturer).toBe('Newer');
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('uses canonical quantities in the optimistic view while the actual batch write is pending', async () => {
    stored[0].properties.density = { value: 900, unit: 'kg/m³', quantity: canonicalizeCoreProperty('density', { value: 900, unit: 'kg/m³' }, ['sample-a']) };
    const gate = deferred();
    mocks.batchUpdate.mockImplementationOnce(() => gate.promise);
    const hook = await start();
    let pending!: Promise<unknown>;
    act(() => { pending = hook.result.current.handleBatchUpdate(['a'], { _propertyUpdates: { density: 1200 } }); });
    const evaluate = new FormulaEngine().compileResultGraph([{ id: 'density-copy', name: 'Density copy', expression: "p['density']", unit: 'g/cm³' }]);
    const result = evaluate(hook.result.current.allProducts[0])['density-copy'];
    await act(async () => { gate.reject(new Error('Deliberate rollback')); await pending; });
    expect(result).toMatchObject({ status: 'OK', value: 1.2 });
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('keeps writes blocked after failed authoritative reconciliation until refresh succeeds', async () => {
    const hook = await start();
    mocks.search.mockRejectedValue(new Error('readback unavailable'));
    await act(async () => { await hook.result.current.handleBatchUpdate(['a'], { manufacturer: 'Persisted' }); });
    const callsAfterFirst = mocks.batchUpdate.mock.calls.length;
    await act(async () => { await hook.result.current.handleBatchUpdate(['b'], { manufacturer: 'Must wait' }); });
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(callsAfterFirst);
    expect(mocks.toast.mock.calls.some(call => call[0] === 'error')).toBe(true);
    mocks.search.mockImplementation(async () => structuredClone(stored));
    await act(async () => { await hook.result.current.refreshData(); });
    await act(async () => { await hook.result.current.handleBatchUpdate(['b'], { manufacturer: 'Recovered' }); });
    expect(stored[1].manufacturer).toBe('Recovered');
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('rejects updates of absent identities instead of reporting a successful empty write', async () => {
    const hook = await start();
    await act(async () => { await hook.result.current.handleBatchUpdate(['absent'], { manufacturer: 'Nowhere' }); });
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
    expect(mocks.toast.mock.calls.some(call => call[0] === 'success')).toBe(false);
    expect(mocks.toast.mock.calls.some(call => call[0] === 'error')).toBe(true);
  });
  it('keeps a later settled intent projected while an older readback is in flight', async () => {
    const hook = await start();
    const oldRead = deferred<Product[]>();
    const newRead = deferred<Product[]>();
    let oldSnapshot: Product[] = [];
    mocks.search.mockImplementationOnce(() => { oldSnapshot = structuredClone(stored); return oldRead.promise; });
    mocks.search.mockImplementationOnce(() => newRead.promise);
    let first!: Promise<unknown>; let second!: Promise<unknown>;
    act(() => { first = hook.result.current.handleBatchUpdate(['a'], { manufacturer: 'Committed A' }); });
    await waitFor(() => expect(mocks.search).toHaveBeenCalledTimes(2));
    act(() => { second = hook.result.current.handleBatchUpdate(['b'], { manufacturer: 'Committed B' }); });
    await waitFor(() => expect(stored[1].manufacturer).toBe('Committed B'));
    await act(async () => { oldRead.resolve(oldSnapshot); await first; });
    expect(hook.result.current.allProducts[1].manufacturer).toBe('Committed B');
    await act(async () => { newRead.resolve(structuredClone(stored)); await second; });
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('replays only editor-dirty fields on a newer confirmed row', async () => {
    const original = structuredClone(stored[0]);
    const hook = await start();
    await act(async () => { await hook.result.current.handleBatchUpdate(['a'], { manufacturer: 'New confirmed manufacturer' }); });
    await act(async () => { await hook.result.current.handleUpdate({ ...original, gradeName: 'Edited name' }, original); });
    expect(stored[0]).toMatchObject({ gradeName: 'Edited name', manufacturer: 'New confirmed manufacturer' });
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('never treats a public UI-only setter as confirmed storage for subsequent tagging', async () => {
    const hook = await start();
    act(() => { hook.result.current.setAllProducts(rows => rows.map(row => ({ ...row, manufacturer: 'Display-only override' }))); });
    await act(async () => { await hook.result.current.handleBatchTagging(['a'], ['tag'], 'append'); });
    expect(stored[0].manufacturer).toBe('Lab');
    expect(stored[0].tags).toEqual(['tag']);
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('holds existing-row writes behind creation and refuses the provisional identity', async () => {
    const created = deferred<Product>();
    mocks.create.mockImplementationOnce(async () => { const row = await created.promise; stored.push(row); return row; });
    const hook = await start();
    let creation!: Promise<unknown>; let edit!: Promise<unknown>;
    act(() => { creation = hook.result.current.handleCreate({ gradeName: 'New row' }); });
    const temporary = hook.result.current.allProducts.find(row => row.id.startsWith('temp-'))!.id;
    await act(async () => { await hook.result.current.handleBatchUpdate([temporary], { manufacturer: 'Invalid provisional update' }); });
    act(() => { edit = hook.result.current.handleBatchUpdate(['a'], { manufacturer: 'After creation' }); });
    await act(async () => { await Promise.resolve(); });
    const callsBeforeCreate = mocks.batchUpdate.mock.calls.length;
    await act(async () => { created.resolve(product('created')); await Promise.all([creation, edit]); });
    expect(callsBeforeCreate).toBe(0);
    expect(stored[0].manufacturer).toBe('After creation');
    expect(hook.result.current.allProducts).toEqual(stored);
  });

  it('reconciles a partial remote import without claiming the whole import succeeded', async () => {
    mocks.batchCreate.mockRejectedValueOnce(new Error('Remote create rejected after update'));
    const hook = await start();
    let imported: boolean | undefined;
    await act(async () => { imported = await hook.result.current.handleImportData([{ ...stored[0], gradeName: 'Imported existing' }, product('new')]); });
    expect(imported).toBe(false);
    expect(stored[0].gradeName).toBe('Imported existing');
    expect(hook.result.current.allProducts).toEqual(stored);
    expect(mocks.toast.mock.calls.some(call => call[0] === 'success')).toBe(false);
  });

});
