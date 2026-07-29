import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import {
  createSeededRandom,
  deriveRandomSeed,
  type RandomSeed,
  SEEDED_RANDOM_ALGORITHM,
  SEEDED_RANDOM_ALGORITHM_VERSION,
} from '@/compute/random';

const KMEANS_MODEL_VERSION = 'kmeans-plus-plus-full-silhouette-1.0.0';

export type KMeansMessage = {
  type: 'COMPUTE_KMEANS';
  payload: {
    data: { id: string; values: Record<string, number> }[];
    keys: string[];
    maxK?: number;
    seed?: RandomSeed;
  };
};

export interface KMeansReproducibility {
  seed: string;
  seedSource: 'user' | 'derived';
  randomAlgorithm: typeof SEEDED_RANDOM_ALGORITHM;
  randomAlgorithmVersion: typeof SEEDED_RANDOM_ALGORITHM_VERSION;
  modelVersion: typeof KMEANS_MODEL_VERSION;
}

export type KMeansResponse = {
  type: 'KMEANS_RESULT';
  payload: {
    clusters: Record<string, number>;
    k: number;
    centroids: number[][];
    silhouetteScore: number | null;
    reproducibility: KMeansReproducibility;
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

self.onmessage = (event: MessageEvent<KMeansMessage>) => {
  try {
    const { data, keys, maxK: requestedMaxK = 10, seed } = event.data.payload;
    const maxK = validateMaxK(requestedMaxK);
    const actualSeed = seed ?? deriveRandomSeed('kmeans-v1', { data, keys, maxK });
    const random = createSeededRandom(actualSeed);
    const reproducibility: KMeansReproducibility = {
      seed: random.seed,
      seedSource: seed === undefined ? 'derived' : 'user',
      randomAlgorithm: random.algorithm,
      randomAlgorithmVersion: random.algorithmVersion,
      modelVersion: KMEANS_MODEL_VERSION,
    };

    if (!data.length || !keys.length) {
      self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));
      self.postMessage({
        type: 'KMEANS_RESULT',
        payload: { clusters: {}, k: 0, centroids: [], silhouetteScore: null, reproducibility },
      } satisfies KMeansResponse);
      return;
    }

    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'normalization' }));
    const dimensions = keys.length;
    const sampleCount = data.length;
    const rawMatrix = data.map((item) => keys.map((key) => item.values[key] ?? 0));
    const means = new Array<number>(dimensions).fill(0);
    const standardDeviations = new Array<number>(dimensions).fill(0);

    for (let dimension = 0; dimension < dimensions; dimension++) {
      for (let sample = 0; sample < sampleCount; sample++) means[dimension] += rawMatrix[sample][dimension];
      means[dimension] /= sampleCount;
      for (let sample = 0; sample < sampleCount; sample++) {
        standardDeviations[dimension] += (rawMatrix[sample][dimension] - means[dimension]) ** 2;
      }
      standardDeviations[dimension] = Math.sqrt(standardDeviations[dimension] / sampleCount) || 1;
    }

    const matrix = rawMatrix.map((row) => row.map((value, dimension) => (
      (value - means[dimension]) / standardDeviations[dimension]
    )));
    const maxTestedK = Math.min(maxK, Math.floor(sampleCount / 2), 10);
    let bestK = 1;
    let bestAssignments = new Array<number>(sampleCount).fill(0);
    let bestScore = -1;
    let bestCentroids: number[][] = [];

    const runKMeans = (k: number) => {
      const centroids: number[][] = [];
      centroids.push([...matrix[Math.floor(random.next() * sampleCount)]]);

      for (let centroidIndex = 1; centroidIndex < k; centroidIndex++) {
        const distances = matrix.map((row) => {
          let minimumDistance = Infinity;
          for (const centroid of centroids) minimumDistance = Math.min(minimumDistance, distanceSquared(row, centroid));
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
      let iterations = 0;
      while (changed && iterations < 50) {
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
        iterations += 1;
      }
      return { assignments, centroids };
    };

    const calculateSilhouette = (assignments: number[], k: number) => {
      if (k < 2) return -1;
      let total = 0;
      for (let sample = 0; sample < sampleCount; sample++) {
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
      return total / sampleCount;
    };

    if (maxTestedK < 2) {
      const singleCluster = runKMeans(1);
      bestAssignments = singleCluster.assignments;
      bestCentroids = singleCluster.centroids;
      bestK = 1;
      bestScore = -1;
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
      },
    } satisfies KMeansResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: error instanceof Error ? error.message : 'Unknown error' },
    } satisfies KMeansResponse);
  }
};
