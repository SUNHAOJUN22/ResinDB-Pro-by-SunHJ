import { useState, useCallback, useEffect, useRef } from 'react';
import type { SpcMessage, SpcResponse } from '@/workers/spcWorker';

export function useSpcWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [spcResult, setSpcResult] = useState<SpcResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/spcWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<SpcResponse>) => {
      const res = e.data;
      if (res.type === 'SPC_RESULT') {
        setSpcResult(res.payload || null);
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

  const calculateSpc = useCallback((data: number[], usl: number, lsl: number) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    setSpcResult(null);
    workerRef.current.postMessage({
      type: 'CALCULATE_SPC',
      payload: { data, usl, lsl }
    } as SpcMessage);
  }, []);

  return { isCalculating, spcResult, error, calculateSpc };
}
