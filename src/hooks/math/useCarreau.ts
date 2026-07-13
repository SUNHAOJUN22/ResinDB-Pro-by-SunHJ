import { useCallback } from 'react';
import { useWorkerManager } from '@/hooks/workers/useWorkerManager';
import type { CarreauMessage, CarreauResponse } from '@/workers/carreauWorker';

export function useCarreauWorker() {
  const {
    isCalculating: isFitting,
    result: fittedParams,
    setResult: setFittedParams,
    error,
    postMessage
  } = useWorkerManager<CarreauMessage, NonNullable<CarreauResponse['payload']>>(
    useCallback(() => new Worker(new URL('../../workers/carreauWorker.ts', import.meta.url), { type: 'module' }), []),
    'CARREAU_FITTED'
  );

  const fitCarreau = useCallback((shearRates: number[], viscosities: number[]) => {
    if (shearRates.length >= 3) {
      postMessage({
        type: 'FIT_CARREAU',
        payload: { shearRates, viscosities }
      });
    } else {
      setFittedParams(null);
    }
  }, [postMessage, setFittedParams]);

  return {
    fittedParams,
    isFitting,
    error,
    fitCarreau
  };
}

