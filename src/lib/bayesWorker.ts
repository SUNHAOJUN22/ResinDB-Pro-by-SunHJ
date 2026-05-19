
export interface BayesMessage {
  type: 'RUN_BAYES';
  payload: {
    data: Record<string, number>[];
    features: string[];
    target: string;
    maximize: boolean;
    iterations?: number;
  };
}

export interface BayesResponse {
  type: 'BAYES_RESULT' | 'ERROR';
  payload?: {
    historical: { index: number; y: number; y_pred: number; y_std: number }[];
    suggestions: { params: Record<string, number>; mean: number; std: number; ei: number }[];
    convergence: { index: number; currentBest: number }[];
    targetName: string;
    maximize: boolean;
  };
  error?: string;
}

function erf(x: number): number {
    const sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
}

function cdf(x: number): number {
    return 0.5 * (1 + erf(x / Math.SQRT2));
}

function pdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function cholesky(A: number[][], maxJitter = 1.0): number[][] {
    const n = A.length;
    let jitter = 1e-9;
    
    while (jitter < maxJitter) {
        let success = true;
        const L = Array.from({length: n}, () => new Array(n).fill(0));
        
        for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) {
                let sum = 0;
                for (let k = 0; k < j; k++) {
                    sum += L[i][k] * L[j][k];
                }
                if (i === j) {
                    const val = A[i][i] + (jitter === 1e-9 ? 0 : jitter) - sum;
                    if (val <= 0) {
                        success = false;
                        break;
                    }
                    L[i][j] = Math.sqrt(val);
                } else {
                    L[i][j] = (1.0 / L[j][j]) * (A[i][j] - sum);
                }
            }
            if (!success) break;
        }
        if (success) return L;
        jitter *= 10;
    }
    throw new Error("Kriging Covariance Matrix is not positive definite, too much multicollinearity in data.");
}

function forwardSolve(L: number[][], B: number[]): number[] {
    const n = L.length;
    const Y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < i; j++) sum += L[i][j] * Y[j];
        Y[i] = (B[i] - sum) / L[i][i];
    }
    return Y;
}

function backwardSolve(L: number[][], Y: number[]): number[] {
    const n = L.length;
    const X = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) sum += L[j][i] * X[j];
        X[i] = (Y[i] - sum) / L[i][i];
    }
    return X;
}

function rbf(x1: number[], x2: number[], l: number): number {
    let sum = 0;
    for (let i = 0; i < x1.length; i++) sum += Math.pow(x1[i] - x2[i], 2);
    return Math.exp(-0.5 * sum / (l * l));
}

self.onmessage = (e: MessageEvent<BayesMessage>) => {
    try {
        const { data, features, target, maximize, iterations = 10000 } = e.data.payload;
        
        if (features.length === 0) throw new Error("No features selected for Bayesian Optimization.");
        if (!target) throw new Error("No target selected.");
        if (data.length < 3) throw new Error("At least 3 valid data points are required to build GP.");

        const n = data.length;
        const d = features.length;
        
        const X: number[][] = [];
        const Y: number[] = [];
        
        for (const row of data) {
            const xRow = features.map(f => row[f]);
            X.push(xRow);
            Y.push(row[target]);
        }
        
        // Normalize X
        const xMin = new Array(d).fill(Infinity);
        const xMax = new Array(d).fill(-Infinity);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < d; j++) {
                if (X[i][j] < xMin[j]) xMin[j] = X[i][j];
                if (X[i][j] > xMax[j]) xMax[j] = X[i][j];
            }
        }
        
        const X_norm = X.map(row => 
            row.map((val, j) => {
                const range = xMax[j] - xMin[j];
                return range === 0 ? 0 : (val - xMin[j]) / range;
            })
        );
        
        // Standardize Y
        const yMean = Y.reduce((a, b) => a + b, 0) / n;
        let yStd = Math.sqrt(Y.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0) / n);
        if (yStd === 0) yStd = 1;
        
        const Y_norm = Y.map(y => (y - yMean) / yStd);
        
        // GP Params
        const l = Math.sqrt(d) * 0.5; // heuristic length scale
        const noise = 1e-4;
        
        // Build K
        const K = Array.from({length: n}, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) {
                const val = rbf(X_norm[i], X_norm[j], l);
                K[i][j] = val;
                K[j][i] = val;
            }
            K[i][i] += noise;
        }
        
        const L = cholesky(K);
        const alpha = backwardSolve(L, forwardSolve(L, Y_norm));
        
        const yBestNorm = maximize ? Math.max(...Y_norm) : Math.min(...Y_norm);
        
        // Random Search for EI
        const suggestions: { params: Record<string, number>; mean: number; std: number; ei: number }[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const xStarNorm = new Array(d).fill(0).map(() => Math.random());
            const kStar = X_norm.map(x => rbf(x, xStarNorm, l));
            
            let meanStarNorm = 0;
            for (let j = 0; j < n; j++) meanStarNorm += kStar[j] * alpha[j];
            
            const v = forwardSolve(L, kStar);
            let vTv = 0;
            for (let j=0; j<n; j++) vTv += v[j]*v[j];
            const varStarNorm = Math.max(1e-12, 1.0 - vTv);
            const stdStarNorm = Math.sqrt(varStarNorm);
            
            let ei = 0;
            const delta = maximize ? (meanStarNorm - yBestNorm) : (yBestNorm - meanStarNorm);
            const z = delta / stdStarNorm;
            
            if (stdStarNorm > 0) {
                ei = delta * cdf(z) + stdStarNorm * pdf(z);
            }
            
            suggestions.push({
                params: features.reduce((acc, f, idx) => {
                    const range = xMax[idx] - xMin[idx];
                    acc[f] = range === 0 ? xMin[idx] : (xStarNorm[idx] * range) + xMin[idx];
                    return acc;
                }, {} as Record<string, number>),
                mean: meanStarNorm * yStd + yMean,
                std: stdStarNorm * yStd,
                ei: ei
            });
        }
        
        suggestions.sort((a, b) => b.ei - a.ei);
        const topSuggestions = suggestions.slice(0, 5);
        
        // Historical points to check self-consistency
        const historical = [];
        for (let i = 0; i < n; i++) {
            const kStar = X_norm.map(x => rbf(x, X_norm[i], l));
            let meanStarNorm = 0;
            for (let j = 0; j < n; j++) meanStarNorm += kStar[j] * alpha[j];
            
            const v = forwardSolve(L, kStar);
            let vTv = 0;
            for (let j=0; j<n; j++) vTv += v[j]*v[j];
            const varStarNorm = Math.max(1e-12, 1.0 - vTv);
            
            historical.push({
                index: i + 1,
                y: Y[i],
                y_pred: meanStarNorm * yStd + yMean,
                y_std: Math.sqrt(varStarNorm) * yStd
            });
        }
        
        // sort by Y to make a clean monotonically increasing/decreasing line
        historical.sort((a, b) => a.y - b.y);
        
        // Cumulative max/min convergence path
        const convergence = [];
        let currentBest = Y[0];
        for (let i = 0; i < n; i++) {
            if (maximize) {
                if (Y[i] > currentBest) currentBest = Y[i];
            } else {
                if (Y[i] < currentBest) currentBest = Y[i];
            }
            convergence.push({ index: i + 1, currentBest });
        }

        self.postMessage({
            type: 'BAYES_RESULT',
            payload: {
                historical,
                suggestions: topSuggestions,
                convergence,
                targetName: target,
                maximize
            }
        });

    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
