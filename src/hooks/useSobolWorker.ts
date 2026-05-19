import { useState, useCallback, useEffect, useRef } from 'react';
import { Product, FormulaConfig } from '@/types/index';
import type { SobolMessage, SobolResponse } from '@/workers/sobolWorker';

export function useSobolWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [sobolResult, setSobolResult] = useState<SobolResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/sobolWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<SobolResponse>) => {
      const res = e.data;
      if (res.type === 'SOBOL_COMPLETE') {
        setSobolResult(res.payload || null);
        setError(null);
        setIsCalculating(false);
      } else if (res.type === 'ERROR') {
        setError(res.error || 'Unknown error');
        setIsCalculating(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runAnalysis = useCallback((
    targetFormulaId: string, 
    formulas: FormulaConfig[], 
    product: Product, 
    variances: Record<string, number>,
    iterations: number = 2000
  ) => {
    if (!workerRef.current) return;
    
    setIsCalculating(true);
    setError(null);
    setSobolResult(null);
    
    workerRef.current.postMessage({
      type: 'RUN_SOBOL',
      payload: {
        targetFormulaId,
        formulas,
        product,
        variances,
        iterations
      }
    } as SobolMessage);
  }, []);

  return { isCalculating, sobolResult, error, runAnalysis };
}
