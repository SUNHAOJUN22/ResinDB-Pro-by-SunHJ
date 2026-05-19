export type KMeansMessage = {
  type: 'COMPUTE_KMEANS';
  payload: {
    data: { id: string; values: Record<string, number> }[];
    keys: string[];
    maxK?: number;
  };
};

export type KMeansResponse = {
  type: 'KMEANS_RESULT';
  payload: {
    clusters: Record<string, number>; // id -> clusterIndex
    k: number;
    centroids: number[][];
  };
} | {
  type: 'ERROR';
  payload: { message: string };
};

// Compute Euclidean distance squared
function distSq(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return sum;
}

self.onmessage = (e: MessageEvent<KMeansMessage>) => {
  try {
    const { data, keys, maxK = 10 } = e.data.payload;
    if (!data.length || !keys.length) {
      self.postMessage({ type: 'KMEANS_RESULT', payload: { clusters: {}, k: 0, centroids: [] } });
      return;
    }

    const m = keys.length;
    const n = data.length;

    // Build data matrix and normalize it (Z-score)
    const rawMatrix = data.map(d => keys.map(k => d.values[k] ?? 0));
    
    const means = new Array(m).fill(0);
    const stds = new Array(m).fill(0);
    
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) means[j] += rawMatrix[i][j];
      means[j] /= n;
      for (let i = 0; i < n; i++) stds[j] += (rawMatrix[i][j] - means[j]) ** 2;
      stds[j] = Math.sqrt(stds[j] / n) || 1; // avoid div by 0
    }

    const mat = rawMatrix.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

    // Run KMeans for k = 2 to Math.min(maxK, Math.floor(n / 2))
    // We'll use Silhouette score to find the best K
    const maxTestedK = Math.min(maxK, Math.floor(n / 2), 10);
    let bestK = 1;
    let bestClusters: number[] = new Array(n).fill(0);
    let bestScore = -1;
    let bestCentroids: number[][] = [];

    // Simple k-means function
    const runKMeans = (k: number) => {
      // Initialize with k-means++
      const centroids: number[][] = [];
      centroids.push([...mat[Math.floor(Math.random() * n)]]);

      for (let c = 1; c < k; c++) {
        const dists = mat.map(row => {
          let minDist = Infinity;
          for (const centroid of centroids) {
            minDist = Math.min(minDist, distSq(row, centroid));
          }
          return minDist;
        });
        const sumDist = dists.reduce((a, b) => a + b, 0);
        let target = Math.random() * sumDist;
        let chosenIdx = 0;
        for (let i = 0; i < n; i++) {
          target -= dists[i];
          if (target <= 0) {
            chosenIdx = i;
            break;
          }
        }
        centroids.push([...mat[chosenIdx]]);
      }

      const assignments = new Array(n).fill(-1);
      let changed = true;
      let iters = 0;

      while (changed && iters < 50) {
        changed = false;
        const newCentroids = new Array(k).fill(0).map(() => new Array(m).fill(0));
        const counts = new Array(k).fill(0);

        for (let i = 0; i < n; i++) {
          let bestC = -1;
          let minDist = Infinity;
          for (let c = 0; c < k; c++) {
            const d = distSq(mat[i], centroids[c]);
            if (d < minDist) {
              minDist = d;
              bestC = c;
            }
          }
          if (assignments[i] !== bestC) {
            changed = true;
            assignments[i] = bestC;
          }
          for (let j = 0; j < m; j++) newCentroids[bestC][j] += mat[i][j];
          counts[bestC]++;
        }

        for (let c = 0; c < k; c++) {
          if (counts[c] > 0) {
            for (let j = 0; j < m; j++) centroids[c][j] = newCentroids[c][j] / counts[c];
          } else {
            // Re-init empty cluster
            centroids[c] = [...mat[Math.floor(Math.random() * n)]];
            changed = true;
          }
        }
        iters++;
      }
      return { assignments, centroids };
    };

    const calcSilhouette = (assignments: number[], k: number) => {
      if (k < 2) return -1;
      let totalSil = 0;

      for (let i = 0; i < n; i++) {
        const c = assignments[i];
        let a = 0, aCount = 0;
        const bDists = new Array(k).fill(0);
        const bCounts = new Array(k).fill(0);

        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const d = Math.sqrt(distSq(mat[i], mat[j]));
          if (assignments[j] === c) {
            a += d;
            aCount++;
          } else {
            bDists[assignments[j]] += d;
            bCounts[assignments[j]]++;
          }
        }

        a = aCount > 0 ? a / aCount : 0;
        let b = Infinity;
        for (let otherC = 0; otherC < k; otherC++) {
          if (otherC !== c && bCounts[otherC] > 0) {
            b = Math.min(b, bDists[otherC] / bCounts[otherC]);
          }
        }

        const maxAB = Math.max(a, b);
        let s = 0;
        if (maxAB > 0) s = (b - a) / maxAB;
        totalSil += s;
      }
      return totalSil / n;
    };

    if (maxTestedK < 2) {
      bestClusters = runKMeans(1).assignments;
      bestK = 1;
    } else {
      for (let k = 2; k <= maxTestedK; k++) {
        const { assignments, centroids } = runKMeans(k);
        const score = calcSilhouette(assignments, k);
        if (score > bestScore) {
          bestScore = score;
          bestClusters = assignments;
          bestK = k;
          bestCentroids = centroids;
        }
      }
    }

    const clustersRecord: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      clustersRecord[data[i].id] = bestClusters[i];
    }

    self.postMessage({ type: 'KMEANS_RESULT', payload: { clusters: clustersRecord, k: bestK, centroids: bestCentroids } } as KMeansResponse);
  } catch (error) {
    self.postMessage({ type: 'ERROR', payload: { message: error instanceof Error ? error.message : 'Unknown error' } } as KMeansResponse);
  }
};
