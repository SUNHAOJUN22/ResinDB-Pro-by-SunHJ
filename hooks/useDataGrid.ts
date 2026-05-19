import { useState, useMemo, useCallback } from 'react';
import { Product, SortConfig, ColumnConfig, FilterItem } from '../types';
import { calculateCompleteness, isLowBest } from '../productUtils';
import { formulaEngine } from '../lib/formulaParser';
import { useFormulas } from './useFormulas';

interface UseDataGridProps {
  data: Product[];
  columns: ColumnConfig[];
  activeFilters?: FilterItem[];
  selectedIds?: Set<string>;
  onSelectionChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * Custom hook for managing DataGrid state and logic.
 * Implements filtering, sorting, and selection logic decoupled from UI.
 * 
 * @param props - Configuration options including initial data and filters
 * @returns Object containing processed data and state management functions
 */
export function useDataGrid({ data, columns, activeFilters = [], selectedIds: controlledSelectedIds, onSelectionChange }: UseDataGridProps) {
  const { formulas } = useFormulas();
  const [sortConfig, setSortConfig] = useState<SortConfig[]>(() => {
    const saved = localStorage.getItem('resindb-sort-config-multi');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleSetSortConfig = useCallback((key: string, multi: boolean = false) => {
    setSortConfig((prev) => {
      const existingIndex = prev.findIndex((s) => s.key === key);
      let next: SortConfig[];

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        if (existing.direction === 'asc') {
          // asc -> desc
          next = [...prev];
          next[existingIndex] = { ...existing, direction: 'desc' };
        } else {
          // desc -> off
          next = prev.filter((_, i) => i !== existingIndex);
        }
      } else {
        // off -> asc
        const newSort: SortConfig = { key, direction: 'asc' };
        next = multi ? [...prev, newSort] : [newSort];
      }

      localStorage.setItem('resindb-sort-config-multi', JSON.stringify(next));
      return next;
    });
  }, []);

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());

  const selectedIds = controlledSelectedIds !== undefined ? controlledSelectedIds : internalSelectedIds;

  const updateSelection = useCallback((newSet: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (onSelectionChange) {
      onSelectionChange(newSet);
    } else {
      setInternalSelectedIds(newSet);
    }
  }, [onSelectionChange]);

  // Filter data
  const filteredData = useMemo(() => {
    if (!activeFilters || activeFilters.length === 0) return data;
    
    return data.filter(product => {
      return activeFilters.every(filter => {
        if (filter.type === 'search') {
          const searchLower = filter.label.toLowerCase();
          
          if (product.gradeName.toLowerCase().includes(searchLower)) return true;
          if (product.manufacturer.toLowerCase().includes(searchLower)) return true;
          
          const props = product.properties;
          for (const key in props) {
             if (String(props[key].value).toLowerCase().includes(searchLower)) return true;
          }
          return false;
        }
        return true;
      });
    });
  }, [data, activeFilters]);

  // Sort data
  const sortedData = useMemo(() => {
    if (sortConfig.length === 0) {
      return [...filteredData];
    }
    
    // Pre-compile graph
    const formulaExecutor = formulaEngine.compileGraph(formulas);
    
    // Sort logic using priority chain
    const precalculatedScores = new Map<string, number>();
    if (sortConfig.some(s => s.key === 'completeness')) {
      filteredData.forEach(p => {
        precalculatedScores.set(p.id, calculateCompleteness(p));
      });
    }

    return [...filteredData].sort((a, b) => {
       for (const sort of sortConfig) {
         let aVal: unknown;
         let bVal: unknown;
 
         if (sort.key === 'completeness') {
           aVal = precalculatedScores.get(a.id);
           bVal = precalculatedScores.get(b.id);
         } else {
          const col = columns.find(c => c.key === sort.key);
          if (col?.isComputed && col.formulaId) {
            aVal = formulaExecutor(a)[col.formulaId];
            bVal = formulaExecutor(b)[col.formulaId];
          } else {
            aVal = a.properties[sort.key]?.value ?? (a as unknown as Record<string, unknown>)[sort.key];
            bVal = b.properties[sort.key]?.value ?? (b as unknown as Record<string, unknown>)[sort.key];
          }
        }

        if (aVal === bVal) continue;
        
        // Handle nulls
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        const isLow = isLowBest(sort.key);
        const m = sort.direction === 'asc' ? 1 : -1;
        const revM = isLow ? -m : m;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * revM;
        }

        const sA = String(aVal).toLowerCase();
        const sB = String(bVal).toLowerCase();
        
        if (sA < sB) return -m;
        if (sA > sB) return m;
      }
      return 0;
    });
  }, [filteredData, sortConfig, columns, formulas]);

  // Selection
  const toggleSelection = useCallback((id: string) => {
    updateSelection(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }, [updateSelection]);

  const toggleAllSelection = useCallback(() => {
    updateSelection(prev => {
        if (prev.size === sortedData.length && sortedData.length > 0) {
            return new Set();
        } else {
            return new Set(sortedData.map(item => item.id));
        }
    });
  }, [sortedData, updateSelection]);

  const clearSelection = useCallback(() => {
    updateSelection(new Set());
  }, [updateSelection]);

  return {
    sortedData,
    sortConfig,
    setSortConfig: handleSetSortConfig,
    selectedIds,
    toggleSelection,
    toggleAllSelection,
    clearSelection
  };
}
