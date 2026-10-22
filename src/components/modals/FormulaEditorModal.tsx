import React from 'react';
import type { FormulaConfig, Product } from '@/types/index';
import { FormulaEditorModal as LegacyFormulaEditorModal } from './FormulaEditorModalLegacy';
import { useLanguage } from '@/contexts/LanguageContext';
interface Props { isOpen: boolean; onClose: () => void; formulas: FormulaConfig[]; onAdd: (f: Omit<FormulaConfig, 'id'>) => void; onUpdate: (id: string, f: Partial<FormulaConfig>) => void; onRemove: (id: string) => void; allProducts: Product[] }
export const FormulaEditorModal: React.FC<Props> = React.memo((props) => {
  const { language } = useLanguage();
  return <><LegacyFormulaEditorModal {...props}/>{props.isOpen && <div className="pointer-events-none fixed bottom-3 left-1/2 z-[10000] -translate-x-1/2 rounded-lg bg-slate-950/95 px-3 py-2 text-[10px] text-white shadow-xl">{language === 'zh' ? 'Monte Carlo 区间是配置假设下的经验模拟分位数，不是参数置信区间。' : 'Monte Carlo ranges are empirical simulation quantiles under configured assumptions, not parameter confidence intervals.'}</div>}</>;
});
