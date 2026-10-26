import type { Product } from '@/types/index';
import { parseFiniteReal } from '@/lib/quantityRecord';

export interface AnalysisRange { min: string; max: string }

/** The chart and its cohort filter must consume the same admitted observation. */
export function filterAnalysisProducts(
  products: Product[],
  filters: Readonly<Record<string, AnalysisRange>>,
  getValue: (product: Product, key: string) => number,
): Product[] {
  const rules = Object.entries(filters).map(([key, range]) => ({
    key,
    min: range.min.trim() === '' ? -Infinity : parseFiniteReal(range.min),
    max: range.max.trim() === '' ? Infinity : parseFiniteReal(range.max),
  }));
  if (rules.length === 0) return products;
  if (rules.some(rule => rule.min === null || rule.max === null || rule.min > rule.max)) return [];
  return products.filter(product => rules.every(rule => {
    const value = getValue(product, rule.key);
    return Number.isFinite(value) && value >= rule.min! && value <= rule.max!;
  }));
}
