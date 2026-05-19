import { useState, useCallback, useEffect, useRef } from 'react';
import type { CarreauMessage, CarreauResponse } from '@/workers/carreauWorker';

export function useCarreauWorker() {
  const [fittedParams, setFittedParams] = useState<CarreauResponse['payload'] | null>(null);
  const [isFitting, setIsFitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/carreauWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e: MessageEvent<CarreauResponse>) => {
      const res = e.data;
      if (res.type === 'CARREAU_FITTED' && res.payload) {
        setFittedParams(res.payload);
        setError(null);
        setIsFitting(false);
      } else if (res.type === 'ERROR') {
        setIsFitting(false);
        setError(res.error || "Fitting failed");
        console.error("CarreauWorker Error:", res.error);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const fitCarreau = useCallback((shearRates: number[], viscosities: number[]) => {
    if (workerRef.current && shearRates.length >= 3) {
      setIsFitting(true);
      setError(null);
      
      workerRef.current.postMessage({
        type: 'FIT_CARREAU',
        payload: { shearRates, viscosities }
      } as CarreauMessage);
    } else {
        setFittedParams(null);
    }
  }, []);

  return {
    fittedParams,
    isFitting,
    error,
    fitCarreau
  };
}
