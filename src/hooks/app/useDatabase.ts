import { useState, useMemo, useDeferredValue, useEffect, useCallback, useRef } from 'react';
import { Product, FilterGroup, Category, Toast, SyncEvent } from '@/types/index';
import { compileFilterGroup } from '@/lib/filterUtils';
import { matchesPropertyCondition, parsePropertyCondition } from '@/lib/propertySearch';
import { calculateCompleteness, getLower } from '@/utils/productUtils';
import { CATEGORY_TREE } from '@/config/constants';
import { debounce } from 'lodash';
import api from '@/lib/adapters';
import { useColumns } from '@/hooks/datagrid/useColumns';
import { propertyMap } from '@/config/i18n';
import { generateId, safeStorage } from '@/lib/utils';
import { ProductMutationCoordinator } from '@/lib/productMutationCoordinator';

type ProductTextBuilder = (product: Product) => string;

// A builder closes over one hook's locale and category labels. Weak keys keep
// caches isolated between those contexts without retaining retired callbacks.
const productTextIndices = new WeakMap<ProductTextBuilder, WeakMap<Product, string>>();

function cachedProductText(product: Product, build: ProductTextBuilder): string {
  let index = productTextIndices.get(build);
  if (!index) {
    index = new WeakMap<Product, string>();
    productTextIndices.set(build, index);
  }
  let tokens = index.get(product);
  if (tokens === undefined) {
    tokens = build(product);
    index.set(product, tokens);
  }
  return tokens;
}

