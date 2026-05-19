import { useState, useCallback, useRef, useEffect } from 'react';
import type { WlfMessage, WlfResponse } from '@/workers/wlfWorker';

export function useWlfWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [wlfResult, setWlfResult] = useState<WlfResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../../workers/wlfWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<WlfResponse>) => {
      const res = e.data;
      if (res.type === 'WLF_RESULT') {
        setWlfResult(res.payload || null);
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

  const calculateWLF = useCallback((curves: { temp: number; points: { rate: number; visc: number }[] }[], refTemp: number) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    setWlfResult(null);
    workerRef.current.postMessage({
      type: 'CALCULATE_WLF',
      payload: { curves, refTemp }
    } as WlfMessage);
  }, []);

  return { isCalculating, wlfResult, error, calculateWLF };
}
