import { useCallback } from 'react';
import { useWorkerManager } from './useWorkerManager';
import type { CopulaMessage, CopulaResponse } from '@/workers/copulaWorker';
import { empiricalCdf, gaussianCopulaCdf } from '@/compute/gaussianCopula';

export function useCopulaWorker() {
  const {
    isCalculating,
    result: copulaResult,
    error,
    postMessage
  } = useWorkerManager<CopulaMessage, CopulaResponse['payload']>(
    useCallback(() => new Worker(new URL('../../workers/copulaWorker.ts', import.meta.url), { type: 'module' }), []),
    'COPULA_RESULT'
  );

  const calculateCopula = useCallback((data: { x: number; y: number }[]) => {
    postMessage({
      type: 'CALCULATE_COPULA',
      payload: { data }
    });
  }, [postMessage]);

  const getJointFailureProb = useCallback((thresholdX: number, thresholdY: number) => {
    if (!copulaResult) return null;
    const { sortedX, sortedY, rho } = copulaResult;
    if (!Number.isFinite(thresholdX) || !Number.isFinite(thresholdY)) return null;
    return gaussianCopulaCdf(empiricalCdf(sortedX, thresholdX), empiricalCdf(sortedY, thresholdY), rho);
  }, [copulaResult]);

  return { isCalculating, copulaResult, error, calculateCopula, getJointFailureProb };
}
