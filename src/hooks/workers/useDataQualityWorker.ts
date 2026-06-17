import { useState, useCallback, useRef, useEffect } from 'react';
import { Product } from '@/types/index';
import { QualityWorkerMessage, QualityWorkerResponse } from '@/workers/dataQualityWorker';

export function useDataQualityWorker() {
  const [isAnomalizing, setIsAnomalizing] = useState(false);
  const [result, setResult] = useState<QualityWorkerResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../workers/dataQualityWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<any>) => {
      setIsAnomalizing(false);
      const data = e.data;
      if (data.type === 'ERROR' || data.error) {
        setError(data.error || data.payload?.message || 'Error running data quality process.');
      } else if (data.type === 'QUALITY_MONITOR_RESULT') {
        setResult(data.payload);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runQualityCheck = useCallback((allProducts: Product[], options?: QualityWorkerMessage['payload']['options']) => {
    if (!workerRef.current) return;
    setIsAnomalizing(true);
    setError(null);
    setResult(null);

    const msg: QualityWorkerMessage = {
      type: 'RUN_MONITOR',
      payload: { allProducts, options }
    };
    workerRef.current.postMessage(msg);
  }, []);

  return {
    isAnomalizing,
    result,
    error,
    runQualityCheck
  };
}
