export interface RSMMessage {
  type: 'CALCULATE_RSM';
  payload: {
    data: {x1: number, x2: number, y: number}[];
  };
}

export interface RSMResponse {
  type: 'RSM_CALCULATED' | 'ERROR';
  payload?: {
    beta: number[]; // [b0, b1, b2, b11, b22, b12]
    stationaryPoint: {x1: number, x2: number, y: number} | null;
    grid: {x1: number, x2: number, y: number}[][]; // For heatmap/surface plot
    minX1: number;
    maxX1: number;
    minX2: number;
    maxX2: number;
  };
  error?: string;
}

function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  const A = M.map((row, i) => {
    const newRow = [...row];
    for (let j = 0; j < n; j++) {
      newRow.push(i === j ? 1 : 0);
    }
    return newRow;
  });

  for (let i = 0; i < n; i++) {
    let pivotRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[j][i]) > Math.abs(A[pivotRow][i])) {
        pivotRow = j;
      }
    }

    if (pivotRow !== i) {
      const temp = A[i];
      A[i] = A[pivotRow];
      A[pivotRow] = temp;
    }

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("Matrix is singular");
    }

    for (let j = 0; j < 2 * n; j++) {
      A[i][j] /= pivot;
    }

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const factor = A[j][i];
        for (let k = 0; k < 2 * n; k++) {
          A[j][k] -= factor * A[i][k];
        }
      }
    }
  }
  return A.map(row => row.slice(n));
}

function multiplyMatrix(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = A[0].length, p = B[0].length;
  const C = Array.from({length: m}, () => new Array(p).fill(0));
  for(let i=0; i<m; i++){
    for(let j=0; j<p; j++){
      let sum = 0;
      for(let k=0; k<n; k++) sum += A[i][k] * B[k][j];
      C[i][j] = sum;
    }
  }
  return C;
}

function transposeMatrix(A: number[][]): number[][] {
  const m = A.length, n = A[0].length;
  const C = Array.from({length: n}, () => new Array(m).fill(0));
  for(let i=0; i<m; i++){
    for(let j=0; j<n; j++){
      C[j][i] = A[i][j];
    }
  }
  return C;
}

self.onmessage = (e: MessageEvent<RSMMessage>) => {
  try {
    const { data } = e.data.payload;
    if (data.length < 6) {
      throw new Error("RSM required at least 6 data points to fit a quadratic surface.");
    }
    
    // Model: y = b0 + b1*x1 + b2*x2 + b11*x1^2 + b22*x2^2 + b12*x1*x2
    const X: number[][] = [];
    const Y: number[][] = [];
    let minX1 = Infinity, maxX1 = -Infinity;
    let minX2 = Infinity, maxX2 = -Infinity;
    
    for (const p of data) {
      X.push([1, p.x1, p.x2, p.x1 * p.x1, p.x2 * p.x2, p.x1 * p.x2]);
      Y.push([p.y]);
      if (p.x1 < minX1) minX1 = p.x1;
      if (p.x1 > maxX1) maxX1 = p.x1;
      if (p.x2 < minX2) minX2 = p.x2;
      if (p.x2 > maxX2) maxX2 = p.x2;
    }
    
    // Safety expansion
    const rangeX1 = maxX1 - minX1;
    const rangeX2 = maxX2 - minX2;
    
    if (rangeX1 === 0 || rangeX2 === 0) {
      throw new Error("Independent variables must have variation.");
    }

    const X_T = transposeMatrix(X);
    const X_T_X = multiplyMatrix(X_T, X);
    const X_T_X_inv = invertMatrix(X_T_X);
    const X_T_Y = multiplyMatrix(X_T, Y);
    const betaMatrix = multiplyMatrix(X_T_X_inv, X_T_Y);
    const beta = betaMatrix.map(row => row[0]);
    // beta = [b0, b1, b2, b11, b22, b12]
    
    const [b0, b1, b2, b11, b22, b12] = beta;
    
    // Find stationary point
    // dy/dx1 = b1 + 2*b11*x1 + b12*x2 = 0
    // dy/dx2 = b2 + 2*b22*x2 + b12*x1 = 0
    // 2*b11*x1 + b12*x2 = -b1
    // b12*x1 + 2*b22*x2 = -b2
    const D = 4 * b11 * b22 - b12 * b12;
    let stationaryPoint = null;
    if (Math.abs(D) > 1e-12) {
      const x1_opt = (-2 * b1 * b22 + b2 * b12) / D;
      const x2_opt = (-2 * b2 * b11 + b1 * b12) / D;
      
      const y_opt = b0 + b1*x1_opt + b2*x2_opt + b11*x1_opt*x1_opt + b22*x2_opt*x2_opt + b12*x1_opt*x2_opt;
      stationaryPoint = { x1: x1_opt, x2: x2_opt, y: y_opt };
    }
    
    // Generate grid for heatmap (say 30x30)
    const GRID_SIZE = 30;
    const grid: {x1: number, x2: number, y: number}[][] = [];
    
    // Add margin to min/max
    const gMinX1 = minX1 - rangeX1 * 0.2;
    const gMaxX1 = maxX1 + rangeX1 * 0.2;
    const gMinX2 = minX2 - rangeX2 * 0.2;
    const gMaxX2 = maxX2 + rangeX2 * 0.2;
    
    for (let i = 0; i < GRID_SIZE; i++) {
      const row = [];
      const cx2 = gMinX2 + (i / (GRID_SIZE - 1)) * (gMaxX2 - gMinX2);
      for (let j = 0; j < GRID_SIZE; j++) {
        const cx1 = gMinX1 + (j / (GRID_SIZE - 1)) * (gMaxX1 - gMinX1);
        const cy = b0 + b1*cx1 + b2*cx2 + b11*cx1*cx1 + b22*cx2*cx2 + b12*cx1*cx2;
        row.push({ x1: cx1, x2: cx2, y: cy });
      }
      grid.push(row);
    }
    
    self.postMessage({
      type: 'RSM_CALCULATED',
      payload: { beta, stationaryPoint, grid, minX1: gMinX1, maxX1: gMaxX1, minX2: gMinX2, maxX2: gMaxX2 }
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
