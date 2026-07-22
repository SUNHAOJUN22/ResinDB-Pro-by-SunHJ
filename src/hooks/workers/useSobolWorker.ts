import { useCallback } from 'react';
import { useWorkerManager } from './useWorkerManager';
import { Product, FormulaConfig } from '@/types/index';
import type { SobolMessage, SobolResponse } from '@/workers/sobolWorker';

export function useSobolWorker() {
  const {
    isCalculating,
    result: sobolResult,
    setResult: setSobolResult,
    error,
    postMessage
  } = useWorkerManager<SobolMessage, SobolResponse['payload']>(
    useCallback(() => new Worker(new URL('../../workers/sobolWorker.ts', import.meta.url), { type: 'module' }), []),
    'SOBOL_COMPLETE'
  );

  const runAnalysis = useCallback((
    targetFormulaId: string, 
    formulas: FormulaConfig[], 
    product: Product, 
    variances: Record<string, number>,
    iterations: number = 2000
  ) => {
    setSobolResult(null);
    postMessage({
      type: 'RUN_SOBOL',
      payload: {
        targetFormulaId,
        formulas,
        product,
        variances,
        iterations
      }
    });
  }, [postMessage, setSobolResult]);

  return { isCalculating, sobolResult, error, runAnalysis };
}