export function useDatabase(
  categoryNameMap: Map<string, string>,
  tProp: (key: string) => string,
  addToast: (type: Toast['type'], message: string) => void,
  t: (key: string, fallback?: string) => string
) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [mutations] = useState(() => new ProductMutationCoordinator(
    () => api.readAuthoritative ? api.readAuthoritative() : api.search('', null),
    setAllProducts,
  ));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>(() => {
    const saved = safeStorage.local.getItem('resindb-sync-events');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore malformed local history.
      }
    }
    return [];
  });

  const addSyncEvent = useCallback((event: Omit<SyncEvent, 'id' | 'timestamp'>) => {
    setSyncEvents(prev => {
      const newEvents = [
        { ...event, id: generateId(), timestamp: Date.now() },
        ...prev
      ].slice(0, 50);
      safeStorage.local.setItem('resindb-sync-events', JSON.stringify(newEvents));
      return newEvents;
    });
  }, []);

  const columnManagement = useColumns(allProducts);
  const { columns } = columnManagement;
  const propertyKeyLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const [key, translatedLabel] of Object.entries(propertyMap)) {
      lookup.set(key.toLowerCase(), key);
      lookup.set(translatedLabel.toLowerCase(), key);
    }
    for (const column of columns) {
      lookup.set(tProp(column.label).toLowerCase(), column.key);
    }
    // Exact keys present in the dataset outrank translated aliases. Otherwise
    // an actual `density` field can be redirected to a nonexistent `密度` field.
    for (const column of columns) lookup.set(column.key.toLowerCase(), column.key);
    return lookup;
  }, [columns, tProp]);

  const resolvePropKey = useCallback(
    (label: string): string | null => propertyKeyLookup.get(label.toLowerCase()) ?? null,
    [propertyKeyLookup],
  );

  const fetchRequestId = useRef(0);
  const fetchProducts = useCallback(async (
    silent = false,
  ): Promise<boolean> => {
    const requestId = ++fetchRequestId.current;
    if (!silent) setIsLoading(true);
    try {
      await mutations.refresh();
      return true;
    } catch (error) {
      if (requestId === fetchRequestId.current) {
        addToast('error', t('fetchDataError') + (error instanceof Error ? error.message : t('unknownError')));
      }
      return false;
    } finally {
      if (requestId === fetchRequestId.current && !silent) setIsLoading(false);
    }
  }, [addToast, t, mutations]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await fetchProducts(true);
      if (refreshed) {
        addToast('success', t('dataRefreshed'));
        addSyncEvent({ status: 'success', message: t('dataRefreshed', 'Data refreshed successfully') });
      } else {
        addSyncEvent({ status: 'error', message: t('fetchDataError', 'Data refresh failed') });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchProducts, addToast, t, addSyncEvent]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const debouncedSetQuery = useMemo(() => debounce((query: string) => setDebouncedSearchQuery(query), 300), []);
  useEffect(() => {
    debouncedSetQuery(searchQuery);
    return () => debouncedSetQuery.cancel();
  }, [searchQuery, debouncedSetQuery]);

  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [advancedFilterGroup, setAdvancedFilterGroup] = useState<FilterGroup>({
    id: 'root',
    type: 'group',
    logic: 'AND',
    conditions: []
  });
  const [minCompleteness, setMinCompleteness] = useState(0);

  const allExpandedSelectedCategoryIds = useMemo(() => {
    if (selectedCategoryIds.size === 0) return new Set<string>();
    const ids = new Set<string>();
    const traverse = (categories: Category[], forceAdd = false) => {
      categories.forEach((category) => {
        const shouldAdd = forceAdd || selectedCategoryIds.has(category.id);
        if (shouldAdd) ids.add(category.id);
        if (category.children) traverse(category.children, shouldAdd);
      });
    };
    traverse(CATEGORY_TREE);
    return ids;
  }, [selectedCategoryIds]);

  const buildProductTextIndex = useCallback((product: Product): string => {
    const chunks: string[] = [getLower(product.gradeName), getLower(product.manufacturer)];
    product.categoryIds.forEach((id) => {
      const category = categoryNameMap.get(id);
      if (category) chunks.push(getLower(category));
    });
    for (const [key, property] of Object.entries(product.properties)) {
      chunks.push(getLower(key));
      const translatedKey = getLower(tProp(key));
      if (translatedKey && translatedKey !== getLower(key)) chunks.push(translatedKey);
      chunks.push(getLower(String(property.value)));
      if (property.unit) chunks.push(getLower(property.unit));
    }
    return chunks.join(' | ');
  }, [categoryNameMap, tProp]);

  useEffect(() => {
    if (!allProducts.length) return;

    let cancelled = false;
    let currentIndex = 0;
    let idleHandle: number | null = null;
    let intervalHandle: ReturnType<typeof setInterval> | null = null;
    const batchSize = 250;

    const processBatch = () => {
      const end = Math.min(currentIndex + batchSize, allProducts.length);
      for (let index = currentIndex; index < end; index += 1) {
        const product = allProducts[index];
        cachedProductText(product, buildProductTextIndex);
      }
      currentIndex = end;
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: (deadline: IdleDeadline) => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const run = (deadline: IdleDeadline) => {
        if (cancelled) return;
        while (deadline.timeRemaining() > 0 && currentIndex < allProducts.length) processBatch();
        if (currentIndex < allProducts.length) idleHandle = idleWindow.requestIdleCallback?.(run) ?? null;
      };
      idleHandle = idleWindow.requestIdleCallback(run);
    } else {
      intervalHandle = setInterval(() => {
        if (cancelled) return;
        processBatch();
        if (currentIndex >= allProducts.length && intervalHandle) {
          clearInterval(intervalHandle);
          intervalHandle = null;
        }
      }, 50);
    }

    return () => {
      cancelled = true;
      if (intervalHandle) clearInterval(intervalHandle);
      if (idleHandle !== null) idleWindow.cancelIdleCallback?.(idleHandle);
    };
  }, [allProducts, buildProductTextIndex]);

  const filteredData = useMemo(() => {
    const syntaxRegex = /([^:\s]+(?:\s+[^:\s]+)*):([^:\s]+)/g;
    const syntaxFilters: { key: string; condition: ReturnType<typeof parsePropertyCondition> }[] = [];
    const filterMatches: { start: number, end: number }[] = [];
    let match;
    while ((match = syntaxRegex.exec(deferredSearchQuery)) !== null) {
      const [full, label, condition] = match;
      let key = resolvePropKey(label.trim());
      let matchedLabel = label.trim();
      if (!key) {
        const parts = label.trim().split(/\s+/);
        for (let index = 1; index < parts.length; index += 1) {
          const subLabel = parts.slice(index).join(' ');
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
        syntaxFilters.push({ key, condition: parsePropertyCondition(condition) });
      }
    }

    let processedQuery = '';
    let lastIndex = 0;
    filterMatches.sort((a, b) => a.start - b.start).forEach((item) => {
      processedQuery += deferredSearchQuery.substring(lastIndex, item.start);
      lastIndex = item.end;
    });
    processedQuery += deferredSearchQuery.substring(lastIndex);

    const textKeywords = processedQuery.toLowerCase().split(' ').filter((keyword) => keyword.trim());
    const advancedPredicate = compileFilterGroup(advancedFilterGroup);
    const hasAdvancedFilters = advancedFilterGroup.conditions.length > 0;

    return allProducts.filter((product) => {
      if (minCompleteness > 0 && calculateCompleteness(product) < minCompleteness) return false;

      if (allExpandedSelectedCategoryIds.size > 0) {
        const categories = Array.isArray(product.categoryIds) ? product.categoryIds : [];
        if (!categories.some((category) => allExpandedSelectedCategoryIds.has(category))) return false;
      }

      if (textKeywords.length > 0) {
        const searchTokens = cachedProductText(product, buildProductTextIndex);
        if (textKeywords.some((keyword) => !searchTokens.includes(keyword))) return false;
      }

      for (const filter of syntaxFilters) {
        if (!matchesPropertyCondition(product.properties[filter.key], filter.condition, filter.key)) return false;
      }

      return !hasAdvancedFilters || advancedPredicate(product);
    });
  }, [allProducts, deferredSearchQuery, allExpandedSelectedCategoryIds, resolvePropKey, advancedFilterGroup, minCompleteness, buildProductTextIndex]);

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
    mutations,
    isLoading,
    isRefreshing,
    refreshData,
    syncEvents,
    addSyncEvent,
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
    mutations,
    isLoading,
    isRefreshing,
    refreshData,
    syncEvents,
    addSyncEvent,
    resolvePropKey,
    columnManagement
  ]);
}
