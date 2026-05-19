import { useState, useCallback, useRef, useEffect } from 'react';
import type { KdeMessage, KdeResponse } from '../lib/kdeWorker';

export function useKdeWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [kdeResult, setKdeResult] = useState<KdeResponse['payload'] | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/kdeWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<KdeResponse>) => {
      const res = e.data;
      if (res.type === 'KDE_CALCULATED') {
        setKdeResult(res.payload || null);
        setIsCalculating(false);
      } else if (res.type === 'ERROR') {
        console.error(res.error);
        setIsCalculating(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const calculateKde = useCallback((points: {x: number, y: number}[]) => {
    if (!workerRef.current || points.length === 0) return;
    setIsCalculating(true);
    workerRef.current.postMessage({
      type: 'CALCULATE_KDE',
      payload: { points }
    } as KdeMessage);
  }, []);

  return { isCalculating, kdeResult, calculateKde };
}
