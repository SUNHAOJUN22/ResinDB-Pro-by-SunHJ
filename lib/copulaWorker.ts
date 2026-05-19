export interface CopulaMessage {
  type: 'CALCULATE_COPULA';
  payload: {
    data: { x: number; y: number }[];
    gridSize?: number;
  };
}

export interface CopulaResponse {
  type: 'COPULA_RESULT' | 'ERROR';
  payload?: {
    rho: number;
    sortedX: number[];
    sortedY: number[];
    grid: { u: number; v: number; z: number }[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  error?: string;
}

function norminv(p: number): number {
    if (p <= 0) return -5;
    if (p >= 1) return 5;
    const a1 = -3.969683028665376e+01;
    const a2 = 2.209460984245205e+02;
    const a3 = -2.759285104469687e+02;
    const a4 = 1.383577518672690e+02;
    const a5 = -3.066479806614716e+01;
    const a6 = 2.506628277459239e+00;

    const b1 = -5.447609879822406e+01;
    const b2 = 1.615858368580409e+02;
    const b3 = -1.556989798598866e+02;
    const b4 = 6.680131188771972e+01;
    const b5 = -1.328068155288572e+01;

    const c1 = -7.784894002430293e-03;
    const c2 = -3.223964580411365e-01;
    const c3 = -2.400758277161838e+00;
    const c4 = -2.549732539343734e+00;
    const c5 = 4.374664141464968e+00;
    const c6 = 2.938163982698783e+00;

    const d1 = 7.784695709041462e-03;
    const d2 = 3.224671290700398e-01;
    const d3 = 2.445134137142996e+00;
    const d4 = 3.754408661907416e+00;

    const p_low = 0.02425;
    const p_high = 1 - p_low;
    let q, r, z;

    if (p < p_low) {
        q = Math.sqrt(-2 * Math.log(p));
        z = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
            ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p <= p_high) {
        q = p - 0.5;
        r = q * q;
        z = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
            (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        z = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
            ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    return z;
}

function getRanks(values: number[]) {
    const indexed = values.map((v, i) => ({v, i}));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
        ranks[indexed[i].i] = i + 1;
    }
    return ranks;
}

self.onmessage = (e: MessageEvent<CopulaMessage>) => {
  try {
    const { data, gridSize = 50 } = e.data.payload;
    const n = data.length;
    if (n < 5) throw new Error("Requires at least 5 points for Copula estimation.");
    
    const xVals = data.map(d => d.x);
    const yVals = data.map(d => d.y);
    
    // For joint CDF calculations
    const sortedX = [...xVals].sort((a,b) => a-b);
    const sortedY = [...yVals].sort((a,b) => a-b);
    
    const rankX = getRanks(xVals);
    const rankY = getRanks(yVals);
    
    let sumZ1Z2 = 0;
    let sumZ1Sq = 0;
    let sumZ2Sq = 0;
    
    for (let i = 0; i < n; i++) {
        const u = rankX[i] / (n + 1);
        const v = rankY[i] / (n + 1);
        
        const z1 = norminv(u);
        const z2 = norminv(v);
        
        sumZ1Z2 += z1 * z2;
        sumZ1Sq += z1 * z1;
        sumZ2Sq += z2 * z2;
    }
    
    let rho = sumZ1Z2 / Math.sqrt(sumZ1Sq * sumZ2Sq);
    if (rho > 0.99) rho = 0.99;
    if (rho < -0.99) rho = -0.99;
    
    const grid = [];
    for (let i = 1; i < gridSize; i++) {
        const u = i / gridSize;
        const z1 = norminv(u);
        const z1Sq = z1 * z1;
        
        for (let j = 1; j < gridSize; j++) {
            const v = j / gridSize;
            const z2 = norminv(v);
            const z2Sq = z2 * z2;
            
            // Gaussian Copula PDF
            const exponent = - (rho * rho * (z1Sq + z2Sq) - 2 * rho * z1 * z2) / (2 * (1 - rho * rho));
            const c_uv = (1 / Math.sqrt(1 - rho * rho)) * Math.exp(exponent);
            
            grid.push({ u, v, z: c_uv });
        }
    }
    
    const minX = sortedX[0];
    const maxX = sortedX[n-1];
    const minY = sortedY[0];
    const maxY = sortedY[n-1];

    self.postMessage({
      type: 'COPULA_RESULT',
      payload: { rho, sortedX, sortedY, grid, minX, maxX, minY, maxY }
    } as CopulaResponse);

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
