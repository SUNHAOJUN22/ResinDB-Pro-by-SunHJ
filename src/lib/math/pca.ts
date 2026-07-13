export class PCA {
  // Simple NIPALS algorithm for PCA (Non-linear Iterative Partial Least Squares)
  // Extracts the first numComponents principal components.
  
  static getComponents(data: number[][], numComponents: number = 2) {
      if (!data.length || !data[0].length) return { projected: [], loadingVectors: [] };

      // Filter out rows that contain NaN or non-finite values
      const validData = data.filter((row) =>
        row.every((v) => Number.isFinite(v)),
      );

      if (validData.length === 0) return { projected: [], loadingVectors: [] };
      
      const n = validData.length;
      const m = validData[0].length;
      const safeComponents = Math.max(1, Math.floor(numComponents) || 2);
      
      // 1. Zero-mean the data
      const means = new Array(m).fill(0);
      for (let i = 0; i < n; i++) {
          for (let j = 0; j < m; j++) {
              means[j] += validData[i][j];
          }
      }
      for (let j = 0; j < m; j++) {
          // Guard against division by zero (should be unreachable due to early return above)
          means[j] = n > 0 ? means[j] / n : 0;
      }
      
      const X = validData.map(row => row.map((val, j) => val - means[j]));
      
      const loadingVectors: number[][] = [];
      const scores: number[][] = new Array(n).fill(0).map(() => new Array(safeComponents).fill(0));
      
      const residualX = X.map(row => [...row]);
      
      for (let k = 0; k < Math.min(safeComponents, m); k++) {
          // Initialize score vector t as the first column of residualX
          const t = residualX.map(row => row[0]);
          const p = new Array(m).fill(0);
          
          let iter = 0;
          let diff = 1;
          while (iter < 100 && diff > 1e-6) {
              const oldT = [...t];
              
              // p = X^T t / (t^T t)
              let tTt = 0;
              for (let i = 0; i < n; i++) tTt += t[i] * t[i];
              
              if (tTt === 0) break; // Zero variance
              
              for (let j = 0; j < m; j++) {
                  let sum = 0;
                  for (let i = 0; i < n; i++) {
                      sum += residualX[i][j] * t[i];
                  }
                  p[j] = sum / tTt;
              }
              
              // Normalize p: p = p / ||p||
              let pNorm = 0;
              for (let j = 0; j < m; j++) pNorm += p[j] * p[j];
              pNorm = Math.sqrt(Math.max(0, pNorm));
              if (pNorm === 0) break;
              for (let j = 0; j < m; j++) p[j] /= pNorm;
              
              // t = X p / (p^T p) = X p  (since p^T p = 1)
              for (let i = 0; i < n; i++) {
                  let sum = 0;
                  for (let j = 0; j < m; j++) {
                      sum += residualX[i][j] * p[j];
                  }
                  t[i] = sum;
              }
              
              // Check convergence
              diff = 0;
              for (let i = 0; i < n; i++) {
                  diff += Math.pow(t[i] - oldT[i], 2);
              }
              iter++;
          }
          
          loadingVectors.push([...p]);
          for (let i = 0; i < n; i++) {
              scores[i][k] = t[i];
          }
          
          // Deflate: X = X - t p^T
          for (let i = 0; i < n; i++) {
              for (let j = 0; j < m; j++) {
                  residualX[i][j] -= t[i] * p[j];
              }
          }
      }
      
      return { projected: scores, loadingVectors };
  }
}
