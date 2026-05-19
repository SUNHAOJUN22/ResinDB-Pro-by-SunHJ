import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Product, FormulaConfig } from '@/types/index';
import type { MonteCarloMessage, MonteCarloResponse } from '@/workers/monteCarloWorker';

export function useMonteCarlo() {
  const [simulationStats, setSimulationStats] = useState<NonNullable<MonteCarloResponse['payload']>['stats'] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/monteCarloWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e: MessageEvent<MonteCarloResponse>) => {
      const res = e.data;
      if (res.type === 'SIMULATION_COMPLETE' && res.payload) {
        setSimulationStats(res.payload.stats);
        setError(null);
        setIsSimulating(false);
      } else if (res.type === 'ERROR') {
        setIsSimulating(false);
        setError(res.error || "Simulation failed");
        logger.error("MonteCarlo Error:", res.error);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const runSimulation = useCallback((
    targetFormulaId: string, 
    formulas: FormulaConfig[], 
    product: Product, 
    variances: Record<string, number>,
    iterations: number = 5000
  ) => {
    if (workerRef.current) {
      setIsSimulating(true);
      setError(null);
      
      workerRef.current.postMessage({
        type: 'RUN_SIMULATION',
        payload: { targetFormulaId, formulas, product, variances, iterations }
      } as MonteCarloMessage);
    }
  }, []);
  
  const resetSimulation = useCallback(() => {
     setSimulationStats(null);
     setError(null);
  }, []);

  return {
    simulationStats,
    isSimulating,
    error,
    runSimulation,
    resetSimulation
  };
}
