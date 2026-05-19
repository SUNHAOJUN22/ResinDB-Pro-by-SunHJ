export function calculateTopsis<T extends { id: string }>(
  data: T[],
  columns: { key: string; isLowBest: boolean }[],
  valueExtractor: (item: T, key: string) => number | null
): Map<string, number> {
  const n = data.length;
  if (n === 0) return new Map();
  const m = columns.length;
  if (m === 0) return new Map(data.map(d => [d.id, 0]));

  // 1. Extract values & handle nulls
  const rawMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      const val = valueExtractor(data[i], columns[j].key);
      row.push(typeof val === 'number' && !isNaN(val) ? val : 0);
    }
    rawMatrix.push(row);
  }

  // 2. Normalization
  const normMatrix: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let j = 0; j < m; j++) {
    const colValues = rawMatrix.map(row => row[j]);
    const maxVal = Math.max(...colValues);
    const minVal = Math.min(...colValues);
    const range = maxVal - minVal;

    for (let i = 0; i < n; i++) {
      if (range === 0) {
        normMatrix[i][j] = 0; // If all same, no variance, weight will be 0 later (or handled)
      } else {
        if (columns[j].isLowBest) {
          normMatrix[i][j] = (maxVal - rawMatrix[i][j]) / range;
        } else {
          normMatrix[i][j] = (rawMatrix[i][j] - minVal) / range;
        }
      }
      // Add small epsilon to avoid log(0) in EWM
      normMatrix[i][j] += 1e-9;
    }
  }

  // 3. Entropy Weight Method
  const weights: number[] = [];
  let sumWeights = 0;
  for (let j = 0; j < m; j++) {
    let sumCol = 0;
    for (let i = 0; i < n; i++) sumCol += normMatrix[i][j];

    let entropy = 0;
    const lnN = Math.log(n) || 1; // avoid div by 0 if n=1
    for (let i = 0; i < n; i++) {
      const p = normMatrix[i][j] / (sumCol || 1);
      if (p > 0) {
        entropy -= (p * Math.log(p)) / lnN;
      }
    }
    const d = 1 - entropy;
    weights.push(d);
    sumWeights += d;
  }
  for (let j = 0; j < m; j++) {
    weights[j] /= (sumWeights || 1);
  }

  // 4. TOPSIS Weighted Matrix & Ideals
  const weightedMatrix: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  const vPlus: number[] = Array(m).fill(-Infinity);
  const vMinus: number[] = Array(m).fill(Infinity);

  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const val = normMatrix[i][j] * weights[j];
      weightedMatrix[i][j] = val;
      if (val > vPlus[j]) vPlus[j] = val;
      if (val < vMinus[j]) vMinus[j] = val;
    }
  }

  // 5. distances & scores
  const scores = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    let distPlus = 0;
    let distMinus = 0;
    for (let j = 0; j < m; j++) {
      distPlus += Math.pow(weightedMatrix[i][j] - vPlus[j], 2);
      distMinus += Math.pow(weightedMatrix[i][j] - vMinus[j], 2);
    }
    distPlus = Math.sqrt(distPlus);
    distMinus = Math.sqrt(distMinus);
    
    const score = (distPlus + distMinus) === 0 ? 0 : distMinus / (distPlus + distMinus);
    scores.set(data[i].id, score);
  }

  return scores;
}
