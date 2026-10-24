
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ColumnConfig, Product } from '@/types/index';
import { getDynamicColumns } from '@/utils/productUtils';
import { logger } from '@/lib/logger';
import { useFormulas } from '@/hooks/math/useFormulas';
import { safeStorage } from '@/lib/utils';

export function useColumns(allProducts: Product[]) {
  const { formulas, addFormula, updateFormula, removeFormula } = useFormulas();
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const isInitialized = useRef(false);

  const computedColumns = useMemo(() => {
    return formulas.map(f => ({
      key: f.id,
      label: f.name,
      visible: true,
      isSystem: false,
      isComputed: true,
      formulaId: f.id
    }));
  }, [formulas]);

  // Sync columns when formulas change
  useEffect(() => {
    if (isInitialized.current) {
      setColumns(prev => {
        const next = [...prev];
        
        // Add new computed columns
        computedColumns.forEach(cc => {
          if (!next.find(c => c.key === cc.key)) {
            next.push(cc);
          }
        });

        // Update labels/status for existing computed columns
        const updated = next.map(c => {
          if (c.isComputed) {
            const found = computedColumns.find(cc => cc.key === c.key);
            if (found) {
                return { ...c, label: found.label };
            }
          }
          return c;
        });

        // Remove deleted computed columns
        return updated.filter(c => !c.isComputed || computedColumns.find(cc => cc.key === c.key));
      });
    }
  }, [computedColumns]);

  // Initialize columns once, then refresh inferred types without losing user settings.
  useEffect(() => {
    if (allProducts.length === 0) return;
    const inferredColumns = getDynamicColumns(allProducts);

    if (!isInitialized.current) {
      isInitialized.current = true;
      let baseCols = [...inferredColumns, ...computedColumns];
      
      const savedVisibility = safeStorage.local.getItem('resindb-visible-columns-v2');
      const savedOrder = safeStorage.local.getItem('resindb-column-order');

      // Apply visibility
      if (savedVisibility) {
        try {
          const visibleKeys = new Set(JSON.parse(savedVisibility));
          baseCols = baseCols.map(c => ({
            ...c,
            visible: c.isSystem || visibleKeys.has(c.key)
          }));
        } catch (e) {
          logger.error('Failed to parse column visibility:', e);
        }
      }

      // Apply order
      if (savedOrder) {
        try {
          const orderKeys = JSON.parse(savedOrder) as string[];
          const orderedCols: ColumnConfig[] = [];
          
          orderKeys.forEach(key => {
            const found = baseCols.find(c => c.key === key);
            if (found) orderedCols.push(found);
          });
          
          baseCols.forEach(c => {
            if (!orderKeys.includes(c.key)) orderedCols.push(c);
          });
          
          setColumns(orderedCols);
        } catch (e) {
          logger.error('Failed to parse column order:', e);
          setColumns(baseCols);
        }
      } else {
        setColumns(baseCols);
      }
      return;
    }

    const inferredByKey = new Map(inferredColumns.map((column) => [column.key, column]));
    let persistedVisibleKeys: Set<string> | null = null;
    const savedVisibility = safeStorage.local.getItem('resindb-visible-columns-v2');
    if (savedVisibility !== null) {
      try {
        const parsed: unknown = JSON.parse(savedVisibility);
        if (Array.isArray(parsed)) {
          persistedVisibleKeys = new Set(parsed.filter((key): key is string => typeof key === 'string'));
        }
      } catch (error) {
        logger.error('Failed to parse column visibility:', error);
      }
    }

    setColumns((previous) => {
      let changed = false;
      const next = previous.map((column) => {
        if (column.isSystem || column.isComputed) return column;
        const inferred = inferredByKey.get(column.key);
        const nextColumn = { ...column };
        if (inferred?.type === undefined) delete nextColumn.type;
        else nextColumn.type = inferred.type;
        const typeChanged = nextColumn.type !== column.type;
        if (typeChanged) changed = true;
        return typeChanged ? nextColumn : column;
      });

      const existingKeys = new Set(previous.map((column) => column.key));
      inferredColumns.forEach((column) => {
        if (column.isSystem || existingKeys.has(column.key)) return;
        next.push(persistedVisibleKeys === null
          ? column
          : { ...column, visible: persistedVisibleKeys.has(column.key) });
        existingKeys.add(column.key);
        changed = true;
      });
      return changed ? next : previous;
    });
  }, [allProducts, computedColumns]);

  // Persist visibility and order changes
  useEffect(() => {
    if (columns.length > 0) {
      const visibleKeys = columns.filter(c => c.visible).map(c => c.key);
      const orderKeys = columns.map(c => c.key);
      safeStorage.local.setItem('resindb-visible-columns-v2', JSON.stringify(visibleKeys));
      safeStorage.local.setItem('resindb-column-order', JSON.stringify(orderKeys));
    }
  }, [columns]);

  const toggleColumn = useCallback((key: string) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }, []);

  const toggleAllColumns = useCallback((visible: boolean) => {
    setColumns(prev => prev.map(c => c.isSystem ? c : { ...c, visible }));
  }, []);

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  }, []);

  const togglePin = useCallback((key: string) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, isPinned: !c.isPinned } : c));
  }, []);

  return useMemo(() => ({
    columns,
    setColumns,
    toggleColumn,
    toggleAllColumns,
    moveColumn,
    togglePin,
    formulas,
    addFormula,
    updateFormula,
    removeFormula
  }), [
    columns,
    toggleColumn,
    toggleAllColumns,
    moveColumn,
    togglePin,
    formulas,
    addFormula,
    updateFormula,
    removeFormula
  ]);
}
