import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types/index';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import { getDynamicColumns, getVisibleNumericPropertyKeys } from '@/utils/productUtils';

const density = (value: number, unit: string) => ({
  value,
  unit,
  quantity: canonicalizeCoreProperty('Density', { value, unit }),
});

const unknownDensity = {
  value: 0.91,
  unit: 'g/cm3',
  quantity: canonicalizeCoreProperty('Density', { value: 0.91 }),
};

interface WorkerScope {
  onmessage?: (event: MessageEvent) => void;
  postMessage(value: unknown): void;
}

const products: Product[] = [
  {
    id: 'p1', gradeName: 'PP A', manufacturerId: 'm', manufacturer: 'Maker',
    categoryIds: ['cat_pp'], createdAt: '2026-08-02', updatedAt: '2026-08-02',
    priority: 1,
    properties: {
      Density: density(0.92, 'g/cm3'),
      MFR: { value: 2, unit: 'g/10min' },
      标签值: { value: '12abc' },
    },
  },
  {
    id: 'p2', gradeName: 'PP B', manufacturerId: 'm', manufacturer: 'Maker',
    categoryIds: ['cat_pp'], createdAt: '2026-08-02', updatedAt: '2026-08-02',
    priority: 2,
    properties: {
      Density: density(0.9, 'g/cm3'),
      MFR: { value: 4, unit: 'g/10min' },
      标签值: { value: 12 },
    },
  },
  {
    id: 'p3', gradeName: 'PP C', manufacturerId: 'm', manufacturer: 'Maker',
    categoryIds: ['cat_pp'], createdAt: '2026-08-02', updatedAt: '2026-08-02',
    priority: 0,
    properties: { Density: unknownDensity },
  },
];

const columns: ColumnConfig[] = getDynamicColumns(products);

