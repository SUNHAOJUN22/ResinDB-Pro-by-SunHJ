import { useState, useMemo, useDeferredValue, useEffect, useCallback, useRef } from 'react';
import { Product, FilterGroup, Category, Toast } from '@/types/index';
import { compileFilterGroup } from '@/lib/filterUtils';
import { calculateCompleteness, getLower } from '@/utils/productUtils';
import { CATEGORY_TREE, PRODUCT_CATALOG } from '@/config/constants';
import { debounce } from 'lodash';
import { api } from '@/services/api';
import { useColumns } from '@/hooks/useColumns';
import { propertyMap } from '@/config/i18n';

// Module-level WeakMap: Provides O(1) GC-safe caching for massive product tokens.
// Avoids regenerating strings per object across 2.5 MILLION deep iterations per keystroke!
const __globalProductTextIndex = new WeakMap<Product, string>();

export function useDatabase(
  categoryNameMap: Map<string, string>,
  tProp: (key: string) => string,
  addToast: (type: Toast['type'], message: string) => void,
  t: (key: string, fallback?: string) => string
) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const columnManagement = useColumns(allProducts);
  const { columns } = columnManagement;

  const resolvePropKey = useCallback(
    (label: string): string | null => {
      const cleanLabel = label.toLowerCase();
      const directMatch = columns.find(
        (c) =>
          c.key.toLowerCase() === cleanLabel ||
          tProp(c.label).toLowerCase() === cleanLabel,
      );
      if (directMatch) return directMatch.key;
      const reverseKey = Object.keys(propertyMap).find(
        (k) =>
          k.toLowerCase() === cleanLabel ||
          propertyMap[k].toLowerCase() === cleanLabel,
      );
      if (reverseKey) return reverseKey;
      return null;
    },
    [columns, tProp],
  );

  const fetchRequestId = useRef(0);

  const fetchProducts = useCallback(async (query: string = "", categoryId: string | null = null, silent: boolean = false) => {
    const requestId = ++fetchRequestId.current;
    if (!silent) setIsLoading(true);
    try {
      const data = await api.search(query, categoryId);
      if (requestId === fetchRequestId.current) {
        setAllProducts(data);
      }
    } catch (error) {
      if (requestId === fetchRequestId.current) {
        addToast(
          "error",
          t("fetchDataError") + (error instanceof Error ? error.message : t("unknownError")),
        );
        setAllProducts(PRODUCT_CATALOG);
      }
    } finally {
      if (requestId === fetchRequestId.current && !silent) {
        setIsLoading(false);
      }
    }
  }, [addToast, t]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    await fetchProducts("", null, true);
    setIsRefreshing(false);
    addToast("success", t("dataRefreshed"));
  }, [fetchProducts, addToast, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const debouncedSetQuery = useMemo(
      () => debounce((q: string) => setDebouncedSearchQuery(q), 300),
      []
  );

  useEffect(() => {
      debouncedSetQuery(searchQuery);
      return () => debouncedSetQuery.cancel();
  }, [searchQuery, debouncedSetQuery]);

  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
// ... update filteredData to use deferredSearchQuery ...
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [advancedFilterGroup, setAdvancedFilterGroup] = useState<FilterGroup>({
    id: 'root',
    type: 'group',
    logic: 'AND',
    conditions: []
  });
  const [minCompleteness, setMinCompleteness] = useState<number>(0);

  const allExpandedSelectedCategoryIds = useMemo(() => {
    if (selectedCategoryIds.size === 0) return new Set<string>();
    const ids = new Set<string>();
    const traverse = (cats: Category[], forceAdd = false) => {
      cats.forEach(c => {
        const shouldAdd = forceAdd || selectedCategoryIds.has(c.id);
        if (shouldAdd) ids.add(c.id);
        if (c.children) traverse(c.children, shouldAdd);
      });
    };
    traverse(CATEGORY_TREE);
    return ids;
  }, [selectedCategoryIds]);

  // Background Indexing: Warm up the O(1) text search index during idle time to prevent first-keystroke stutter.
  useEffect(() => {
    if (!allProducts.length) return;
    
    let currentIndex = 0;
    const batchSize = 250;
    
    const indexBatch = (deadline: IdleDeadline) => {
      while (deadline.timeRemaining() > 0 && currentIndex < allProducts.length) {
        const end = Math.min(currentIndex + batchSize, allProducts.length);
        for (let i = currentIndex; i < end; i++) {
          const product = allProducts[i];
          if (!__globalProductTextIndex.has(product)) {
            const chunks: string[] = [
              getLower(product.gradeName),
              getLower(product.manufacturer)
            ];
            product.categoryIds.forEach(id => {
              const c = categoryNameMap.get(id);
              if (c) chunks.push(getLower(c));
            });
            for (const k in product.properties) {
              chunks.push(getLower(k));
              // Skip expensive translation logic during idle indexing to keep it light
              const v = product.properties[k];
              chunks.push(getLower(String(v.value)));
              if (v.unit) chunks.push(getLower(v.unit));
            }
            __globalProductTextIndex.set(product, chunks.join(' | '));
          }
        }
        currentIndex = end;
      }
      
      if (currentIndex < allProducts.length) {
        if ('requestIdleCallback' in window) {
           (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(indexBatch);
        }
      }
    };

    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(indexBatch);
    } else {
      // Fallback for Safari
      const interval = setInterval(() => {
        const end = Math.min(currentIndex + batchSize, allProducts.length);
        for (let i = currentIndex; i < end; i++) {
          const product = allProducts[i];
          if (!__globalProductTextIndex.has(product)) {
            const chunks: string[] = [
              getLower(product.gradeName),
              getLower(product.manufacturer)
            ];
            product.categoryIds.forEach(id => {
              const c = categoryNameMap.get(id);
              if (c) chunks.push(getLower(c));
            });
            for (const k in product.properties) {
              chunks.push(getLower(k));
              const v = product.properties[k];
              chunks.push(getLower(String(v.value)));
              if (v.unit) chunks.push(getLower(v.unit));
            }
            __globalProductTextIndex.set(product, chunks.join(' | '));
          }
        }
        currentIndex = end;
        if (currentIndex >= allProducts.length) clearInterval(interval);
      }, 50);
    }
  }, [allProducts, categoryNameMap]);

  const filteredData = useMemo(() => {
    const syntaxRegex = /([^:\s]+(?:\s+[^:\s]+)*):([<>]=?|[^:\s]+)/g;
    const syntaxFilters: { key: string, operator: string, value: string | number, max?: number }[] = [];
    const filterMatches: { start: number, end: number }[] = [];
    let match;
    while ((match = syntaxRegex.exec(deferredSearchQuery)) !== null) {
        const [full, label, condition] = match;
        let key = resolvePropKey(label.trim());
        let matchedLabel = label.trim();
        if (!key) {
            const parts = label.trim().split(/\s+/);
            for (let i = 1; i < parts.length; i++) {
                const subLabel = parts.slice(i).join(' ');
                key = resolvePropKey(subLabel);
                if (key) {
                    matchedLabel = subLabel;
                    break;
                }
            }
        }
        if (key) {
            const filterPart = `${matchedLabel}:${condition}`;
            const filterStart = match.index + full.lastIndexOf(filterPart);
            filterMatches.push({ start: filterStart, end: filterStart + filterPart.length });
            if (condition.includes('-') && !condition.startsWith('-')) {
                const parts = condition.split('-');
                syntaxFilters.push({ key, operator: 'range', value: parseFloat(parts[0]), max: parseFloat(parts[1]) });
            } else if (condition.match(/^[<>]=?/)) {
                const op = condition.match(/^[<>]=?/)?.[0] || '';
                const val = parseFloat(condition.replace(op, ''));
                syntaxFilters.push({ key, operator: op, value: val });
            } else {
                const numVal = parseFloat(condition);
                syntaxFilters.push({ key, operator: '=', value: isNaN(numVal) ? getLower(condition) : numVal });
            }
        }
    }

    let processedQuery = '';
    let lastIndex = 0;
    filterMatches.sort((a, b) => a.start - b.start).forEach(m => {
        processedQuery += deferredSearchQuery.substring(lastIndex, m.start);
        lastIndex = m.end;
    });
    processedQuery += deferredSearchQuery.substring(lastIndex);

    const textKeywords = processedQuery.toLowerCase().split(' ').filter(k => k.trim());

    // Cache translated property keys and match results to avoid O(N * M) dictionary lookups
    const propTranslationCache = new Map<string, string>();
    const getTranslatedProp = (key: string) => {
        let val = propTranslationCache.get(key);
        if (val === undefined) {
            val = tProp(key).toLowerCase();
            propTranslationCache.set(key, val);
        }
        return val;
    };

    // Pre-calculate advanced filter predicate ONCE for this run
    const advancedPredicate = compileFilterGroup(advancedFilterGroup);
    const hasAdvancedFilters = advancedFilterGroup.conditions.length > 0;

    return allProducts.filter(product => {
        // 1. Completeness fast-bail
        if (minCompleteness > 0) {
            const score = calculateCompleteness(product);
            if (score < minCompleteness) return false;
        }

        // 2. Category fast-bail
        if (allExpandedSelectedCategoryIds.size > 0) {
            const pCats = Array.isArray(product.categoryIds) ? product.categoryIds : [];
            let catFound = false;
            for (let i = 0; i < pCats.length; i++) {
                if (allExpandedSelectedCategoryIds.has(pCats[i])) {
                    catFound = true;
                    break;
                }
            }
            if (!catFound) return false;
        }

        // 3. Text Keywords (via Indexed WeakMap)
        if (textKeywords.length > 0) {
            const tokens = __globalProductTextIndex.get(product);
            let searchTokens = tokens;
            if (searchTokens === undefined) {
                const chunks: string[] = [
                    getLower(product.gradeName),
                    getLower(product.manufacturer)
                ];
                product.categoryIds.forEach(id => {
                    const c = categoryNameMap.get(id);
                    if (c) chunks.push(getLower(c));
                });
                for (const k in product.properties) {
                    chunks.push(getLower(k));
                    const transKey = getTranslatedProp(k);
                    if (transKey && getLower(transKey) !== getLower(k)) chunks.push(getLower(transKey));
                    const v = product.properties[k];
                    chunks.push(getLower(String(v.value)));
                    if (v.unit) chunks.push(getLower(v.unit));
                }
                searchTokens = chunks.join(' | ');
                __globalProductTextIndex.set(product, searchTokens);
            }
            
            for (let i = 0; i < textKeywords.length; i++) {
                if (!searchTokens.includes(textKeywords[i])) return false;
            }
        }

        // 4. Syntax Filters (Calculated numeric comparisons)
        if (syntaxFilters.length > 0) {
            for (let i = 0; i < syntaxFilters.length; i++) {
                const f = syntaxFilters[i];
                const propVal = product.properties[f.key]?.value;
                const val = typeof propVal === 'number' ? propVal : parseFloat(String(propVal));
                
                let match = false;
                if (isNaN(val) || typeof f.value === 'string') {
                    match = getLower(String(propVal)).includes(f.value as string);
                } else {
                    switch(f.operator) {
                        case '>': match = val > (f.value as number); break;
                        case '<': match = val < (f.value as number); break;
                        case '>=': match = val >= (f.value as number); break;
                        case '<=': match = val <= (f.value as number); break;
                        case 'range': match = val >= (f.value as number) && val <= (f.max || Infinity); break;
                        case '=': match = val === (f.value as number); break;
                        default: match = true;
                    }
                }
                if (!match) return false;
            }
        }

        // 5. Advanced Rule Engine (Pre-compiled Predicate)
        if (hasAdvancedFilters) {
            if (!advancedPredicate(product)) return false;
        }

        return true;
    });
  }, [allProducts, deferredSearchQuery, allExpandedSelectedCategoryIds, resolvePropKey, advancedFilterGroup, minCompleteness, categoryNameMap, tProp]);

  return useMemo(() => ({
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    selectedCategoryIds,
    setSelectedCategoryIds,
    advancedFilterGroup,
    setAdvancedFilterGroup,
    minCompleteness,
    setMinCompleteness,
    filteredData,
    allProducts,
    setAllProducts,
    isLoading,
    isRefreshing,
    refreshData,
    resolvePropKey,
    ...columnManagement
  }), [
    searchQuery,
    deferredSearchQuery,
    selectedCategoryIds,
    advancedFilterGroup,
    minCompleteness,
    filteredData,
    allProducts,
    isLoading,
    isRefreshing,
    refreshData,
    resolvePropKey,
    columnManagement
  ]);
}
