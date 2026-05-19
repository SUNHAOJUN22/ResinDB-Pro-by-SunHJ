import { useState, useCallback, useRef, useEffect } from 'react';
import type { WeibullMessage, WeibullResponse } from '@/workers/weibullWorker';

export function useWeibullWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [weibullResult, setWeibullResult] = useState<WeibullResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/weibullWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<WeibullResponse>) => {
      const res = e.data;
      if (res.type === 'WEIBULL_RESULT') {
        setWeibullResult(res.payload || null);
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

  const calculateWeibull = useCallback((data: number[]) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'CALCULATE_WEIBULL',
      payload: { data }
    } as WeibullMessage);
  }, []);

  return { isCalculating, weibullResult, error, calculateWeibull };
}
