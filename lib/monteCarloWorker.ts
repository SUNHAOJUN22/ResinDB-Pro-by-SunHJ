import { FormulaConfig, Product, PropertyValue } from '../types';
import { formulaEngine } from './formulaParser';

export interface MonteCarloMessage {
  type: 'RUN_SIMULATION';
  payload: {
    targetFormulaId: string;
    formulas: FormulaConfig[];
    product: Product;
    variances: Record<string, number>; // std dev as % of base value (e.g., 5 for 5%)
    iterations?: number;
  };
}

export interface MonteCarloResponse {
  type: 'SIMULATION_COMPLETE' | 'ERROR';
  payload?: {
    results: number[]; // the array of outputs
    stats: {
      mean: number;
      stdDev: number;
      p5: number;
      p95: number;
      kde: {x: number, y: number}[];
    };
  };
  error?: string;
}

// Box-Muller transform for normal distribution sampling
function randomNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  const num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  return num * stdDev + mean;
}

// Kernel Density Estimation (Gaussian)
function calculateKDE(data: number[], bandwidth: number, steps: number = 100): {x: number, y: number}[] {
    if (data.length === 0) return [];
    
    let min = data[0], max = data[0];
    for (const d of data) {
        if (d < min) min = d;
        if (d > max) max = d;
    }
    
    // Add margin
    const margin = (max - min) * 0.1 || bandwidth * 3;
    min -= margin;
    max += margin;
    
    const step = (max - min) / steps;
    const kde = [];
    
    for (let x = min; x <= max; x += step) {
        let sum = 0;
        for (const d of data) {
            const u = (x - d) / bandwidth;
            sum += Math.exp(-0.5 * u * u) / (Math.sqrt(2 * Math.PI));
        }
        kde.push({ x, y: sum / (data.length * bandwidth) });
    }
    return kde;
}

self.onmessage = (e: MessageEvent<MonteCarloMessage>) => {
  try {
    const { targetFormulaId, formulas, product, variances, iterations = 5000 } = e.data.payload;
    
    const evaluator = formulaEngine.compileGraph(formulas);
    const results: number[] = [];
    
    // Determine which properties actually need variance
    const baseProperties = product.properties;

    for (let i = 0; i < iterations; i++) {
        // Create a fake product with perturbed properties
        const perturbedProps: Record<string, PropertyValue> = {};
        
        for (const [key, val] of Object.entries(baseProperties)) {
            const numVal = parseFloat(String(val.value));
            if (!isNaN(numVal) && variances[key]) {
                const stdDev = numVal * (variances[key] / 100);
                perturbedProps[key] = { ...val, value: randomNormal(numVal, stdDev) };
            } else {
                perturbedProps[key] = val;
            }
        }
        
        const testProduct = { ...product, properties: perturbedProps } as Product;
        const computed = evaluator(testProduct);
        const result = computed[targetFormulaId];
        
        if (result !== undefined && !isNaN(result)) {
            results.push(result);
        }
    }
    
    if (results.length === 0) {
        throw new Error("Simulation yielded no valid numeric results.");
    }

    results.sort((a, b) => a - b);
    
    const sum = results.reduce((a, b) => a + b, 0);
    const mean = sum / results.length;
    const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);
    
    const p5 = results[Math.floor(results.length * 0.05)];
    const p95 = results[Math.floor(results.length * 0.95)];
    
    // Scott's rule for bandwidth
    const bandwidth = 1.06 * stdDev * Math.pow(results.length, -0.2);
    const kde = calculateKDE(results, bandwidth, 100);

    self.postMessage({
      type: 'SIMULATION_COMPLETE',
      payload: {
        results,
        stats: { mean, stdDev, p5, p95, kde }
      }
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
