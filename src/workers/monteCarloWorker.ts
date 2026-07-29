import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import { FormulaConfig, Product, PropertyValue } from '@/types/index';
import { formulaEngine } from '@/lib/formulaParser';

export interface MonteCarloMessage {
  type: 'RUN_SIMULATION';
  payload: {
    targetFormulaId: string;
    formulas: FormulaConfig[];
    product: Product;
    variances: Record<string, number>;
    iterations?: number;
  };
}

export interface MonteCarloResponse {
  type: 'SIMULATION_COMPLETE' | 'ERROR';
  payload?: {
    results: number[];
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

function randomNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  const num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  return num * stdDev + mean;
}

function calculateKDE(data: number[], bandwidth: number, steps: number = 100): {x: number, y: number}[] {
    if (data.length === 0) return [];

    let min = data[0], max = data[0];
    for (const d of data) {
        if (d < min) min = d;
        if (d > max) max = d;
    }

    const margin = (max - min) * 0.1 || bandwidth * 3;
    min -= margin;
    max += margin;

    const safeSteps = steps > 0 ? steps : 100;
    const step = (max - min) / safeSteps;
    const kde = [];

    for (let x = min; x <= max; x += step) {
        let sum = 0;
        for (const d of data) {
            const safeBW = Math.abs(bandwidth) > 1e-15 ? bandwidth : 1e-15;
            const u = (x - d) / safeBW;
            sum += Math.exp(-0.5 * u * u) / (Math.sqrt(2 * Math.PI));
        }
        const denom = data.length * (Math.abs(bandwidth) > 1e-15 ? bandwidth : 1e-15);
        kde.push({ x, y: sum / denom });
    }
    return kde;
}

self.onmessage = (e: MessageEvent<MonteCarloMessage>) => {
  try {
    const { targetFormulaId, formulas, product, variances, iterations = 5000 } = e.data.payload;

    const evaluator = formulaEngine.compileGraph(formulas);
    const results: number[] = [];
    const baseProperties = product.properties;
    const progressInterval = Math.max(1, Math.floor(iterations / 20));

    self.postMessage(createWorkerProgressMessage({
      ratio: 0,
      completed: 0,
      total: iterations,
      phase: 'sampling',
    }));

    for (let i = 0; i < iterations; i++) {
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

        const completed = i + 1;
        if (completed % progressInterval === 0 || completed === iterations) {
          self.postMessage(createWorkerProgressMessage({
            ratio: (completed / iterations) * 0.85,
            completed,
            total: iterations,
            phase: 'sampling',
          }));
        }
    }

    if (results.length === 0) {
        throw new Error("Simulation yielded no valid numeric results.");
    }

    self.postMessage(createWorkerProgressMessage({ ratio: 0.9, phase: 'statistics' }));
    results.sort((a, b) => a - b);

    const sum = results.reduce((a, b) => a + b, 0);
    const safeLen = results.length || 1;
    const mean = sum / safeLen;
    const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / safeLen;
    const stdDev = Math.sqrt(variance);

    const p5 = results[Math.floor(results.length * 0.05)];
    const p95 = results[Math.floor(results.length * 0.95)];

    const bandwidth = 1.06 * stdDev * Math.pow(results.length, -0.2);
    const kde = calculateKDE(results, bandwidth, 100);
    self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));

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
