
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FormulaConfig } from '../types';

export function useFormulas() {
  const [formulas, setFormulas] = useState<FormulaConfig[]>(() => {
    const saved = localStorage.getItem('resindb-formulas');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('resindb-formulas', JSON.stringify(formulas));
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
