import { useCallback } from 'react';
import { createRowMajorFloat64Matrix } from '@/compute/numericBuffers';
import type { RandomSeed } from '@/compute/random';
import { useWorkerManager } from './useWorkerManager';
import type { KMeansMessage, KMeansResponse } from '@/workers/kmeansWorker';

export function useKMeansWorker() {
  const {
    isCalculating: isComputing,
    result,
    setResult,
    postMessage,
  } = useWorkerManager<KMeansMessage, Extract<KMeansResponse, { type: 'KMEANS_RESULT' }>['payload']>(
    useCallback(() => new Worker(new URL('../../workers/kmeansWorker.ts', import.meta.url), { type: 'module' }), []),
    'KMEANS_RESULT',
  );

  const computeKMeans = useCallback((
    data: { id: string; values: Record<string, number> }[],
    keys: string[],
    maxK = 10,
    seed?: RandomSeed,
  ) => {
    if (keys.length === 0 || data.length === 0) {
      setResult(null);
      return;
    }
    const matrix = createRowMajorFloat64Matrix(
      data.length,
      keys.length,
      (row, column) => Number(data[row]?.values?.[keys[column]]),
    );
    postMessage({
      type: 'COMPUTE_KMEANS',
      payload: {
        ids: data.map((item) => String(item.id)),
        matrix,
        keys,
        maxK,
        seed,
      },
    }, { transfer: [matrix.values.buffer] });
  }, [postMessage, setResult]);

  return {
    clusters: result?.clusters ?? {},
    bestK: result?.k ?? 0,
    silhouetteScore: result?.silhouetteScore ?? null,
    reproducibility: result?.reproducibility ?? null,
    modelSelection: result?.modelSelection ?? null,
    performance: result?.performance ?? null,
    computeKMeans,
    isComputingKMeans: isComputing,
  };
}
