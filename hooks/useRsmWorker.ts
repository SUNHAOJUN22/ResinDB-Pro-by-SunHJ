import { useState, useCallback, useRef, useEffect } from 'react';
import type { RSMMessage, RSMResponse } from '../lib/rsmWorker';

export function useRsmWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [rsmResult, setRsmResult] = useState<RSMResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/rsmWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<RSMResponse>) => {
      const res = e.data;
      if (res.type === 'RSM_CALCULATED') {
        setRsmResult(res.payload || null);
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

  const calculateRSM = useCallback((data: {x1: number, x2: number, y: number}[]) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'CALCULATE_RSM',
      payload: { data }
    } as RSMMessage);
  }, []);

  return { isCalculating, rsmResult, error, calculateRSM };
}
