import React from 'react';
import { Info } from 'lucide-react';
import { ScientificMath } from '@/components/ui/ScientificMath';
import { useLanguage } from '@/contexts/LanguageContext';

// Only formulas matching an implemented method are displayed. This is not execution evidence.
export const ANALYSIS_METHOD_FORMULAS: Readonly<Record<string, string>> = {
  radar: String.raw`z_j=20+80\,\frac{n_{<j}+n_{=j}/2}{n_j}`,
  rsm: String.raw`\hat y=\beta_0+\beta_1x_1+\beta_2x_2+\beta_{11}x_1^2+\beta_{22}x_2^2+\beta_{12}x_1x_2`,
  mahalanobis: String.raw`D_M^2=(x-\mu)^T\Sigma_\lambda^{-1}(x-\mu)`,
  copula: String.raw`C_\rho(u,v)=\Phi_\rho\!\left(\Phi^{-1}(u),\Phi^{-1}(v)\right)`,
  arrhenius: String.raw`\ln(t_f)=a+b/T,\qquad E_a=Rb`,
  weibull: String.raw`F(t)=1-\exp\!\left[-(t/\eta)^\beta\right]`,
};
export const AnalysisMethodPanel = React.memo(({ mode, records, description }: {
  mode: string; records: number; description?: string;
}) => {
  const { language, t } = useLanguage();
  const formula = ANALYSIS_METHOD_FORMULAS[mode];
  return <details className="rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" data-analysis-method={mode}>
    <summary className="flex min-h-10 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <Info size={15} aria-hidden="true" />
      <span className="font-semibold">{t(`chart_${mode}`)}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{language === 'en' ? 'Method, inputs & limits' : '方法、输入与适用边界'}</span>
      <span className="ml-auto text-xs tabular-nums">{language === 'en' ? `${records} filtered records` : `${records} 条筛选记录`}</span>
    </summary>
    <div className="space-y-2 border-t border-slate-200 px-3 py-3 text-xs leading-6 dark:border-slate-700">
      {description && <p>{description}</p>}
      {formula && <div className="overflow-x-auto"><ScientificMath tex={formula} /></div>}
      <p>{language === 'en'
        ? 'The record count is not the fitted sample size. Each method applies its own finite-value, unit and condition checks. Observations, fitted models and scenario projections are different evidence classes.'
        : '筛选记录数不等于实际拟合样本数。各方法另行检查有限数值、单位与实验条件；观测、拟合模型与情景投影属于不同证据类别。'}</p>
      {(mode === 'mahalanobis' || mode === 'correlation' || mode === 'feature_importance') && <p>{language === 'en'
        ? 'Statistical screening is not causal inference or material certification. A distribution threshold does not by itself calibrate outlier rates for fitted or regularized covariance.'
        : '统计筛查不是因果推断或材料认证。分布阈值本身不能校准由样本拟合或正则化协方差产生的异常率。'}</p>}
    </div>
  </details>;
});
