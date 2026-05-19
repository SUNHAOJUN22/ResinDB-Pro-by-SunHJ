
export interface MooTarget {
    name: string;
    maximize: boolean;
}

export interface MooMessage {
  type: 'RUN_MOO';
  payload: {
    data: Record<string, number>[];
    features: string[];
    targets: MooTarget[];
    iterations?: number;
  };
}

export interface MooResponse {
  type: 'MOO_RESULT' | 'ERROR';
  payload?: {
    paretoFront: { params: Record<string, number>; means: Record<string, number>; stds: Record<string, number> }[];
    evaluatedCandidates: { params: Record<string, number>; means: Record<string, number> }[];
    historical: Record<string, number>[];
    targets: MooTarget[];
  };
  error?: string;
}

// Simple RBF, Cholesky, etc...
// To avoid duplication and complexity, we can re-implement slightly simplified GP here for MOO.

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
    throw new Error("Kriging Covariance Matrix is not positive definite.");
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

function isParetoDominating(a: Record<string, number>, b: Record<string, number>, targets: MooTarget[]): boolean {
    // Returns true if 'a' dominates 'b'
    let strictlyBetter = false;
    for (const t of targets) {
        const valA = a[t.name];
        const valB = b[t.name];
        if (t.maximize) {
            if (valA < valB) return false; // a is worse in at least one target
            if (valA > valB) strictlyBetter = true;
        } else {
            if (valA > valB) return false;
            if (valA < valB) strictlyBetter = true;
        }
    }
    return strictlyBetter;
}

self.onmessage = (e: MessageEvent<MooMessage>) => {
    try {
        const { data, features, targets, iterations = 10000 } = e.data.payload;
        
        if (features.length === 0) throw new Error("No features selected.");
        if (targets.length < 2) throw new Error("At least 2 targets required for MOO.");
        if (data.length < 3) throw new Error("At least 3 valid data points are required.");

        const n = data.length;
        const d = features.length;
        
        const X: number[][] = [];
        
        for (const row of data) {
            X.push(features.map(f => row[f]));
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

        // GP Models for each target
        const l = Math.sqrt(d) * 0.5; // heuristic length scale
        const noise = 1e-4;
        
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

        const gps = targets.map(t => {
            const Y = data.map(row => row[t.name]);
            const yMean = Y.reduce((a, b) => a + b, 0) / n;
            let yStd = Math.sqrt(Y.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0) / n);
            if (yStd === 0) yStd = 1;
            const Y_norm = Y.map(y => (y - yMean) / yStd);
            const alpha = backwardSolve(L, forwardSolve(L, Y_norm));
            return { name: t.name, maximize: t.maximize, yMean, yStd, alpha };
        });
        
        // Generate Candidates and predict
        const candidates: { params: Record<string, number>; means: Record<string, number>; stds: Record<string, number> }[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const xStarNorm = new Array(d).fill(0).map(() => Math.random());
            const kStar = X_norm.map(x => rbf(x, xStarNorm, l));
            
            const v = forwardSolve(L, kStar);
            let vTv = 0;
            for (let j=0; j<n; j++) vTv += v[j]*v[j];
            const varStarNorm = Math.max(1e-12, 1.0 - vTv);
            const stdStarNorm = Math.sqrt(varStarNorm);

            const means: Record<string, number> = {};
            const stds: Record<string, number> = {};

            for (const gp of gps) {
                let meanStarNorm = 0;
                for (let j = 0; j < n; j++) meanStarNorm += kStar[j] * gp.alpha[j];
                
                means[gp.name] = meanStarNorm * gp.yStd + gp.yMean;
                stds[gp.name] = stdStarNorm * gp.yStd;
            }

            const params = features.reduce((acc, f, idx) => {
                const range = xMax[idx] - xMin[idx];
                acc[f] = range === 0 ? xMin[idx] : (xStarNorm[idx] * range) + xMin[idx];
                return acc;
            }, {} as Record<string, number>);

            candidates.push({ params, means, stds });
        }
        
        // Extract Pareto Front among candidates
        const paretoFront: typeof candidates = [];
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            let isDominated = false;
            for (let j = 0; j < candidates.length; j++) {
                if (i !== j) {
                    if (isParetoDominating(candidates[j].means, c.means, targets)) {
                        isDominated = true;
                        break;
                    }
                }
            }
            if (!isDominated) {
                paretoFront.push(c);
            }
        }

        // To bound visual output, maybe sample evaluated candidates
        // We'll just return a random subset of 1000 evaluated candidates so the scatter plot is not overwhelmed.
        // We ensure all pareto front points are returned in paretoFront
        
        // Randomly shuffle candidates
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const sampledCandidates = candidates.slice(0, 1000);

        self.postMessage({
            type: 'MOO_RESULT',
            payload: {
                paretoFront,
                evaluatedCandidates: sampledCandidates,
                historical: data,
                targets: targets
            }
        });

    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
