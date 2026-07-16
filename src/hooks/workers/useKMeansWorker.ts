import { useCallback } from 'react';
import { useWorkerManager } from './useWorkerManager';
import type { KMeansMessage, KMeansResponse } from '@/workers/kmeansWorker';

export function useKMeansWorker() {
  const {
    isCalculating: isComputing,
    result,
    setResult,
    postMessage
  } = useWorkerManager<KMeansMessage, Extract<KMeansResponse, { type: 'KMEANS_RESULT' }>['payload']>(
    useCallback(() => new Worker(new URL('../../workers/kmeansWorker.ts', import.meta.url), { type: 'module' }), []),
    'KMEANS_RESULT'
  );

  const computeKMeans = useCallback((data: {id: string, values: Record<string, number>}[], keys: string[], maxK = 10) => {
      if (keys.length === 0 || data.length === 0) {
         setResult(null);
         return;
      }
      postMessage({
         type: 'COMPUTE_KMEANS',
         payload: { data, keys, maxK }
      });
  }, [postMessage, setResult]);

  const clusters = result?.clusters || {};
  const bestK = result?.k || 0;

  return { clusters, bestK, computeKMeans, isComputingKMeans: isComputing };
}


// v3.1.0-sync

// v3.1.0-sync-fixed
