import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { Product, ColumnConfig, FilterGroup, ProductUpdates, FormulaConfig, FilterItem, Category } from "../types";
import { useLanguage } from "./LanguageContext";
import { useToasts } from "./ToastContext";
import { useUI } from "./UIContext";
import { useDatabase } from "../hooks/useDatabase";
import { CATEGORY_TREE } from "../constants";
import { api } from "../api";
import { useHistory } from "../hooks/useHistory";
import { HistoryRecord } from "../lib/adapters/types";

interface DataContextType {
  allProducts: Product[];
  filteredData: Product[];
  isLoading: boolean;

  isRefreshing: boolean;
  refreshData: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategoryIds: Set<string>;
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  advancedFilterGroup: FilterGroup;
  setAdvancedFilterGroup: React.Dispatch<React.SetStateAction<FilterGroup>>;
  minCompleteness: number;
  setMinCompleteness: (val: number) => void;
  columns: ColumnConfig[];
  setColumns: React.Dispatch<React.SetStateAction<ColumnConfig[]>>;
  toggleColumn: (key: string) => void;
  toggleAllColumns: (visible: boolean) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  togglePin: (key: string) => void;
  formulas: FormulaConfig[];
  addFormula: (f: FormulaConfig) => void;
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
    const previousProducts = [...db.allProducts];
    db.setAllProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
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
    const previousProducts = [...db.allProducts];
    db.setAllProducts((prev) => prev.map((old) => (old.id === p.id ? p : old)));

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
    const previousProducts = [...db.allProducts];
    const { _propertyUpdates, ...restUpdates } = updates;

    db.setAllProducts((prev) =>
      prev.map((p) => {
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
      }),
    );

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
    selectedIds,
    setSelectedIds,
    handleDelete,
    handleUpdate,
    handleCreate,
    handleBatchUpdate,
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
    selectedIds,
    handleDelete,
    handleUpdate,
    handleCreate,
    handleBatchUpdate,
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
