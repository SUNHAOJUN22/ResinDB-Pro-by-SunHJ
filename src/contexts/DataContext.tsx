import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import { Product, ColumnConfig, FilterGroup, ProductUpdates, FormulaConfig, FilterItem, Category, SyncEvent } from '@/types/index';
import { useLanguage } from "@/contexts/LanguageContext";
import { useToasts } from "@/contexts/ToastContext";
import { useUI } from "@/contexts/UIContext";
import { useDatabase } from '@/hooks/app/useDatabase';
import { CATEGORY_TREE } from '@/config/constants';
import api from '@/lib/adapters';
import { persistImportedProducts } from '@/lib/importProducts';
import { generateId, safeStorage } from "@/lib/utils";
import { useHistory } from '@/hooks/app/useHistory';
import { HistoryRecord } from "@/lib/adapters/types";
import { applyProductUpdates, awaitAllWrites, productEdit, updateFields } from '@/lib/productMutations';
import { refreshProperties, verifyPropertyQuantities } from '@/lib/propertyAdmission';
import type { ProductMutation } from '@/lib/productMutationCoordinator';

export interface RecentSearch {
  id: string;
  label: string;
  query: string;
  filters: FilterGroup;
  selectedCategoryIds: string[];
  timestamp: number;
}

interface DataContextType {
  allProducts: Product[];
  filteredData: Product[];
  isLoading: boolean;

