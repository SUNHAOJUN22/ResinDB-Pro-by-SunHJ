export interface FeatureImportanceMessage {
  type: 'CALCULATE_IMPORTANCE';
  payload: {
    data: number[][]; // Each inner array represents a point [f1, f2, ..., target]
    featureNames: string[];
  };
}

export interface FeatureImportanceResponse {
  type: 'IMPORTANCE_RESULT' | 'ERROR';
  payload?: {
    importances: { feature: string; importance: number; positive: boolean }[];
  };
  error?: string;
}

// Helper: Matrix Inverse via Gauss-Jordan
function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({length: n}, (_, j) => i === j ? 1 : 0)]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[j][i]) > Math.abs(A[maxRow][i])) maxRow = j;
    }
    if (maxRow !== i) {
      const temp = A[i];
      A[i] = A[maxRow];
      A[maxRow] = temp;
    }
    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) throw new Error("Matrix is singular, unable to solve.");
    
    for (let j = 0; j < 2 * n; j++) A[i][j] /= pivot;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const factor = A[j][i];
        for (let k = 0; k < 2 * n; k++) A[j][k] -= factor * A[i][k];
      }
    }
  }
  return A.map(row => row.slice(n));
}

function mathMultiply(A: number[][], B: number[][]): number[][] {
  return A.map(row => B[0].map((_, j) => row.reduce((sum, val, k) => sum + val * B[k][j], 0)));
}

function transpose(A: number[][]): number[][] {
  if (!A || A.length === 0 || !A[0]) return [];
  return A[0].map((_, j) => A.map(row => row[j]));
}

self.onmessage = (e: MessageEvent<FeatureImportanceMessage>) => {
  try {
    const { data, featureNames } = e.data.payload;
    if (!data || data.length === 0) throw new Error("No data provided");
    
    // Filter out rows containing NaN or non-finite values
    const validData = data.filter(
      (row) => row && row.every((v) => Number.isFinite(v))
    );
    const numFeatures = featureNames.length;
    const numPoints = validData.length;
    
    if (numPoints <= numFeatures + 1) {
       throw new Error("Not enough valid data points for regression modeling.");
    }

    // Standardize data to get standardized coefficients (Beta weights)
    const means = new Array(numFeatures + 1).fill(0);
    const stds = new Array(numFeatures + 1).fill(0);
    
    for (let i = 0; i < numPoints; i++) {
      for (let j = 0; j <= numFeatures; j++) means[j] += validData[i][j];
    }
    for (let j = 0; j <= numFeatures; j++) means[j] /= numPoints;
    
    for (let i = 0; i < numPoints; i++) {
        for (let j = 0; j <= numFeatures; j++) stds[j] += (validData[i][j] - means[j])**2;
    }
    const safePoints = numPoints > 0 ? numPoints : 1;
    for (let j = 0; j <= numFeatures; j++) {
       stds[j] = Math.sqrt(Math.max(0, stds[j] / safePoints));
       if (stds[j] < 1e-9) stds[j] = 1; // Prevent div by zero
    }
    
    const X: number[][] = [];
    const Y: number[][] = [];
    
    // Add L2 Ridge penalty dynamically to diagonal
    const RIDGE_LAMBDA = 0.1;
    
    for (let i = 0; i < numPoints; i++) {
      const row = [1]; // intercept
      for (let j = 0; j < numFeatures; j++) {
        row.push((validData[i][j] - means[j]) / stds[j]);
      }
      X.push(row);
      Y.push([(validData[i][numFeatures] - means[numFeatures]) / stds[numFeatures]]);
    }
    
    const XT = transpose(X);
    const XTX = mathMultiply(XT, X);
    
    // Apply Ridge
    for(let i=1; i<XTX.length; i++) XTX[i][i] += RIDGE_LAMBDA;
    
    const XTX_inv = invertMatrix(XTX);
    const XTY = mathMultiply(XT, Y);
    const Beta = mathMultiply(XTX_inv, XTY);
    
    const importances = [];
    let totalMagnitude = 0;
    
    for (let i = 1; i <= numFeatures; i++) {
       const w = Beta[i][0];
       totalMagnitude += Math.abs(w);
       importances.push({
           feature: featureNames[i - 1],
           importance: w,
           positive: w >= 0
       });
    }
    
    if (totalMagnitude > 0) {
        for (let i = 0; i < numFeatures; i++) {
           importances[i].importance = Math.abs(importances[i].importance) / totalMagnitude;
        }
    }
    
    // Sort by absolute relative importance
    importances.sort((a, b) => b.importance - a.importance);
    
    self.postMessage({
      type: 'IMPORTANCE_RESULT',
      payload: { importances }
    } as FeatureImportanceResponse);

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// v3.1.0-sync

// v3.1.0-sync-fixed
