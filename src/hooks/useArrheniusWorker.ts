import { useState, useCallback, useRef, useEffect } from 'react';
import type { ArrheniusMessage, ArrheniusResponse } from '@/workers/arrheniusWorker';

export function useArrheniusWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [arrheniusResult, setArrheniusResult] = useState<ArrheniusResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/arrheniusWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<ArrheniusResponse>) => {
      const res = e.data;
      if (res.type === 'ARRHENIUS_RESULT') {
        setArrheniusResult(res.payload || null);
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

  const calculateArrhenius = useCallback((points: { tempC: number; time: number }[]) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'CALCULATE_ARRHENIUS',
      payload: { points }
    } as ArrheniusMessage);
  }, []);

  const getPredictedLife = useCallback((tempC: number) => {
     if (!arrheniusResult) return null;
     const { m, b } = arrheniusResult.equation;
     const tk = tempC + 273.15;
     const lnTime = m * (1 / tk) + b;
     return Math.exp(lnTime);
  }, [arrheniusResult]);

  return { isCalculating, arrheniusResult, error, calculateArrhenius, getPredictedLife };
}
