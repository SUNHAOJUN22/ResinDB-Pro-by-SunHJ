import { useMemo } from "react";
import { FilterItem, FilterGroup } from "../types";

export function useActiveFilters({
  deferredSearchQuery,
  selectedCategoryIds,
  advancedFilterGroup,
  categoryNameMap,
  toggleCategory,
  setSearchQuery,
  setAdvancedFilterGroup,
  t,
}: {
  deferredSearchQuery: string;
  selectedCategoryIds: Set<string>;
  advancedFilterGroup: FilterGroup;
  categoryNameMap: Map<string, string>;
  toggleCategory: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setAdvancedFilterGroup: (group: FilterGroup) => void;
  t: (key: string, fallback?: string) => string;
}) {
  const activeFilters = useMemo<FilterItem[]>(() => {
    const items: FilterItem[] = [];
    if (deferredSearchQuery.trim()) {
      items.push({
        id: "search",
        label: `Search: "${deferredSearchQuery}"`,
        type: "search",
        onRemove: () => setSearchQuery(""),
      });
    }
    selectedCategoryIds.forEach((id) => {
      items.push({
        id: id,
        label: categoryNameMap.get(id) || id,
        type: "category",
        onRemove: () => toggleCategory(id),
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
  }, [
    deferredSearchQuery,
    selectedCategoryIds,
    advancedFilterGroup,
    categoryNameMap,
    toggleCategory,
    setSearchQuery,
    setAdvancedFilterGroup,
    t,
  ]);

  return activeFilters;
}
