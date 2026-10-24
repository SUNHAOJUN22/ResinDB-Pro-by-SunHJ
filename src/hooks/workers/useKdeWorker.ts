import { useCallback } from 'react';
import { useWorkerManager } from './useWorkerManager';
import type { KdeMessage, KdeResponse } from '@/workers/kdeWorker';

export function useKdeWorker() {
  const {
    isCalculating,
    result: kdeResult,
    error,
    setResult,
    setError,
    cancel,
    postMessage
  } = useWorkerManager<KdeMessage, KdeResponse['payload']>(
    useCallback(() => new Worker(new URL('../../workers/kdeWorker.ts', import.meta.url), { type: 'module' }), []),
    'KDE_CALCULATED'
  );

  const calculateKde = useCallback((points: {x: number, y: number}[]) => {
    setResult(null);
    setError(null);
    if (points.length === 0) return;
    postMessage({
      type: 'CALCULATE_KDE',
      payload: { points }
    });
  }, [postMessage, setError, setResult]);

  const clearKde = useCallback(() => {
    cancel('KDE inputs changed');
    setResult(null);
    setError(null);
  }, [cancel, setError, setResult]);

  return { isCalculating, kdeResult, error, calculateKde, clearKde };
}
