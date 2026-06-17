import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import { Product, ColumnConfig, FilterGroup, ProductUpdates, FormulaConfig, FilterItem, Category } from '@/types/index';
import { useLanguage } from "@/contexts/LanguageContext";
import { useToasts } from "@/contexts/ToastContext";
import { useUI } from "@/contexts/UIContext";
import { useDatabase } from '@/hooks/app/useDatabase';
import { CATEGORY_TREE } from '@/config/constants';
import { api } from '@/services/api';
import { useHistory } from '@/hooks/app/useHistory';
import { HistoryRecord } from "@/lib/adapters/types";

export interface SyncEvent {
  id: string;
  timestamp: number;
  status: 'success' | 'error';
  message: string;
}

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
  handleUpdate: (p: Product) => Promise<void>;
  handleCreate: (p: Partial<Product>) => Promise<void>;
  handleBatchUpdate: (ids: string[], updates: ProductUpdates) => Promise<void>;
  handleBatchTagging: (ids: string[], tags: string[], mode: "append" | "overwrite" | "remove") => Promise<void>;
  handleBatchReorder: (updates: { id: string, priority: number }[]) => Promise<void>;
  handleImportData: (newProducts: Product[]) => void;
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
    try {
      const saved = typeof window !== 'undefined' ? sessionStorage.getItem("resindb-recent-searches") : null;
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
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
  const { history, pushToHistory, restoreSnapshot } = useHistory(db.allProducts, db.setAllProducts);

  const categoryCounts = useMemo(() => {
    const products = db.allProducts;
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
  }, [db.allProducts]);

  const handleCreate = useCallback(async (p: Partial<Product>) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticProduct: Product = {
      id: tempId,
      gradeName: p.gradeName || "New Product",
      manufacturer: p.manufacturer || "Unknown",
      manufacturerId: "m-unknown",
      categoryIds: p.categoryIds || [],
      properties: p.properties || {},
      updatedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString().split('T')[0],
    };

    db.setAllProducts((prev) => [optimisticProduct, ...prev]);

    try {
      pushToHistory(`Create product ${p.gradeName || 'New Product'}`, db.allProducts);
      const created = await api.create(p);
      db.setAllProducts((prev) =>
        prev.map((old) => (old.id === tempId ? created : old)),
      );
      addToast("success", t("createSuccess") || "Product created successfully");
    } catch (error) {
      db.setAllProducts((prev) => prev.filter((product) => product.id !== tempId));
      addToast(
        "error",
        (t("createFailed") || "Failed to create product: ") +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    }
  }, [db, addToast, t, pushToHistory]);

  const handleDelete = useCallback(async (ids: string[]) => {
    let previousProducts: Product[] = [];
    db.setAllProducts((prev) => {
      previousProducts = prev;
      return prev.filter((p) => !ids.includes(p.id));
    });
    setSelectedIds(new Set());

    try {
      pushToHistory(`Delete ${ids.length} product(s)`, previousProducts);
      await api.delete(ids);
      addToast(
        "success",
        t("deleteSuccess").replace("{count}", ids.length.toString()),
      );
      setShowSidebar(true);
    } catch (error) {
      db.setAllProducts(previousProducts);
      addToast(
        "error",
        t("deleteFailed") +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    }
  }, [db, setSelectedIds, addToast, t, setShowSidebar, pushToHistory]);

  const handleUpdate = useCallback(async (p: Product) => {
    let previousProducts: Product[] = [];
    db.setAllProducts((prev) => {
      previousProducts = prev;
      return prev.map((old) => (old.id === p.id ? p : old));
    });

    try {
      pushToHistory(`Update product ${p.gradeName}`, previousProducts);
      const updated = await api.update(p);
      db.setAllProducts((prev) =>
        prev.map((old) => (old.id === updated.id ? updated : old)),
      );
      addToast("success", t("updateSuccessMsg"));
      setShowSidebar(true);
    } catch (error) {
      db.setAllProducts(previousProducts);
      addToast(
        "error",
        t("updateFailed") +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    }
  }, [db, addToast, t, setShowSidebar, pushToHistory]);

  const handleBatchUpdate = useCallback(async (ids: string[], updates: ProductUpdates) => {
    let previousProducts: Product[] = [];
    const { _propertyUpdates, ...restUpdates } = updates;

    db.setAllProducts((prev) => {
      previousProducts = prev;
      return prev.map((p) => {
        if (!ids.includes(p.id)) return p;

        const newProperties = { ...p.properties };
        if (_propertyUpdates) {
          Object.keys(_propertyUpdates).forEach((key) => {
            const updateVal = _propertyUpdates[key];

            if (
              updateVal !== null &&
              typeof updateVal === "object" &&
              "value" in updateVal
            ) {
              newProperties[key] = { ...newProperties[key], ...updateVal };
            } else if (
              updateVal !== null &&
              (typeof updateVal === "string" || typeof updateVal === "number")
            ) {
              if (newProperties[key]) {
                newProperties[key] = {
                  ...newProperties[key],
                  value: updateVal,
                };
              } else {
                newProperties[key] = { value: updateVal, unit: "" };
              }
            }
          });
        }

        return { ...p, ...restUpdates, properties: newProperties };
      });
    });

    try {
      pushToHistory(`Batch updated ${ids.length} products`, previousProducts);
      await api.batchUpdate(ids, updates);
      addToast("success", t("batchUpdateSuccess"));
      setShowSidebar(true);
    } catch (error) {
      db.setAllProducts(previousProducts);
      addToast(
        "error",
        t("batchUpdateFailed") +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    }
  }, [db, addToast, t, setShowSidebar, pushToHistory]);

  const handleBatchTagging = useCallback(async (
    ids: string[],
    tagsToApply: string[],
    mode: "append" | "overwrite" | "remove"
  ) => {
    let previousProducts: Product[] = [];
    let updatedList: Product[] = [];

    db.setAllProducts((prev) => {
      previousProducts = prev;
      updatedList = prev.map((p) => {
        if (!ids.includes(p.id)) return p;

        let newTags = p.tags ? [...p.tags] : [];
        if (mode === "append") {
          tagsToApply.forEach((t) => {
            if (!newTags.includes(t)) newTags.push(t);
          });
        } else if (mode === "overwrite") {
          newTags = [...tagsToApply];
        } else if (mode === "remove") {
          newTags = newTags.filter((t) => !tagsToApply.includes(t));
        }

        return {
          ...p,
          tags: newTags,
          updatedAt: new Date().toISOString().split("T")[0],
        };
      });
      return updatedList;
    });

    try {
      const modeText = mode === "append" ? "追加" : mode === "overwrite" ? "覆盖" : "移除";
      pushToHistory(`批量${modeText}标签 (${ids.length} 个牌号)`, previousProducts);
      
      const affectedProducts = updatedList.filter(p => ids.includes(p.id));
      await Promise.all(affectedProducts.map(p => api.update(p)));

      addToast("success", language === "zh" ? "批量修改标签成功！" : "Bulk tagging updated successfully!");
    } catch (error) {
      db.setAllProducts(previousProducts);
      addToast(
        "error",
        (language === "zh" ? "批量修改标签失败: " : "Bulk tagging failed: ") +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    }
  }, [db, addToast, t, language, pushToHistory]);

  const handleBatchReorder = useCallback(async (
    updates: { id: string; priority: number }[]
  ) => {
    let previousProducts: Product[] = [];
    let updatedList: Product[] = [];

    const updateMap = new Map<string, number>();
    updates.forEach((u) => updateMap.set(u.id, u.priority));

    db.setAllProducts((prev) => {
      previousProducts = prev;
      updatedList = prev.map((p) => {
        if (!updateMap.has(p.id)) return p;
        return {
          ...p,
          priority: updateMap.get(p.id)!,
          updatedAt: new Date().toISOString().split("T")[0],
        };
      });
      return updatedList;
    });

    try {
      const titleText = language === "zh" ? `批量重排/定义优先级 (${updates.length} 个牌号)` : `Bulk reorder/prioritize (${updates.length} items)`;
      pushToHistory(titleText, previousProducts);
      
      const affectedProducts = updatedList.filter((p) => updateMap.has(p.id));
      await Promise.all(affectedProducts.map((p) => api.update(p)));

      addToast("success", language === "zh" ? "批量重排与优先级更新成功！" : "Bulk reordering & priority updated successfully!");
    } catch (error) {
      db.setAllProducts(previousProducts);
      addToast(
        "error",
        (language === "zh" ? "批量重排失败: " : "Bulk reordering failed: ") +
          (error instanceof Error ? error.message : t("unknownError")),
      );
    }
  }, [db, addToast, t, language, pushToHistory]);

  const handleImportData = useCallback(async (newProducts: Product[]) => {
    const previousProducts = [...db.allProducts];
    // Add temporary IDs for optimistic UI if needed, but here we just show a loader if we wanted
    // However, since imports can be large, we'll do it as a background task with success notification
    try {
      pushToHistory(`Imported ${newProducts.length} products`, previousProducts);
      const created = await api.batchCreate(newProducts);
      db.setAllProducts((prev) => [...created, ...prev]);
      addToast(
        "success",
        t("importSuccess").replace("{count}", created.length.toString()),
      );
      setShowSidebar(true);
    } catch (error) {
      addToast(
        "error",
        t("importFailed", "Import failed: ") + (error instanceof Error ? error.message : t("unknownError")),
      );
    }
  }, [db, addToast, t, setShowSidebar, pushToHistory]);

  const clearFilters = useCallback(() => {
    db.setSearchQuery("");
    db.setSelectedCategoryIds(new Set());
    db.setAdvancedFilterGroup({
      id: "root",
      type: "group",
      logic: "AND",
      conditions: [],
    });
    db.setMinCompleteness(0);
  }, [db]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const q = db.searchQuery.trim();
      const hasFilters = db.advancedFilterGroup.conditions.length > 0;
      const hasCategories = db.selectedCategoryIds.size > 0;
      
      if (q || hasFilters || hasCategories) {
        setRecentSearches(prev => {
          // Avoid duplicates
          const isDup = prev.some(r => 
            r.query === db.searchQuery && 
            JSON.stringify(r.filters) === JSON.stringify(db.advancedFilterGroup) &&
            JSON.stringify([...r.selectedCategoryIds].sort()) === JSON.stringify(Array.from(db.selectedCategoryIds).sort())
          );
          if (isDup) return prev;

          const labelParts = [];
          if (q) labelParts.push(`"${q}"`);
          if (hasCategories) labelParts.push(`${db.selectedCategoryIds.size} categories`);
          if (hasFilters) labelParts.push(`${db.advancedFilterGroup.conditions.length} filters`);
          const label = labelParts.join(" + ");

          const newSearch: RecentSearch = {
            id: Date.now().toString(),
            label,
            query: db.searchQuery,
            filters: db.advancedFilterGroup,
            selectedCategoryIds: Array.from(db.selectedCategoryIds),
            timestamp: Date.now()
          };

          const next = [newSearch, ...prev].slice(0, 10); // Keep last 10
          try {
            sessionStorage.setItem("resindb-recent-searches", JSON.stringify(next));
          } catch {
            // Ignore security error in sandboxed iframe
          }
          return next;
        });
      }
    }, 2000); // 2 second debounce to capture final query states

    return () => clearTimeout(handler);
  }, [db.searchQuery, db.advancedFilterGroup, db.selectedCategoryIds]);

  const selectSingleCategory = useCallback((id: string) => {
    db.setSelectedCategoryIds(new Set([id]));
  }, [db]);

  const activeFilters = useMemo(() => {
    const items: FilterItem[] = [];
    if (db.searchQuery.trim()) {
      items.push({
        id: "search",
        label: `Search: "${db.searchQuery}"`,
        type: "search",
        onRemove: () => db.setSearchQuery(""),
      });
    }
    db.selectedCategoryIds.forEach((id) => {
      items.push({
        id: id,
        label: categoryNameMap.get(id) || id,
        type: "category",
        onRemove: () => {
          db.setSelectedCategoryIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      });
    });
    if (db.advancedFilterGroup.conditions.length > 0) {
      items.push({
        id: "advanced-filters",
        label: `${t("advancedFilters")} (${db.advancedFilterGroup.conditions.length})`,
        type: "advanced",
        onRemove: () =>
          db.setAdvancedFilterGroup({
            id: "root",
            type: "group",
            logic: "AND",
            conditions: [],
          }),
      });
    }
    return items;
  }, [db, categoryNameMap, t]);

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
