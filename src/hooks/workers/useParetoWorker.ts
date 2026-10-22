import { useCallback, useMemo } from 'react';
import { useWorkerManager } from './useWorkerManager';
import type { ParetoMessage, ParetoResponse, ParetoObjective } from '@/workers/paretoWorker';

export function useParetoWorker() {
  const {
    isCalculating: isComputing,
    result,
    setResult,
    postMessage,
    cancel
  } = useWorkerManager<ParetoMessage, Extract<ParetoResponse, { type: 'PARETO_RESULT' }>['payload']>(
    useCallback(() => new Worker(new URL('../../workers/paretoWorker.ts', import.meta.url), { type: 'module' }), []),
    'PARETO_RESULT'
  );

  const computePareto = useCallback((data: {id: string, values: Record<string, number>}[], objectives: ParetoObjective[]) => {
      cancel('Pareto inputs changed or the frontier was cleared');
      setResult(null);
      if (objectives.length === 0 || data.length === 0) {
         return;
      }
      postMessage({
         type: 'COMPUTE_PARETO',
         payload: { data, objectives }
      });
  }, [cancel, postMessage, setResult]);

  const paretoFrontIds = useMemo(() => new Set(result?.paretoIds || []), [result]);

  return { paretoFrontIds, computePareto, isComputingPareto: isComputing };
}
