import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/hooks/app/useDatabase';
import { useDataGridWorker } from '@/hooks/workers/useDataGridWorker';
import type { Product } from '@/types/index';
import type { WorkerMessage, WorkerResponse } from '@/workers/dataWorker';

const state = vi.hoisted(() => ({ search: vi.fn(), formulas: [], columns: [
  { key: 'gradeName', label: 'Grade', visible: true, type: 'string' },
  { key: 'density', label: 'Density', visible: true, type: 'number', unit: 'g/cm³' },
] }));
vi.mock('@/lib/adapters', () => ({ default: { search: state.search } }));
vi.mock('@/hooks/datagrid/useColumns', () => ({ useColumns: () => ({ columns: state.columns }) }));
vi.mock('@/hooks/math/useFormulas', () => ({ useFormulas: () => ({ formulas: state.formulas }) }));

const products: Product[] = [
  { id: 'a', gradeName: 'Acceptance selected', manufacturer: 'Lab A', manufacturerId: 'a', categoryIds: [], createdAt: '2026-10-21', updatedAt: '2026-10-21', properties: { density: { value: 0.999, unit: 'g/cm³' } } },
  { id: 'b', gradeName: 'Another resin', manufacturer: 'Lab B', manufacturerId: 'b', categoryIds: [], createdAt: '2026-10-21', updatedAt: '2026-10-21', properties: { density: { value: 0.8, unit: 'g/cm³' } } },
];
const names = new Map<string, string>();
const translate = (key: string) => key;
const toast = vi.fn();
const queries: WorkerMessage[] = [];
let scope: { location: Location; onmessage?: (message: MessageEvent<WorkerMessage>) => void; postMessage: (message: WorkerResponse) => void };

beforeEach(async () => {
  localStorage.clear(); state.search.mockResolvedValue(products); queries.length = 0;
  vi.resetModules();
  scope = { location: window.location, postMessage: () => undefined };
  vi.stubGlobal('self', scope);
  await import('@/workers/dataWorker');
  vi.stubGlobal('Worker', class {
    onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
    closed = false;
    constructor() {
      scope.postMessage = data => queueMicrotask(() => { if (!this.closed) this.onmessage?.({ data } as MessageEvent<WorkerResponse>); });
    }
    postMessage(message: WorkerMessage) {
      const cloned = structuredClone(message);
      queries.push(cloned);
      queueMicrotask(() => { if (!this.closed) scope.onmessage?.({ data: cloned } as MessageEvent<WorkerMessage>); });
    }
    terminate() { this.closed = true; }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function useWorkbench() {
  const db = useDatabase(names, translate, toast, translate);
  const grid = useDataGridWorker({
    data: db.filteredData, columns: db.columns,
    activeFilters: db.searchQuery ? [{ id: 'search', label: `Search: "${db.searchQuery}"`, type: 'search', onRemove: () => db.setSearchQuery('') }] : [],
  });
  return { db, grid };
}

describe('search cohort through the actual database hook, grid hook, and worker', () => {
  it('keeps text and numeric property search results visible and restores the cleared cohort', async () => {
    const { result } = renderHook(useWorkbench);
    await waitFor(() => expect(result.current.grid.sortedData).toHaveLength(2));
    act(() => result.current.db.setSearchQuery('Acceptance selected'));
    await waitFor(() => expect(result.current.db.filteredData.map(p => p.id)).toEqual(['a']));
    await waitFor(() => expect(result.current.grid.sortedData.map(p => p.id)).toEqual(['a']));
    act(() => result.current.db.setSearchQuery('density:>0.9'));
    await waitFor(() => expect(result.current.db.deferredSearchQuery).toBe('density:>0.9'));
    await waitFor(() => expect(result.current.grid.sortedData.map(p => p.id)).toEqual(['a']));
    act(() => result.current.grid.setUseTopsis(true));
    await waitFor(() => expect(result.current.grid.topsisTop3Ids).toEqual(['a']));
    act(() => { result.current.grid.setUseTopsis(false); result.current.db.setSearchQuery('density:>0.9oops'); });
    await waitFor(() => expect(result.current.db.filteredData).toHaveLength(0));
    await waitFor(() => expect(result.current.grid.sortedData).toHaveLength(0));
    act(() => result.current.db.setSearchQuery(''));
    await waitFor(() => expect(result.current.grid.sortedData).toHaveLength(2));
    act(() => result.current.grid.setSortConfig('gradeName'));
    await waitFor(() => expect(result.current.grid.sortedData.map(p => p.id)).toEqual(['a', 'b']));
    act(() => result.current.grid.setSortConfig('gradeName'));
    await waitFor(() => expect(result.current.grid.sortedData.map(p => p.id)).toEqual(['b', 'a']));
    for (const query of queries.filter(message => message.type === 'QUERY')) {
      expect(query.payload.inputIsFiltered).toBe(true);
      expect(query.payload.activeFilters).toEqual([]);
    }
  });

  it('retains standalone raw-search worker compatibility while prefiltered mode ignores display labels', () => {
    const replies: WorkerResponse[] = [];
    scope.postMessage = message => replies.push(message);
    scope.onmessage?.({ data: { type: 'INIT_DATA', payload: { allProducts: products, formulas: [], columns: [] } } } as MessageEvent<WorkerMessage>);
    const query = { activeFilters: [{ id: 'search', type: 'search' as const, label: 'Acceptance', onRemove: () => undefined }], sortConfig: [] };
    scope.onmessage?.({ data: { type: 'QUERY', payload: query } } as MessageEvent<WorkerMessage>);
    expect(replies.at(-1)).toMatchObject({ type: 'QUERY_RESULT', payload: { resultIds: ['a'] } });
    scope.onmessage?.({ data: { type: 'QUERY', payload: { ...query, activeFilters: [{ ...query.activeFilters[0], label: '搜索："Acceptance"' }], inputIsFiltered: true } } } as MessageEvent<WorkerMessage>);
    expect(replies.at(-1)).toMatchObject({ type: 'QUERY_RESULT', payload: { resultIds: ['a', 'b'] } });
  });
});
