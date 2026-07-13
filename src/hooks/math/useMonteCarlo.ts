import { useCallback, useMemo } from 'react';
import { useWorkerManager } from '@/hooks/workers/useWorkerManager';
import { Product, FormulaConfig } from '@/types/index';
import type { MonteCarloMessage, MonteCarloResponse } from '@/workers/monteCarloWorker';

export function useMonteCarlo() {
  const {
    isCalculating: isSimulating,
    result,
    setResult,
    error,
    setError,
    postMessage
  } = useWorkerManager<MonteCarloMessage, NonNullable<MonteCarloResponse['payload']>>(
    useCallback(() => new Worker(new URL('../../workers/monteCarloWorker.ts', import.meta.url), { type: 'module' }), []),
    'SIMULATION_COMPLETE'
  );

  const runSimulation = useCallback((
    targetFormulaId: string, 
    formulas: FormulaConfig[], 
    product: Product, 
    variances: Record<string, number>,
    iterations: number = 5000
  ) => {
    postMessage({
      type: 'RUN_SIMULATION',
      payload: { targetFormulaId, formulas, product, variances, iterations }
    });
  }, [postMessage]);

  const resetSimulation = useCallback(() => {
     setResult(null);
     setError(null);
  }, [setResult, setError]);

  const simulationStats = useMemo(() => result?.stats || null, [result]);

  return {
    simulationStats,
    isSimulating,
    error,
    runSimulation,
    resetSimulation
  };
}

