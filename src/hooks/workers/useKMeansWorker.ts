import { useCallback, useState } from 'react';
import type { KMeansAssignmentBackendPreference } from '@/compute/kmeansAssignment';
import {
  kmeansBackendProfileStore,
  type KMeansBackendProfileLoadStatus,
} from '@/compute/kmeansBackendProfileStore';
import { createRowMajorFloat64Matrix } from '@/compute/numericBuffers';
import type { RandomSeed } from '@/compute/random';
import type { KMeansMessage, KMeansResponse } from '@/workers/kmeansWorker';
import { useWorkerManager } from './useWorkerManager';

export interface KMeansExecutionOptions {
  backend?: KMeansAssignmentBackendPreference;
  allowFallback?: boolean;
}

export function useKMeansWorker() {
  const [profileLoadStatus, setProfileLoadStatus] = useState<KMeansBackendProfileLoadStatus>('missing');
  const {
    isCalculating: isComputing,
    result,
    setResult,
    postMessage,
  } = useWorkerManager<KMeansMessage, Extract<KMeansResponse, { type: 'KMEANS_RESULT' }>['payload']>(
    useCallback(() => new Worker(new URL('../../workers/kmeansWorker.ts', import.meta.url), { type: 'module' }), []),
    'KMEANS_RESULT',
  );

  const computeKMeans = useCallback(async (
    data: { id: string; values: Record<string, number> }[],
    keys: string[],
    maxK = 10,
    seed?: RandomSeed,
    options: KMeansExecutionOptions = {},
  ) => {
    if (keys.length === 0 || data.length === 0) {
      setResult(null);
      return;
    }
    const requestedBackend = options.backend ?? 'auto';
    const loadedProfile = requestedBackend === 'auto'
      ? await kmeansBackendProfileStore.load()
      : null;
    setProfileLoadStatus(loadedProfile?.status ?? 'missing');
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
        backend: options.backend,
        allowFallback: options.allowFallback,
        benchmarkProfile: loadedProfile?.status === 'valid'
          ? loadedProfile.profile ?? undefined
          : undefined,
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
    profileLoadStatus,
    computeKMeans,
    isComputingKMeans: isComputing,
  };
}
