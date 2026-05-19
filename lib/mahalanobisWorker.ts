
export interface MahalanobisMessage {
  type: 'CALCULATE_MAHALANOBIS';
  payload: {
    data: (Record<string, number> & { _id: string, name: string })[];
    features: string[];
    alpha?: number; // e.g. 0.05 or 0.01 for Chi-Square
  };
}

export interface MahalanobisResponse {
  type: 'MAHALANOBIS_RESULT' | 'ERROR';
  payload?: {
    distances: { index: number; id: string; name: string; distance: number; isOutlier: boolean }[];
    threshold: number;
    mean: Record<string, number>;
  };
  error?: string;
}

function invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const a = matrix.map(r => [...r]);
    const i = Array.from({length: n}, (_, row) => Array.from({length:n}, (_, col) => row===col ? 1 : 0));
    
    for (let j = 0; j < n; j++) {
        let max_idx = j;
        for (let i_row = j + 1; i_row < n; i_row++) {
            if (Math.abs(a[i_row][j]) > Math.abs(a[max_idx][j])) {
                max_idx = i_row;
            }
        }
        
        const temp = a[j];
        a[j] = a[max_idx];
        a[max_idx] = temp;
        
        const tempI = i[j];
        i[j] = i[max_idx];
        i[max_idx] = tempI;
        
        const pivot = a[j][j];
        if (Math.abs(pivot) < 1e-12) {
             throw new Error("协方差矩阵存在严重多重共线性（无法求逆），请减少相关性过高的特征或提供更多不重复样本。");
        }
        
        for (let k = 0; k < n; k++) {
            a[j][k] /= pivot;
            i[j][k] /= pivot;
        }
        
        for (let i_row = 0; i_row < n; i_row++) {
            if (i_row !== j) {
                const factor = a[i_row][j];
                for (let k = 0; k < n; k++) {
                    a[i_row][k] -= factor * a[j][k];
                    i[i_row][k] -= factor * i[j][k];
                }
            }
        }
    }
    return i;
}

// Wilson-Hilferty transformation for Chi-Square inverse approximation
function getChiSquareThreshold(df: number, a: number): number {
    let Z = 1.64485; // alpha 0.05
    if (Math.abs(a - 0.05) < 1e-4) Z = 1.64485;
    else if (Math.abs(a - 0.01) < 1e-4) Z = 2.32635;
    else if (Math.abs(a - 0.001) < 1e-4) Z = 3.09023;
    
    const term1 = 1 - 2 / (9 * df);
    const term2 = Z * Math.sqrt(2 / (9 * df));
    return df * Math.pow(Math.max(0, term1 + term2), 3);
}

self.onmessage = (e: MessageEvent<MahalanobisMessage>) => {
    try {
        const { data, features, alpha = 0.01 } = e.data.payload;
        if (features.length < 2) {
            throw new Error("请至少选择2个特征进行多元异常检测。");
        }
        if (data.length <= features.length) {
            throw new Error(`需要至少 ${features.length + 1} 个有效观察样本以建立全秩协方差矩阵，当前可用样本数: ${data.length}。`);
        }
        
        const n = data.length;
        const p = features.length;
        
        // 1. Calculate Mean
        const mean: number[] = new Array(p).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < p; j++) {
                mean[j] += data[i][features[j]];
            }
        }
        for (let j = 0; j < p; j++) mean[j] /= n;
        
        // 2. Covariance Matrix
        const cov: number[][] = Array.from({length: p}, () => new Array(p).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < p; j++) {
                for (let k = 0; k < p; k++) {
                    cov[j][k] += (data[i][features[j]] - mean[j]) * (data[i][features[k]] - mean[k]);
                }
            }
        }
        for (let j = 0; j < p; j++) {
            for (let k = 0; k < p; k++) {
                cov[j][k] /= (n - 1);
                // regularize diagonal
                if (j === k) cov[j][k] += 1e-8; 
            }
        }
        
        const invCov = invertMatrix(cov);
        
        const threshold = getChiSquareThreshold(p, alpha);
        
        const distances = [];
        for (let i = 0; i < n; i++) {
            const diff = new Array(p).fill(0);
            for (let j = 0; j < p; j++) {
                diff[j] = data[i][features[j]] - mean[j];
            }
            
            let distSq = 0; // D^2 (Mahalanobis Distance Squared, follows Chi-Square)
            for (let j = 0; j < p; j++) {
                let temp = 0;
                for (let k = 0; k < p; k++) {
                    temp += invCov[j][k] * diff[k];
                }
                distSq += diff[j] * temp;
            }
            
            distances.push({
                index: i + 1,
                id: data[i]._id,
                name: data[i].name,
                distance: distSq,
                isOutlier: distSq > threshold
            });
        }
        
        const meanObj = features.reduce((acc, f, i) => {
            acc[f] = mean[i];
            return acc;
        }, {} as Record<string, number>);

        self.postMessage({
            type: 'MAHALANOBIS_RESULT',
            payload: {
                distances,
                threshold,
                mean: meanObj
            }
        });

    } catch (e) {
        self.postMessage({
            type: 'ERROR',
            error: e instanceof Error ? e.message : String(e)
        });
    }
};