  isRefreshing: boolean;
  refreshData: () => Promise<void>;
  syncEvents: SyncEvent[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategoryIds: Set<string>;
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  advancedFilterGroup: FilterGroup;
  setAdvancedFilterGroup: React.Dispatch<React.SetStateAction<FilterGroup>>;
  recentSearches: RecentSearch[];
  minCompleteness: number;
  setMinCompleteness: (val: number) => void;
  columns: ColumnConfig[];
  setColumns: React.Dispatch<React.SetStateAction<ColumnConfig[]>>;
  toggleColumn: (key: string) => void;
  toggleAllColumns: (visible: boolean) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  togglePin: (key: string) => void;
  formulas: FormulaConfig[];
  addFormula: (f: Omit<FormulaConfig, "id">) => void;
  updateFormula: (id: string, updates: Partial<FormulaConfig>) => void;
  removeFormula: (id: string) => void;
  categoryNameMap: Map<string, string>;
  categoryCounts: Record<string, number>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAllProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  handleDelete: (ids: string[]) => Promise<void>;
  handleUpdate: (p: Product, base?: Product) => Promise<boolean>;
  handleCreate: (p: Partial<Product>) => Promise<void>;
  handleBatchUpdate: (ids: string[], updates: ProductUpdates) => Promise<void>;
  handleBatchTagging: (ids: string[], tags: string[], mode: "append" | "overwrite" | "remove") => Promise<void>;
  handleBatchReorder: (updates: { id: string, priority: number }[]) => Promise<void>;
  handleImportData: (newProducts: Product[]) => Promise<boolean>;
  clearFilters: () => void;
  selectSingleCategory: (id: string) => void;
  activeFilters: FilterItem[];
  history: Omit<HistoryRecord, 'snapshot'>[];
  restoreSnapshot: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, tProp, language } = useLanguage();
  const { addToast } = useToasts();
  const { setShowSidebar } = useUI();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    const saved = safeStorage.session.getItem("resindb-recent-searches");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore
      }
    }
    return [];
  });

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const traverse = (cats: Category[]) => {
      cats.forEach((c) => {
        map.set(c.id, language === "en" && c.nameEn ? c.nameEn : c.name);
        if (c.children) traverse(c.children);
      });
    };
    traverse(CATEGORY_TREE);
    return map;
  }, [language]);

  const db = useDatabase(categoryNameMap, tProp, addToast, t);
  const {
    allProducts,
    setAllProducts,
    mutations,
    searchQuery,
    setSearchQuery,
    selectedCategoryIds,
    setSelectedCategoryIds,
    advancedFilterGroup,
    setAdvancedFilterGroup,
    setMinCompleteness,
  } = db;

  const restoreProducts = useCallback(async (snapshot: Product[], saveUndo: (confirmed: Product[]) => Promise<void>) => {
    await mutations.run({
      scope: null,
      project: () => snapshot.map(product => ({ ...product, properties: verifyPropertyQuantities(product.properties) })),
      write: async confirmed => {
        await saveUndo(confirmed);
        await api.restoreSnapshot(snapshot);
      },
    });
  }, [mutations]);
  const confirmedSnapshot = useCallback(() => mutations.snapshot(), [mutations]);
  const { history, pushToHistory, restoreSnapshot } = useHistory(allProducts, setAllProducts, restoreProducts, confirmedSnapshot);

  const runMutation = useCallback(async <T,>(specification: ProductMutation<T>, description: string): Promise<T> => {
    let previous: Product[] = [];
    const result = await mutations.run({ ...specification, write: (confirmed) => {
      previous = confirmed;
      return specification.write(confirmed);
    } });
    pushToHistory(description, previous);
    return result;
  }, [mutations, pushToHistory]);

  const categoryCounts = useMemo(() => {
    const products = allProducts;
    const catToProductIds: Record<string, Set<string>> = {};
    
    // 1. Map products to their directly assigned categories
    products.forEach(p => {
      p.categoryIds?.forEach(id => {
        if (!catToProductIds[id]) catToProductIds[id] = new Set();
        catToProductIds[id].add(p.id);
      });
    });

    const finalCounts: Record<string, number> = {};

    // 2. Correct propagation identifying unique products in subtree
    const collectIdsRecursive = (cat: Category): Set<string> => {
      const ids = new Set<string>(catToProductIds[cat.id] || []);
      cat.children?.forEach(child => {
        const childIds = collectIdsRecursive(child);
        childIds.forEach(id => ids.add(id));
      });
      finalCounts[cat.id] = ids.size;
      return ids;
    };
    
    CATEGORY_TREE.forEach(collectIdsRecursive);

    return finalCounts;
  }, [allProducts]);

  const handleCreate = useCallback(async (p: Partial<Product>) => {
    const tempId = `temp-${generateId()}`;
    const now = new Date().toISOString().split('T')[0];
    const optimisticProduct: Product = {
      ...p, id: tempId, gradeName: p.gradeName || "New Product", manufacturer: p.manufacturer || "Unknown",
      manufacturerId: p.manufacturerId || "m-unknown", categoryIds: p.categoryIds || [],
      properties: refreshProperties(p.properties || {}), updatedAt: now, createdAt: now,
    };
    try {
      await runMutation({ scope: null, project: rows => [optimisticProduct, ...rows], write: () => api.create(p) }, `Create product ${p.gradeName || 'New Product'}`);
      addToast("success", t("createSuccess") || "Product created successfully");
    } catch (error) {
      addToast("error", (t("createFailed") || "Failed to create product: ") + (error instanceof Error ? error.message : t("unknownError")));
    }
  }, [runMutation, addToast, t]);

  const handleDelete = useCallback(async (ids: string[]) => {
    try {
      const selected = new Set(ids);
      await runMutation({ scope: null, requiredIds: ids, project: rows => rows.filter(row => !selected.has(row.id)), write: () => api.delete(ids) }, `Delete ${ids.length} product(s)`);
      setSelectedIds(new Set());
      addToast("success", t("deleteSuccess").replace("{count}", ids.length.toString()));
      setShowSidebar(true);
    } catch (error) {
      addToast("error", t("deleteFailed") + (error instanceof Error ? error.message : t("unknownError")));
    }
  }, [runMutation, addToast, t, setShowSidebar]);

  const handleUpdate = useCallback(async (p: Product, base?: Product): Promise<boolean> => {
    try {
      mutations.requireIds([p.id]);
      const edit = productEdit(base ?? mutations.snapshot().find(row => row.id === p.id)!, p);
      if (edit.fields.length === 0) return true;
      const now = new Date().toISOString().split('T')[0];
      await runMutation({
        scope: new Map([[p.id, edit.fields]]), requiredIds: [p.id],
        project: rows => rows.map(row => row.id === p.id ? applyProductUpdates(row, edit.updates(row), now) : row),
        write: confirmed => api.batchUpdate([p.id], edit.updates(confirmed.find(row => row.id === p.id)!)),
      }, `Update product ${p.gradeName}`);
      addToast("success", t("updateSuccessMsg"));
      setShowSidebar(true);
      return true;
    } catch (error) {
      addToast("error", t("updateFailed") + (error instanceof Error ? error.message : t("unknownError")));
      return false;
    }
  }, [mutations, runMutation, addToast, t, setShowSidebar]);

  const handleBatchUpdate = useCallback(async (ids: string[], updates: ProductUpdates) => {
    try {
      const selected = new Set(ids);
      const fields = updateFields(updates);
      const now = new Date().toISOString().split('T')[0];
      await runMutation({
        scope: new Map(ids.map(id => [id, fields])), requiredIds: ids,
        project: rows => rows.map(row => selected.has(row.id) ? applyProductUpdates(row, updates, now) : row),
        write: () => api.batchUpdate(ids, updates),
      }, `Batch updated ${ids.length} products`);
      addToast("success", t("batchUpdateSuccess"));
      setShowSidebar(true);
    } catch (error) {
      addToast("error", t("batchUpdateFailed") + (error instanceof Error ? error.message : t("unknownError")));
    }
  }, [runMutation, addToast, t, setShowSidebar]);

  const handleBatchTagging = useCallback(async (ids: string[], tags: string[], mode: "append" | "overwrite" | "remove") => {
    const selected = new Set(ids);
    const applyTags = (row: Product): ProductUpdates => ({
      tags: mode === 'overwrite' ? [...tags] : mode === 'remove'
        ? (row.tags ?? []).filter(tag => !tags.includes(tag))
        : [...new Set([...(row.tags ?? []), ...tags])],
    });
    try {
      const modeText = mode === 'append' ? t('tagModeAppend', 'append') : mode === 'overwrite' ? t('tagModeOverwrite', 'overwrite') : t('tagModeRemove', 'remove');
      await runMutation({
        scope: new Map(ids.map(id => [id, ['tags']])), requiredIds: ids,
        project: rows => rows.map(row => selected.has(row.id) ? applyProductUpdates(row, applyTags(row)) : row),
        write: confirmed => awaitAllWrites(confirmed.filter(row => selected.has(row.id)).map(row => api.batchUpdate([row.id], applyTags(row)))),
      }, t('batchTagHistory', 'Bulk tag {mode} ({count} items)').replace('{mode}', modeText).replace('{count}', String(ids.length)));
      addToast('success', t('batchTagSuccess', 'Bulk tagging updated successfully!'));
    } catch (error) {
      addToast('error', t('batchTagFailed', 'Bulk tagging failed: ') + (error instanceof Error ? error.message : t('unknownError')));
    }
  }, [runMutation, addToast, t]);

  const handleBatchReorder = useCallback(async (updates: { id: string; priority: number }[]) => {
    const priorities = new Map(updates.map(update => [update.id, update.priority]));
    try {
      await runMutation({
        scope: new Map([...priorities.keys()].map(id => [id, ['priority']])), requiredIds: [...priorities.keys()],
        project: rows => rows.map(row => priorities.has(row.id) ? applyProductUpdates(row, { priority: priorities.get(row.id)! }) : row),
        write: () => awaitAllWrites([...priorities].map(([id, priority]) => api.batchUpdate([id], { priority }))),
      }, t('batchReorderHistory', 'Bulk reorder/prioritize ({count} items)').replace('{count}', String(updates.length)));
      addToast('success', t('batchReorderSuccess', 'Bulk reordering & priority updated successfully!'));
    } catch (error) {
      addToast('error', t('batchReorderFailed', 'Bulk reordering failed: ') + (error instanceof Error ? error.message : t('unknownError')));
    }
  }, [runMutation, addToast, t]);

  const handleImportData = useCallback(async (incoming: Product[]): Promise<boolean> => {
    try {
      const importedIds = new Set(incoming.map(product => product.id));
      const created = await runMutation({
        scope: null,
        project: rows => [...incoming.map(product => ({ ...product, properties: refreshProperties(product.properties) })), ...rows.filter(product => !importedIds.has(product.id))],
        write: confirmed => persistImportedProducts(api, incoming, confirmed),
      }, `Imported ${incoming.length} products`);
      addToast('success', t('importSuccess').replace('{count}', created.length.toString()));
      setShowSidebar(true);
      return true;
    } catch (error) {
      addToast('error', t('importFailed', 'Import failed: ') + (error instanceof Error ? error.message : t('unknownError')));
      return false;
    }
  }, [runMutation, addToast, t, setShowSidebar]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategoryIds(new Set());
    setAdvancedFilterGroup({
      id: "root",
      type: "group",
      logic: "AND",
      conditions: [],
    });
    setMinCompleteness(0);
  }, [setSearchQuery, setSelectedCategoryIds, setAdvancedFilterGroup, setMinCompleteness]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const q = searchQuery.trim();
      const hasFilters = advancedFilterGroup.conditions.length > 0;
      const hasCategories = selectedCategoryIds.size > 0;
      
      if (q || hasFilters || hasCategories) {
        setRecentSearches(prev => {
          // Avoid duplicates
          const isDup = prev.some(r => 
            r.query === searchQuery && 
            JSON.stringify(r.filters) === JSON.stringify(advancedFilterGroup) &&
            JSON.stringify([...r.selectedCategoryIds].sort()) === JSON.stringify(Array.from(selectedCategoryIds).sort())
          );
          if (isDup) return prev;

          const labelParts = [];
          if (q) labelParts.push(`"${q}"`);
          if (hasCategories) labelParts.push(`${selectedCategoryIds.size} categories`);
          if (hasFilters) labelParts.push(`${advancedFilterGroup.conditions.length} filters`);
          const label = labelParts.join(" + ");

          const newSearch: RecentSearch = {
            id: Date.now().toString(),
            label,
            query: searchQuery,
            filters: advancedFilterGroup,
            selectedCategoryIds: Array.from(selectedCategoryIds),
            timestamp: Date.now()
          };

          const next = [newSearch, ...prev].slice(0, 10); // Keep last 10
          safeStorage.session.setItem("resindb-recent-searches", JSON.stringify(next));
          return next;
        });
      }
    }, 2000); // 2 second debounce to capture final query states

    return () => clearTimeout(handler);
  }, [searchQuery, advancedFilterGroup, selectedCategoryIds]);

  const selectSingleCategory = useCallback((id: string) => {
    setSelectedCategoryIds(new Set([id]));
  }, [setSelectedCategoryIds]);

  const activeFilters = useMemo(() => {
    const items: FilterItem[] = [];
    if (searchQuery.trim()) {
      items.push({
        id: "search",
        label: `${language === 'zh' ? '搜索' : 'Search'}: "${searchQuery}"`,
        type: "search",
        onRemove: () => setSearchQuery(""),
      });
    }
    selectedCategoryIds.forEach((id) => {
      items.push({
        id: id,
        label: categoryNameMap.get(id) || id,
        type: "category",
        onRemove: () => {
          setSelectedCategoryIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      });
    });
    if (advancedFilterGroup.conditions.length > 0) {
      items.push({
        id: "advanced-filters",
        label: `${t("advancedFilters")} (${advancedFilterGroup.conditions.length})`,
        type: "advanced",
        onRemove: () =>
          setAdvancedFilterGroup({
            id: "root",
            type: "group",
            logic: "AND",
            conditions: [],
          }),
      });
    }
    return items;
  }, [searchQuery, setSearchQuery, selectedCategoryIds, setSelectedCategoryIds, advancedFilterGroup, setAdvancedFilterGroup, categoryNameMap, t, language]);

  const value = useMemo(() => ({
    ...db,
    categoryNameMap,
    categoryCounts,
    recentSearches,
    selectedIds,
    setSelectedIds,
    handleDelete,
    handleUpdate,
    handleCreate,
    handleBatchUpdate,
    handleBatchTagging,
    handleBatchReorder,
    handleImportData,
    clearFilters,
    selectSingleCategory,
    activeFilters,
    history,
    restoreSnapshot,
  }), [
    db,
    categoryNameMap,
    categoryCounts,
    recentSearches,
    selectedIds,
    handleDelete,
    handleUpdate,
    handleCreate,
    handleBatchUpdate,
    handleBatchTagging,
    handleBatchReorder,
    handleImportData,
    clearFilters,
    selectSingleCategory,
    activeFilters,
    history,
    restoreSnapshot,
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

 
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
