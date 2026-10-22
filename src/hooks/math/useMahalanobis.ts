import { admittedPropertyValue } from '@/lib/propertyAdmission';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useCallback, useEffect } from 'react';
import { Product } from '@/types/index';
import { useToasts } from '@/contexts/ToastContext';
import { useMahalanobisWorker as useWorker } from '@/hooks/workers/useMahalanobisWorker';

export function useMahalanobisWorker() {
  const [outlierResults, setOutlierResults] = useState<Record<string, { isOutlier: boolean; distance: number; contributingFeatures: string[] }>>({});
  const { isCalculating: isDetecting, result, runAnalysis } = useWorker();
  const { addToast } = useToasts();
  const { language } = useLanguage();

  useEffect(() => {
    if (result) {
       const mapped: Record<string, { isOutlier: boolean; distance: number; contributingFeatures: string[] }> = {};
       let count = 0;
       result.distances.forEach(d => {
           mapped[d.id] = { isOutlier: d.isOutlier, distance: d.distance, contributingFeatures: [] };
           if(d.isOutlier) count++;
       });
       setOutlierResults(mapped);
       if(count > 0) addToast('error', language === 'en' ? `Identified ${count} screened outliers using Mahalanobis distance.` : `Mahalanobis 距离筛查标记 ${count} 个异常样本。`);
       else addToast('success', language === 'en' ? "No outlier exceeded the selected statistical threshold." : "没有样本超过所选统计阈值。");
    }
  }, [result, addToast, language]);

  const detectOutliers = useCallback((products: Product[], features: string[]) => {
      const eligible = products.filter(product => features.every(key => admittedPropertyValue(product.properties[key]) !== null));
      if (features.length === 0 || eligible.length <= features.length) {
         setOutlierResults({});
         addToast('error', language === 'en'
           ? `Mahalanobis analysis needs n > p: ${eligible.length} complete records, ${features.length} features.`
           : `Mahalanobis 分析需要 n > p：${eligible.length} 条完整记录，${features.length} 个特征。`);
         return;
      }
      const dataRecord = eligible.map(product => {
        const record = { _id: product.id, name: product.gradeName } as Record<string, number> & { _id: string; name: string };
        features.forEach(key => { record[key] = admittedPropertyValue(product.properties[key])!; });
        return record;
      });
      runAnalysis(dataRecord, features, 0.05); // using 0.05 alpha instead of raw threshold
  }, [addToast, runAnalysis, language]);

  const clearOutliers = useCallback(() => {
    setOutlierResults({});
  }, []);

  return {
    outlierResults,
    isDetecting,
    detectOutliers,
    clearOutliers
  };
}
