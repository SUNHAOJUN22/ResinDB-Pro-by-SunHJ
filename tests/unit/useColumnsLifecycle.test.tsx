import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Product } from '@/types/index';
import { useColumns } from '@/hooks/datagrid/useColumns';

function product(id: string, temperature: number): Product {
  return {
    id,
    gradeName: id,
    manufacturerId: 'maker',
    manufacturer: 'Maker',
    categoryIds: ['cat_pp'],
    createdAt: '2026-08-02',
    updatedAt: '2026-08-02',
    properties: {
      MFR: {
        value: id === 'p1' ? 2 : 4,
        unit: 'g/10min',
        method: 'ISO 1133',
        temperature,
        load: 2.16,
      },
    },
  };
}

describe('dynamic column inference lifecycle', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('refreshes data-dependent numeric types while preserving column preferences', () => {
    const compatibleProducts = [product('p1', 190), product('p2', 190)];
    const { result, rerender } = renderHook(
      ({ products }: { products: Product[] }) => useColumns(products),
      { initialProps: { products: compatibleProducts } },
    );
    expect(result.current.columns.find((column) => column.key === 'MFR')?.type).toBe('number');

    act(() => {
      result.current.toggleColumn('MFR');
      result.current.togglePin('MFR');
    });
    const before = result.current.columns.find((column) => column.key === 'MFR')!;
    const beforeOrder = result.current.columns.map((column) => column.key);
    rerender({ products: [compatibleProducts[0], product('p2', 230)] });

    const after = result.current.columns.find((column) => column.key === 'MFR')!;
    expect(after.type).toBeUndefined();
    expect(after.visible).toBe(before.visible);
    expect(after.isPinned).toBe(before.isPinned);
    expect(result.current.columns.map((column) => column.key)).toEqual(beforeOrder);

    rerender({ products: compatibleProducts });
    expect(result.current.columns.find((column) => column.key === 'MFR')?.type).toBe('number');
    expect(result.current.columns.map((column) => column.key)).toEqual(beforeOrder);
  });

  it('keeps newly discovered columns hidden when the saved visibility preference excludes them', () => {
    const initialProducts = [product('p1', 190), product('p2', 190)];
    const { result, rerender } = renderHook(
      ({ products }: { products: Product[] }) => useColumns(products),
      { initialProps: { products: initialProducts } },
    );
    act(() => result.current.toggleAllColumns(false));

    rerender({ products: initialProducts.map((item) => ({
      ...item,
      properties: { ...item.properties, NewMeasure: { value: 2, unit: 'test-unit' } },
    })) });

    const newColumn = result.current.columns.find((column) => column.key === 'NewMeasure');
    expect(newColumn?.type).toBe('number');
    expect(newColumn?.visible).toBe(false);
  });
});
