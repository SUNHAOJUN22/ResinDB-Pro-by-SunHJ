import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/hooks/app/useDatabase';
import type { Product } from '@/types/index';

const state = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@/lib/adapters', () => ({ default: { search: state.search } }));
vi.mock('@/hooks/datagrid/useColumns', () => ({ useColumns: () => ({ columns: [] }) }));

const translateZh = (key: string) => key;
const translateEn = (key: string) => key === '密度' ? 'Density' : key;
const text = (key: string) => key;
const toast = vi.fn();
const noCategories = new Map<string, string>();
let product: Product;

beforeEach(() => {
  localStorage.clear();
  product = {
    id: 'context-record', gradeName: 'Grade A', manufacturer: 'Lab', manufacturerId: 'lab',
    categoryIds: ['context-category'], createdAt: '2026-01-01', updatedAt: '2026-01-01',
    properties: { '密度': { value: 0.9, unit: 'g/cm³' } },
  };
  // The local adapter reuses cached Product objects when locale changes.
  state.search.mockResolvedValue([product]);
});
afterEach(cleanup);

async function search(
  result: { current: ReturnType<typeof useDatabase> }, query: string, expectedIds: string[],
) {
  act(() => result.current.setSearchQuery(query));
  await waitFor(() => expect(result.current.deferredSearchQuery).toBe(query));
  await waitFor(() => expect(result.current.filteredData.map(record => record.id)).toEqual(expectedIds));
}

describe('database text search context', () => {
  it('reindexes the same product when switching Chinese to English and back', async () => {
    const { result, rerender } = renderHook(
      ({ translate }) => useDatabase(noCategories, translate, toast, text),
      { initialProps: { translate: translateZh } },
    );
    await waitFor(() => expect(result.current.allProducts[0]).toBe(product));
    await search(result, '密度', [product.id]);
    rerender({ translate: translateEn });
    await search(result, 'Density', [product.id]);
    expect(result.current.allProducts[0]).toBe(product);
    rerender({ translate: translateZh });
    await search(result, 'Density', []);
    await search(result, '密度', [product.id]);
  });

  it('refreshes category names without replacing products or the property translator', async () => {
    const { result, rerender } = renderHook(
      ({ categories }) => useDatabase(categories, translateZh, toast, text),
      { initialProps: { categories: new Map([['context-category', '分类甲']]) } },
    );
    await waitFor(() => expect(result.current.allProducts[0]).toBe(product));
    await search(result, '分类甲', [product.id]);
    rerender({ categories: new Map([['context-category', 'Category Beta']]) });
    await search(result, 'Category Beta', [product.id]);
    await search(result, '分类甲', []);
    expect(result.current.allProducts[0]).toBe(product);
  });

  it('keeps simultaneous search contexts independent for an identical product object', async () => {
    const chinese = renderHook(() => useDatabase(noCategories, translateZh, toast, text));
    await waitFor(() => expect(chinese.result.current.allProducts[0]).toBe(product));
    await search(chinese.result, '密度', [product.id]);
    const english = renderHook(() => useDatabase(noCategories, translateEn, toast, text));
    await waitFor(() => expect(english.result.current.allProducts[0]).toBe(product));
    await search(english.result, 'Density', [product.id]);
    await search(chinese.result, 'Density', []);
  });
});
