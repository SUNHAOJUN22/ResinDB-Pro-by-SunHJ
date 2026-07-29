import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import {
  createSeededRandom,
  deriveRandomSeed,
  type RandomSeed,
  SEEDED_RANDOM_ALGORITHM,
  SEEDED_RANDOM_ALGORITHM_VERSION,
} from '@/compute/random';

const KMEANS_MODEL_VERSION = 'kmeans-plus-plus-adaptive-silhouette-2.0.0';
const FULL_SILHOUETTE_LIMIT = 1_500;
const DEFAULT_MAX_SILHOUETTE_SAMPLE = 1_000;

export type KMeansSelectionMode = 'auto' | 'full' | 'sampled';

export type KMeansMessage = {
  type: 'COMPUTE_KMEANS';
  payload: {
    data: { id: string; values: Record<string, number> }[];
    keys: string[];
    maxK?: number;
    seed?: RandomSeed;
    selectionMode?: KMeansSelectionMode;
    silhouetteSampleSize?: number;
  };
};

export interface KMeansReproducibility {
  seed: string;
  seedSource: 'user' | 'derived';
  randomAlgorithm: typeof SEEDED_RANDOM_ALGORITHM;
  randomAlgorithmVersion: typeof SEEDED_RANDOM_ALGORITHM_VERSION;
  modelVersion: typeof KMEANS_MODEL_VERSION;
}

export interface KMeansModelSelection {
  method: 'full-silhouette' | 'sampled-silhouette';
  evaluatedSamples: number;
  totalSamples: number;
  candidateCount: number;
  missingValuesImputed: number;
}

export type KMeansResponse = {
  type: 'KMEANS_RESULT';
  payload: {
    clusters: Record<string, number>;
    k: number;
    centroids: number[][];
    silhouetteScore: number | null;
    reproducibility: KMeansReproducibility;
    modelSelection: KMeansModelSelection;
  };
} | {
  type: 'ERROR';
  payload: { message: string };
};

function distanceSquared(left: number[], right: number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index++) sum += (left[index] - right[index]) ** 2;
  return sum;
}

function validateMaxK(maxK: number): number {
  if (!Number.isInteger(maxK) || maxK < 1 || maxK > 100) {
    throw new RangeError('maxK must be an integer between 1 and 100');
  }
  return maxK;
}

function validateSelectionMode(mode: KMeansSelectionMode): KMeansSelectionMode {
  if (mode !== 'auto' && mode !== 'full' && mode !== 'sampled') {
    throw new TypeError('selectionMode must be auto, full, or sampled');
  }
  return mode;
}

function selectEvaluationIndices(
  sampleCount: number,
  requestedMode: KMeansSelectionMode,
  requestedSampleSize: number | undefined,
  seed: string,
): { indices: number[]; method: KMeansModelSelection['method'] } {
  const useFull = requestedMode === 'full'
    || (requestedMode === 'auto' && sampleCount <= FULL_SILHOUETTE_LIMIT);
  if (useFull) {
    return {
      indices: Array.from({ length: sampleCount }, (_, index) => index),
      method: 'full-silhouette',
    };
  }
  const adaptiveSize = Math.min(
    DEFAULT_MAX_SILHOUETTE_SAMPLE,
    Math.max(200, Math.ceil(Math.sqrt(sampleCount) * 10)),
  );
  const sampleSize = requestedSampleSize ?? adaptiveSize;
  if (!Number.isInteger(sampleSize) || sampleSize < 2) {
    throw new RangeError('silhouetteSampleSize must be an integer of at least 2');
  }
  const retained = Math.min(sampleCount, sampleSize);
  if (retained === sampleCount) {
    return {
      indices: Array.from({ length: sampleCount }, (_, index) => index),
      method: 'full-silhouette',
    };
  }
  const random = createSeededRandom(deriveRandomSeed('kmeans-silhouette-sample-v1', {
    seed,
    sampleCount,
    retained,
  }));
  const indices = Array.from({ length: retained }, (_, index) => index);
  for (let index = retained; index < sampleCount; index++) {
    const replacement = Math.floor(random.next() * (index + 1));
    if (replacement < retained) indices[replacement] = index;
  }
  indices.sort((left, right) => left - right);
  return { indices, method: 'sampled-silhouette' };
}

