import React from 'react';
import { Info } from 'lucide-react';
import { DataVisualizer as LegacyDataVisualizer } from './DataVisualizerLegacy';
import { useLanguage } from '@/contexts/LanguageContext';
import { ScientificMath } from '@/components/ui/ScientificMath';
type Props = React.ComponentProps<typeof LegacyDataVisualizer>;
export const DataVisualizer: React.FC<Props> = React.memo((props) => {
  const { language } = useLanguage();
  return <section className="scientific-panel flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" aria-label={language === 'en' ? 'Scientific figure workspace' : '科研绘图工作区'}>
    <div className="flex shrink-0 items-start gap-2 border-b border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
      <Info size={15} className="mt-0.5 shrink-0 text-indigo-600" />
      <p>{language === 'en' ? 'Measured observations, fitted models, rule-generated proxies and scenario projections have distinct meanings. Missing values are excluded. Ridge attribution is associative, not causal.' : '观测、拟合、规则代理与情景投影分别解读；缺失值排除；岭回归归因表示统计关联，不证明因果。'}</p>
    </div>
    <div className="shrink-0 overflow-x-auto px-4 py-2 text-xs"><ScientificMath tex={String.raw`z_j=20+80\,\frac{n_{<j}+n_{=j}/2}{n_j},\qquad D_M^2=(x-\mu)^T\Sigma_\lambda^{-1}(x-\mu)`} /></div>
    <LegacyDataVisualizer {...props} />
  </section>;
});
