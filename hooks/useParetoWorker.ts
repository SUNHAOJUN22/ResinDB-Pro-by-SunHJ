import { useState, useCallback, useEffect, useRef } from 'react';
import type { ParetoMessage, ParetoResponse, ParetoObjective } from '../lib/paretoWorker';

export function useParetoWorker() {
  const [isComputing, setIsComputing] = useState(false);
  const [paretoFrontIds, setParetoFrontIds] = useState<Set<string>>(new Set());
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../lib/paretoWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    
    worker.onmessage = (e: MessageEvent<ParetoResponse>) => {
       const res = e.data;
       if (res.type === 'PARETO_RESULT') {
          setParetoFrontIds(new Set(res.payload.paretoIds));
          setIsComputing(false);
       } else if (res.type === 'ERROR') {
          console.error("ParetoWorker Error:", res.payload.message);
          setIsComputing(false);
       }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  const computePareto = useCallback((data: {id: string, values: Record<string, number>}[], objectives: ParetoObjective[]) => {
      if (!workerRef.current || objectives.length === 0 || data.length === 0) {
         setParetoFrontIds(new Set());
         return;
      }
      setIsComputing(true);
      workerRef.current.postMessage({
         type: 'COMPUTE_PARETO',
         payload: { data, objectives }
      } as ParetoMessage);
  }, []);

  return { paretoFrontIds, computePareto, isComputingPareto: isComputing };
}