self.onmessage = (event: MessageEvent<KMeansMessage>) => {
  try {
    const {
      data,
      keys,
      maxK: requestedMaxK = 10,
      seed,
      selectionMode: requestedSelectionMode = 'auto',
      silhouetteSampleSize,
    } = event.data.payload;
    const maxK = validateMaxK(requestedMaxK);
    const selectionMode = validateSelectionMode(requestedSelectionMode);
    const actualSeed = seed ?? deriveRandomSeed('kmeans-v2', {
      data,
      keys,
      maxK,
      selectionMode,
      silhouetteSampleSize,
    });
    const reproducibility: KMeansReproducibility = {
      seed: String(actualSeed),
      seedSource: seed === undefined ? 'derived' : 'user',
      randomAlgorithm: SEEDED_RANDOM_ALGORITHM,
      randomAlgorithmVersion: SEEDED_RANDOM_ALGORITHM_VERSION,
      modelVersion: KMEANS_MODEL_VERSION,
    };

    if (!data.length || !keys.length) {
      self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));
      self.postMessage({
        type: 'KMEANS_RESULT',
        payload: {
          clusters: {},
          k: 0,
          centroids: [],
          silhouetteScore: null,
          reproducibility,
          modelSelection: {
            method: 'full-silhouette',
            evaluatedSamples: 0,
            totalSamples: 0,
            candidateCount: 0,
            missingValuesImputed: 0,
          },
        },
      } satisfies KMeansResponse);
      return;
    }

    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'normalization' }));
    const dimensions = keys.length;
    const sampleCount = data.length;
    const featureMeans = new Array<number>(dimensions).fill(0);
    const finiteCounts = new Array<number>(dimensions).fill(0);
    for (const item of data) {
      for (let dimension = 0; dimension < dimensions; dimension++) {
        const value = item.values[keys[dimension]];
        if (Number.isFinite(value)) {
          featureMeans[dimension] += value;
          finiteCounts[dimension] += 1;
        }
      }
    }
    for (let dimension = 0; dimension < dimensions; dimension++) {
      featureMeans[dimension] = finiteCounts[dimension] > 0
        ? featureMeans[dimension] / finiteCounts[dimension]
        : 0;
    }

    let missingValuesImputed = 0;
    const rawMatrix = data.map((item) => keys.map((key, dimension) => {
      const value = item.values[key];
      if (Number.isFinite(value)) return value;
      missingValuesImputed += 1;
      return featureMeans[dimension];
    }));
    const standardDeviations = new Array<number>(dimensions).fill(0);
    for (let dimension = 0; dimension < dimensions; dimension++) {
      for (let sample = 0; sample < sampleCount; sample++) {
        standardDeviations[dimension] += (rawMatrix[sample][dimension] - featureMeans[dimension]) ** 2;
      }
      standardDeviations[dimension] = Math.sqrt(standardDeviations[dimension] / sampleCount) || 1;
    }
    const matrix = rawMatrix.map((row) => row.map((value, dimension) => (
      (value - featureMeans[dimension]) / standardDeviations[dimension]
    )));

    const evaluation = selectEvaluationIndices(
      sampleCount,
      selectionMode,
      silhouetteSampleSize,
      String(actualSeed),
    );
    const maxTestedK = Math.min(maxK, Math.floor(sampleCount / 2), 10);
    let bestK = 1;
    let bestAssignments = new Array<number>(sampleCount).fill(0);
    let bestScore = -1;
    let bestCentroids: number[][] = [];

    const runKMeans = (k: number) => {
      const random = createSeededRandom(deriveRandomSeed('kmeans-run-v2', {
        seed: String(actualSeed),
        k,
      }));
      const centroids: number[][] = [];
      centroids.push([...matrix[Math.floor(random.next() * sampleCount)]]);
      for (let centroidIndex = 1; centroidIndex < k; centroidIndex++) {
        const distances = matrix.map((row) => {
          let minimumDistance = Infinity;
          for (const centroid of centroids) {
            minimumDistance = Math.min(minimumDistance, distanceSquared(row, centroid));
          }
          return minimumDistance;
        });
        const distanceSum = distances.reduce((sum, value) => sum + value, 0);
        let chosenIndex = centroidIndex % sampleCount;
        if (distanceSum > 0) {
          let target = random.next() * distanceSum;
          for (let sample = 0; sample < sampleCount; sample++) {
            target -= distances[sample];
            if (target <= 0) {
              chosenIndex = sample;
              break;
            }
          }
        }
        centroids.push([...matrix[chosenIndex]]);
      }

      const assignments = new Array<number>(sampleCount).fill(-1);
      let changed = true;
      let iteration = 0;
      while (changed && iteration < 50) {
        changed = false;
        const newCentroids = Array.from({ length: k }, () => new Array<number>(dimensions).fill(0));
        const counts = new Array<number>(k).fill(0);
        for (let sample = 0; sample < sampleCount; sample++) {
          let bestCluster = -1;
          let minimumDistance = Infinity;
          for (let cluster = 0; cluster < k; cluster++) {
            const distance = distanceSquared(matrix[sample], centroids[cluster]);
            if (distance < minimumDistance) {
              minimumDistance = distance;
              bestCluster = cluster;
            }
          }
          if (assignments[sample] !== bestCluster) {
            changed = true;
            assignments[sample] = bestCluster;
          }
          for (let dimension = 0; dimension < dimensions; dimension++) {
            newCentroids[bestCluster][dimension] += matrix[sample][dimension];
          }
          counts[bestCluster] += 1;
        }
        for (let cluster = 0; cluster < k; cluster++) {
          if (counts[cluster] > 0) {
            for (let dimension = 0; dimension < dimensions; dimension++) {
              centroids[cluster][dimension] = newCentroids[cluster][dimension] / counts[cluster];
            }
          } else {
            centroids[cluster] = [...matrix[Math.floor(random.next() * sampleCount)]];
            changed = true;
          }
        }
        iteration += 1;
      }
      return { assignments, centroids };
    };

    const calculateSilhouette = (assignments: number[], k: number) => {
      if (k < 2 || evaluation.indices.length === 0) return -1;
      let total = 0;
      for (const sample of evaluation.indices) {
        const ownCluster = assignments[sample];
        let ownDistance = 0;
        let ownCount = 0;
        const otherDistances = new Array<number>(k).fill(0);
        const otherCounts = new Array<number>(k).fill(0);
        for (let other = 0; other < sampleCount; other++) {
          if (sample === other) continue;
          const distance = Math.sqrt(distanceSquared(matrix[sample], matrix[other]));
          if (assignments[other] === ownCluster) {
            ownDistance += distance;
            ownCount += 1;
          } else {
            otherDistances[assignments[other]] += distance;
            otherCounts[assignments[other]] += 1;
          }
        }
        const a = ownCount > 0 ? ownDistance / ownCount : 0;
        let b = Infinity;
        for (let cluster = 0; cluster < k; cluster++) {
          if (cluster !== ownCluster && otherCounts[cluster] > 0) {
            b = Math.min(b, otherDistances[cluster] / otherCounts[cluster]);
          }
        }
        const denominator = Math.max(a, b);
        total += denominator > 0 && Number.isFinite(denominator) ? (b - a) / denominator : 0;
      }
      return total / evaluation.indices.length;
    };

    if (maxTestedK < 2) {
      const singleCluster = runKMeans(1);
      bestAssignments = singleCluster.assignments;
      bestCentroids = singleCluster.centroids;
      bestK = 1;
      self.postMessage(createWorkerProgressMessage({ ratio: 0.95, phase: 'model-selection' }));
    } else {
      const candidateCount = maxTestedK - 1;
      for (let k = 2; k <= maxTestedK; k++) {
        const { assignments, centroids } = runKMeans(k);
        const score = calculateSilhouette(assignments, k);
        if (score > bestScore) {
          bestScore = score;
          bestAssignments = assignments;
          bestK = k;
          bestCentroids = centroids;
        }
        self.postMessage(createWorkerProgressMessage({
          ratio: 0.1 + ((k - 1) / candidateCount) * 0.85,
          completed: k - 1,
          total: candidateCount,
          phase: 'model-selection',
        }));
      }
    }

    const clusters: Record<string, number> = {};
    for (let sample = 0; sample < sampleCount; sample++) clusters[data[sample].id] = bestAssignments[sample];
    self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));
    self.postMessage({
      type: 'KMEANS_RESULT',
      payload: {
        clusters,
        k: bestK,
        centroids: bestCentroids,
        silhouetteScore: bestScore >= 0 ? bestScore : null,
        reproducibility,
        modelSelection: {
          method: evaluation.method,
          evaluatedSamples: evaluation.indices.length,
          totalSamples: sampleCount,
          candidateCount: Math.max(0, maxTestedK - 1),
          missingValuesImputed,
        },
      },
    } satisfies KMeansResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: error instanceof Error ? error.message : 'Unknown error' },
    } satisfies KMeansResponse);
  }
};
