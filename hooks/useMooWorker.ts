import { useState, useCallback, useEffect, useRef } from 'react';
import type { MooMessage, MooResponse, MooTarget } from '../lib/mooWorker';

export function useMooWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [mooResult, setMooResult] = useState<MooResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/mooWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<MooResponse>) => {
      const res = e.data;
      if (res.type === 'MOO_RESULT') {
        setMooResult(res.payload || null);
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

  const runMooOpt = useCallback((
    data: Record<string, number>[], 
    features: string[], 
    targets: MooTarget[], 
    iterations: number = 10000
  ) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    setMooResult(null);
    workerRef.current.postMessage({
      type: 'RUN_MOO',
      payload: { data, features, targets, iterations }
    } as MooMessage);
  }, []);

  return { isCalculating, mooResult, error, runMooOpt };
}
