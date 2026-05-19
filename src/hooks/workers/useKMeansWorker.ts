import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { KMeansMessage, KMeansResponse } from '@/workers/kmeansWorker';

export function useKMeansWorker() {
  const [isComputing, setIsComputing] = useState(false);
  const [clusters, setClusters] = useState<Record<string, number>>({});
  const [bestK, setBestK] = useState<number>(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/kmeansWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    
    worker.onmessage = (e: MessageEvent<KMeansResponse>) => {
       const res = e.data;
       if (res.type === 'KMEANS_RESULT') {
          setClusters(res.payload.clusters);
          setBestK(res.payload.k);
          setIsComputing(false);
       } else if (res.type === 'ERROR') {
          logger.error("KMeansWorker Error:", res.payload.message);
          setIsComputing(false);
       }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  const computeKMeans = useCallback((data: {id: string, values: Record<string, number>}[], keys: string[], maxK = 10) => {
      if (!workerRef.current || keys.length === 0 || data.length === 0) {
         setClusters({});
         setBestK(0);
         return;
      }
      setIsComputing(true);
      workerRef.current.postMessage({
         type: 'COMPUTE_KMEANS',
         payload: { data, keys, maxK }
      } as KMeansMessage);
  }, []);

  return { clusters, bestK, computeKMeans, isComputingKMeans: isComputing };
}
