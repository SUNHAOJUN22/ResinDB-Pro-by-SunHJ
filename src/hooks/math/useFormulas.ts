import { defaultFormulas, migrateDefaultFormulas } from '@/lib/defaultFormulaMigration';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FormulaConfig } from '@/types/index';
import { safeStorage } from '@/lib/utils';

export function useFormulas() {
  const [formulas, setFormulas] = useState<FormulaConfig[]>(() => {
    const saved = safeStorage.local.getItem('resindb-formulas');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return migrateDefaultFormulas(parsed);
      } catch {
        // Ignored
      }
    }
    
    // Default professional polymer science formulas
    return defaultFormulas();
  });

  useEffect(() => {
    safeStorage.local.setItem('resindb-formulas', JSON.stringify(formulas));
  }, [formulas]);

  const addFormula = useCallback((formula: Omit<FormulaConfig, 'id'>) => {
    const newFormula: FormulaConfig = {
      ...formula,
      id: `f_${Date.now()}`
    };
    setFormulas(prev => [...prev, newFormula]);
    return newFormula;
  }, []);

  const updateFormula = useCallback((id: string, updates: Partial<FormulaConfig>) => {
    setFormulas(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFormula = useCallback((id: string) => {
    setFormulas(prev => prev.filter(f => f.id !== id));
  }, []);

  return useMemo(() => ({
    formulas,
    addFormula,
    updateFormula,
    removeFormula
  }), [formulas, addFormula, updateFormula, removeFormula]);
}
