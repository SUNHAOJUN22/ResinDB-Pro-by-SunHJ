export interface CarreauMessage {
  type: 'FIT_CARREAU';
  payload: {
    shearRates: number[]; // x
    viscosities: number[]; // y
  };
}

export interface CarreauResponse {
  type: 'CARREAU_FITTED' | 'ERROR';
  payload?: {
    eta0: number;
    lambda: number;
    n: number;
    a: number;
    fittedData: [number, number][]; // [x, y]
    rSquared: number;
  };
  error?: string;
}

// eta = eta0 * (1 + (lambda * gamma_dot)^a)^((n - 1) / a)
function carreauEval(x: number, eta0: number, lambda: number, n: number, a: number) {
   const term = Math.max(0, lambda * x);
   const safeA = Math.abs(a) > 1e-15 ? a : 1e-15;
   return eta0 * Math.pow(Math.max(1e-15, 1 + Math.pow(term, a)), (n - 1) / safeA);
}

function calculateRSquared(x: number[], y: number[], eta0: number, lambda: number, n: number, a: number) {
    if (y.length === 0) return 0;
    let yMean = 0;
    for (let i = 0; i < y.length; i++) yMean += y[i];
    yMean /= y.length;

    let ssTot = 0;
    let ssRes = 0;
    
    for (let i = 0; i < x.length; i++) {
        const yPred = carreauEval(x[i], eta0, lambda, n, a);
        ssTot += Math.pow(y[i] - yMean, 2);
        ssRes += Math.pow(y[i] - yPred, 2);
    }
    
    if (ssTot === 0) return 1;
    return 1 - (ssRes / ssTot);
}

self.onmessage = (e: MessageEvent<CarreauMessage>) => {
  try {
    const { shearRates, viscosities } = e.data.payload;
    const validRates: number[] = [];
    const validViscosities: number[] = [];
    for (let i = 0; i < shearRates.length; i++) {
      if (shearRates[i] > 0 && viscosities[i] > 0) {
        validRates.push(shearRates[i]);
        validViscosities.push(viscosities[i]);
      }
    }

    if (validRates.length < 3) {
       throw new Error("Insufficient valid data points (shear rate > 0 and viscosity > 0) for fitting.");
    }

    // Grid search roughly
    // eta0: roughly max viscosity
    const maxEta = Math.max(...validViscosities);
    
    let bestParams = { eta0: maxEta, lambda: 0.1, n: 0.5, a: 1 };
    let bestR2 = -Infinity;
    
    // We'll perform a coarse grid search to find the best starting point
    // Note: normally we'd use Levenberg-Marquardt, but a dense grid search for 3-4 params can work for UI purposes if bounded.
    const eta0Options = [maxEta, maxEta * 1.5, maxEta * 2];
    const lambdaOptions = [0.001, 0.01, 0.1, 1, 10];
    const nOptions = [0.1, 0.3, 0.5, 0.7, 0.9];
    const aOptions = [1, 2]; // usually 1 or 2
    
    for (const eta0 of eta0Options) {
        for (const lambda of lambdaOptions) {
            for (const n of nOptions) {
                for (const a of aOptions) {
                    const r2 = calculateRSquared(validRates, validViscosities, eta0, lambda, n, a);
                    if (r2 > bestR2) {
                        bestR2 = r2;
                        bestParams = { eta0, lambda, n, a };
                    }
                }
            }
        }
    }
    
    // Gradient Descent fine-tuning (simplified)
    let { eta0, lambda, n } = bestParams;
    const { a } = bestParams;
    const lrEta = eta0 * 0.001;
    const lrLambda = 0.001;
    const lrN = 0.001;
    
    for (let iter = 0; iter < 1000; iter++) {
        let gradEta = 0;
        let gradLambda = 0;
        let gradN = 0;
        
        for (let i = 0; i < validRates.length; i++) {
            const x = validRates[i];
            const y = validViscosities[i];
            
            const safeLambda = Math.max(1e-5, lambda);
            const safeA = Math.abs(a) > 1e-15 ? a : 1e-15;
            const base = Math.max(1e-15, 1 + Math.pow(safeLambda * x, a));
            const power = (n - 1) / safeA;
            const yPred = eta0 * Math.pow(base, power);
            
            const diff = yPred - y;
            
            gradEta += diff * Math.pow(base, power);
            gradLambda += diff * eta0 * power * Math.pow(base, Math.max(-100, power - 1)) * a * Math.pow(x, a) * Math.pow(safeLambda, a - 1);
            gradN += diff * eta0 * Math.pow(base, power) * Math.log(base) / safeA;
        }
        
        const rateLen = validRates.length > 0 ? validRates.length : 1;
        eta0 -= lrEta * gradEta / rateLen;
        lambda -= lrLambda * gradLambda / rateLen;
        n -= lrN * gradN / rateLen;
        
        // Bounds
        if (eta0 < maxEta * 0.5) eta0 = maxEta * 0.5;
        if (lambda < 0.0001) lambda = 0.0001;
        if (n < 0.01) n = 0.01;
        if (n > 1) n = 1;
    }
    
    const finalR2 = calculateRSquared(validRates, validViscosities, eta0, lambda, n, a);
    
    // Generate fitted curve data
    const minX = Math.min(...validRates);
    const maxX = Math.max(...validRates);
    
    const fittedData: [number, number][] = [];
    const steps = 100;
    
    // log scale generation
    const logMinX = Math.log10(minX > 0 ? minX : 0.1);
    const logMaxX = Math.log10(maxX > 0 ? maxX : 1.0);
    
    for (let i = 0; i <= steps; i++) {
        const currentLogX = logMinX + (logMaxX - logMinX) * (i / steps);
        const x = Math.pow(10, currentLogX);
        const y = carreauEval(x, eta0, lambda, n, a);
        fittedData.push([x, y]);
    }

    self.postMessage({
      type: 'CARREAU_FITTED',
      payload: {
        eta0, lambda, n, a, fittedData, rSquared: finalR2
      }
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// v3.1.0-sync

// v3.1.0-sync-fixed