describe('data grid worker contract', () => {
  it('initializes, filters and keeps malformed numeric strings out of numerical anomaly parsing', async () => {
    vi.resetModules();
    const replies: unknown[] = [];
    const scope: WorkerScope = { postMessage: (value) => replies.push(value) };
    vi.stubGlobal('self', scope);
    await import('@/workers/dataWorker');

    scope.onmessage!({
      data: { type: 'INIT_DATA', payload: { allProducts: products, formulas: [], columns } },
    } as MessageEvent);
    expect((replies.at(-1) as { type: string }).type).toBe('INIT_SUCCESS');

    scope.onmessage!({
      data: {
        type: 'QUERY',
        payload: {
          activeFilters: [],
          sortConfig: [],
          useTopsis: true,
          detectAnomaliesKey: '标签值',
        },
      },
    } as MessageEvent);

    const response = replies.at(-1) as {
      type: string;
      payload: { resultIds: string[]; topsisTop3Ids: string[]; outliers: string[] };
    };
    expect(response.type).toBe('QUERY_RESULT');
    expect(response.payload.resultIds).toEqual(['p2', 'p1', 'p3']);
    expect(response.payload.topsisTop3Ids).toEqual(['p2', 'p1']);
    expect(response.payload.outliers).toEqual([]);
    const visibleColumns = columns.map((column) => column.key === 'Density' ? { ...column, visible: true } : column);
    expect(getVisibleNumericPropertyKeys(visibleColumns)).toEqual(['Density']);
    expect(columns.find((column) => column.key === 'MFR')?.type).not.toBe('number');
    vi.unstubAllGlobals();
  });

  it('revalidates numeric criteria after product conditions change, even when columns are stale', async () => {
    const mfr = (value: number, temperature: number) => ({
      value,
      unit: 'g/10min',
      method: 'ISO 1133',
      temperature,
      load: 2.16,
    });
    const initialProducts = [
      { ...products[0], properties: { MFR: mfr(2, 190) } },
      { ...products[1], properties: { MFR: mfr(4, 190) } },
    ];
    const staleColumns = getDynamicColumns(initialProducts);
    expect(staleColumns.find((column) => column.key === 'MFR')?.type).toBe('number');

    const updatedProducts = [initialProducts[0], {
      ...initialProducts[1],
      properties: { MFR: mfr(4, 230) },
    }];
    expect(getVisibleNumericPropertyKeys(staleColumns, updatedProducts)).not.toContain('MFR');

    vi.resetModules();
    const replies: unknown[] = [];
    const scope: WorkerScope = { postMessage: (value) => replies.push(value) };
    vi.stubGlobal('self', scope);
    await import('@/workers/dataWorker');

    scope.onmessage!({
      data: { type: 'INIT_DATA', payload: { allProducts: updatedProducts, formulas: [], columns: staleColumns } },
    } as MessageEvent);
    scope.onmessage!({
      data: {
        type: 'QUERY',
        payload: { activeFilters: [], sortConfig: [], useTopsis: true },
      },
    } as MessageEvent);

    const response = replies.at(-1) as {
      type: string;
      payload: { resultIds: string[]; topsisTop3Ids: string[] };
    };
    expect(response.type).toBe('QUERY_RESULT');
    expect(response.payload.topsisTop3Ids).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('keeps equivalent raw condition objects in TOPSIS when their keys arrive in a different order', async () => {
    const mfr = (value: number, conditions: Record<string, unknown>) => ({
      value,
      unit: 'g/10min',
      method: 'ISO 1133',
      temperature: 190,
      load: 2.16,
      quantity: canonicalizeCoreProperty('MFR', {
        value,
        unit: 'g/10min',
        method: 'ISO 1133',
        temperature: 190,
        load: 2.16,
        conditions,
      }),
    });
    const cohort = [
      { ...products[0], properties: { MFR: mfr(4, { temperature: 190, load: 2.16 }) } },
      { ...products[1], properties: { MFR: mfr(2, { load: 2.16, temperature: 190 }) } },
    ];
    const cohortColumns = getDynamicColumns(cohort);

    vi.resetModules();
    const replies: unknown[] = [];
    const scope: WorkerScope = { postMessage: (value) => replies.push(value) };
    vi.stubGlobal('self', scope);
    await import('@/workers/dataWorker');

    scope.onmessage!({
      data: { type: 'INIT_DATA', payload: { allProducts: cohort, formulas: [], columns: cohortColumns } },
    } as MessageEvent);
    scope.onmessage!({
      data: { type: 'QUERY', payload: { activeFilters: [], sortConfig: [], useTopsis: true } },
    } as MessageEvent);

    const response = replies.at(-1) as {
      type: string;
      payload: { resultIds: string[]; topsisTop3Ids: string[] };
    };
    expect(response.type).toBe('QUERY_RESULT');
    expect(response.payload.topsisTop3Ids).toEqual(['p2', 'p1']);
    vi.unstubAllGlobals();
  });

  it('excludes conflicting property declarations from a stale TOPSIS cohort', async () => {
    const validCohort = [products[0], products[1]];
    const staleColumns = getDynamicColumns(validCohort);
    expect(staleColumns.find(column => column.key === 'Density')?.type).toBe('number');
    const conflicting = {
      ...products[0],
      id: 'conflict',
      properties: {
        Density: {
          value: 0.92,
          unit: 'g/cm3',
          quantity: canonicalizeCoreProperty('Density', { value: 1, unit: 'g/cm3' }),
        },
      },
    };
    const cohort = [conflicting, products[1]];

    vi.resetModules();
    const replies: unknown[] = [];
    const scope: WorkerScope = { postMessage: value => replies.push(value) };
    vi.stubGlobal('self', scope);
    await import('@/workers/dataWorker');

    scope.onmessage!({
      data: { type: 'INIT_DATA', payload: { allProducts: cohort, formulas: [], columns: staleColumns } },
    } as MessageEvent);
    scope.onmessage!({
      data: { type: 'QUERY', payload: { activeFilters: [], sortConfig: [], useTopsis: true } },
    } as MessageEvent);

    const response = replies.at(-1) as {
      type: string;
      payload: { resultIds: string[]; topsisTop3Ids: string[] };
    };
    expect(response.type).toBe('QUERY_RESULT');
    expect(response.payload.topsisTop3Ids).toEqual([]);
    vi.unstubAllGlobals();
  });
});
