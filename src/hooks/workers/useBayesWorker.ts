import { useState, useCallback, useEffect, useRef } from 'react';
import type { BayesMessage, BayesResponse } from '@/workers/bayesWorker';

export function useBayesWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [bayesResult, setBayesResult] = useState<BayesResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/bayesWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<BayesResponse>) => {
      const res = e.data;
      if (res.type === 'BAYES_RESULT') {
        setBayesResult(res.payload || null);
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

  const runBayesOpt = useCallback((
    data: Record<string, number>[], 
    features: string[], 
    target: string, 
    maximize: boolean,
    iterations: number = 10000
  ) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    setBayesResult(null);
    workerRef.current.postMessage({
      type: 'RUN_BAYES',
      payload: { data, features, target, maximize, iterations }
    } as BayesMessage);
  }, []);

  return { isCalculating, bayesResult, error, runBayesOpt };
}
