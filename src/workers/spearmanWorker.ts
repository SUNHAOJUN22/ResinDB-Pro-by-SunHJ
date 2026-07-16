export type SpearmanMessage = {
  type: 'COMPUTE_SPEARMAN';
  payload: {
    data: { id: string; values: Record<string, number> }[];
    keys: string[];
  };
};

export type SpearmanResponse = {
  type: 'SPEARMAN_RESULT';
  payload: {
    matrix: number[][];
    keys: string[];
  };
} | {
  type: 'ERROR';
  payload: { message: string };
};

// Compute ranks
function getRanks(arr: number[]): number[] {
  const sorted = arr.map((val, i) => ({ val, i })).sort((a, b) => a.val - b.val);
  const ranks = new Array(arr.length);
  
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    let sum = 0;
    while (j < sorted.length && sorted[j].val === sorted[i].val) {
      sum += j + 1;
      j++;
    }
    const avgRank = sum / (j - i);
    for (let k = i; k < j; k++) {
      ranks[sorted[k].i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

self.onmessage = (e: MessageEvent<SpearmanMessage>) => {
  try {
    const { data, keys } = e.data.payload;
    if (!data.length || keys.length < 2) {
      self.postMessage({ type: 'SPEARMAN_RESULT', payload: { matrix: [], keys } });
      return;
    }

    const validData = data.filter(d => 
       d && d.values && 
       keys.every(k => typeof d.values[k] === 'number' && !isNaN(d.values[k]))
    );

    if (!validData.length) {
      self.postMessage({ type: 'SPEARMAN_RESULT', payload: { matrix: [], keys } });
      return;
    }

    const n = validData.length;
    const ranksByKey: Record<string, number[]> = {};

    for (const key of keys) {
      const values = validData.map(d => d.values[key] ?? 0);
      ranksByKey[key] = getRanks(values);
    }

    const matrix = Array(keys.length).fill(0).map(() => Array(keys.length).fill(0));

    for (let i = 0; i < keys.length; i++) {
      matrix[i][i] = 1;
      const rankX = ranksByKey[keys[i]];
      const meanX = (n + 1) / 2; // mean of ranks 1 to n is (n+1)/2

      let sumSqX = 0;
      for (const r of rankX) sumSqX += Math.pow(r - meanX, 2);

      for (let j = i + 1; j < keys.length; j++) {
        const rankY = ranksByKey[keys[j]];
        const meanY = meanX; // Same mean
        
        // Let's use standard Pearson on ranks for ties properly
        let sumSqY = 0;
        for (const r of rankY) sumSqY += Math.pow(r - meanY, 2);

        let sumXY = 0;
        for (let k = 0; k < n; k++) {
          sumXY += (rankX[k] - meanX) * (rankY[k] - meanY);
        }

        const denom = Math.sqrt(Math.max(0, sumSqX * sumSqY));
        const rho = Math.abs(denom) < 1e-15 ? 0 : sumXY / denom;
        
        matrix[i][j] = rho;
        matrix[j][i] = rho;
      }
    }

    self.postMessage({ type: 'SPEARMAN_RESULT', payload: { matrix, keys } } as SpearmanResponse);
  } catch (error) {
    self.postMessage({ type: 'ERROR', payload: { message: error instanceof Error ? error.message : 'Unknown error' } } as SpearmanResponse);
  }
};

// v3.1.0-sync

// v3.1.0-sync-fixed
