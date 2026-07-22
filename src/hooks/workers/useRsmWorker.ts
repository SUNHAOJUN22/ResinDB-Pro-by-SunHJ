import { useCallback } from 'react';
import { useWorkerManager } from './useWorkerManager';
import type { RSMMessage, RSMResponse } from '@/workers/rsmWorker';

export function useRsmWorker() {
  const {
    isCalculating,
    result: rsmResult,
    error,
    postMessage
  } = useWorkerManager<RSMMessage, RSMResponse['payload']>(
    useCallback(() => new Worker(new URL('../../workers/rsmWorker.ts', import.meta.url), { type: 'module' }), []),
    'RSM_CALCULATED'
  );

  const calculateRSM = useCallback((data: {x1: number, x2: number, y: number}[]) => {
    postMessage({
      type: 'CALCULATE_RSM',
      payload: { data }
    });
  }, [postMessage]);

  return { isCalculating, rsmResult, error, calculateRSM };
}
