import { useState, useCallback, useRef, useEffect } from 'react';
import type { FeatureImportanceMessage, FeatureImportanceResponse } from '@/workers/featureImportanceWorker';

export function useFeatureImportanceWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [importanceResult, setImportanceResult] = useState<FeatureImportanceResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/featureImportanceWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<FeatureImportanceResponse>) => {
      const res = e.data;
      if (res.type === 'IMPORTANCE_RESULT') {
        setImportanceResult(res.payload || null);
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

  const calculateImportance = useCallback((data: number[][], featureNames: string[]) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'CALCULATE_IMPORTANCE',
      payload: { data, featureNames }
    } as FeatureImportanceMessage);
  }, []);

  return { isCalculating, importanceResult, error, calculateImportance };
}
