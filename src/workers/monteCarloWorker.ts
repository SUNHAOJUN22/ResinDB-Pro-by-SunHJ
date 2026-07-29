import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import {
  createSeededRandom,
  deriveRandomSeed,
  type RandomSeed,
  SEEDED_RANDOM_ALGORITHM,
  SEEDED_RANDOM_ALGORITHM_VERSION,
} from '@/compute/random';
import type { FormulaConfig, Product, PropertyValue } from '@/types/index';
import { formulaEngine } from '@/lib/formulaParser';

const MONTE_CARLO_MODEL_VERSION = 'monte-carlo-formula-1.0.0';
const NORMAL_TRANSFORM_VERSION = 'box-muller-1.0.0';
const MAX_ITERATIONS = 1_000_000;

export interface MonteCarloMessage {
  type: 'RUN_SIMULATION';
  payload: {
    targetFormulaId: string;
    formulas: FormulaConfig[];
    product: Product;
    variances: Record<string, number>;
    iterations?: number;
    seed?: RandomSeed;
  };
}

export interface MonteCarloReproducibility {
  seed: string;
  seedSource: 'user' | 'derived';
  randomAlgorithm: typeof SEEDED_RANDOM_ALGORITHM;
  randomAlgorithmVersion: typeof SEEDED_RANDOM_ALGORITHM_VERSION;
  normalTransformVersion: typeof NORMAL_TRANSFORM_VERSION;
  modelVersion: typeof MONTE_CARLO_MODEL_VERSION;
  requestedIterations: number;
  acceptedSamples: number;
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
    reproducibility: MonteCarloReproducibility;
  };
  error?: string;
}

function validateIterations(iterations: number): number {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new RangeError(`Monte Carlo iterations must be an integer between 1 and ${MAX_ITERATIONS}`);
  }
  return iterations;
}

function validateVariancePercent(value: number, key: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Variance for ${key} must be a non-negative finite percentage`);
  }
  return value;
}

function calculateKDE(data: number[], bandwidth: number, steps: number = 100): {x: number, y: number}[] {
  if (data.length === 0) return [];
  const safeSteps = Number.isInteger(steps) && steps > 0 ? steps : 100;
  let min = data[0];
  let max = data[0];
  for (const value of data) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const fallbackScale = Math.max(Math.abs(min), Math.abs(max), 1) * 1e-6;
  const safeBandwidth = Math.abs(bandwidth) > 1e-15 ? Math.abs(bandwidth) : fallbackScale;
  const margin = (max - min) * 0.1 || safeBandwidth * 3;
  min -= margin;
  max += margin;
  const span = max - min;
  const kde: {x: number, y: number}[] = [];
  for (let index = 0; index <= safeSteps; index++) {
    const x = min + (index / safeSteps) * span;
    let sum = 0;
    for (const value of data) {
      const standardized = (x - value) / safeBandwidth;
      sum += Math.exp(-0.5 * standardized * standardized) / Math.sqrt(2 * Math.PI);
    }
    kde.push({ x, y: sum / (data.length * safeBandwidth) });
  }
  return kde;
}

self.onmessage = (event: MessageEvent<MonteCarloMessage>) => {
  try {
    const {
      targetFormulaId,
      formulas,
      product,
      variances,
      iterations: requestedIterations = 5000,
      seed,
    } = event.data.payload;
    const iterations = validateIterations(requestedIterations);
    const actualSeed = seed ?? deriveRandomSeed('monte-carlo-formula-v1', {
      targetFormulaId,
      formulas,
      product,
      variances,
      iterations,
    });
    const random = createSeededRandom(actualSeed);
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

    for (let iteration = 0; iteration < iterations; iteration++) {
      const perturbedProperties: Record<string, PropertyValue> = {};
      for (const [key, property] of Object.entries(baseProperties)) {
        const numericValue = Number(property.value);
        const variancePercent = variances[key];
        if (Number.isFinite(numericValue) && variancePercent !== undefined && variancePercent !== 0) {
          const validatedVariance = validateVariancePercent(variancePercent, key);
          const standardDeviation = Math.abs(numericValue) * (validatedVariance / 100);
          perturbedProperties[key] = {
            ...property,
            value: random.normal(numericValue, standardDeviation),
          };
        } else {
          perturbedProperties[key] = property;
        }
      }

      const testProduct = { ...product, properties: perturbedProperties } as Product;
      const result = evaluator(testProduct)[targetFormulaId];
      if (Number.isFinite(result)) results.push(result);

      const completed = iteration + 1;
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
      throw new Error('Simulation yielded no valid finite numeric results.');
    }

    self.postMessage(createWorkerProgressMessage({ ratio: 0.9, phase: 'statistics' }));
    results.sort((left, right) => left - right);
    const mean = results.reduce((sum, value) => sum + value, 0) / results.length;
    const variance = results.reduce((sum, value) => sum + (value - mean) ** 2, 0) / results.length;
    const stdDev = Math.sqrt(variance);
    const p5 = results[Math.min(results.length - 1, Math.floor(results.length * 0.05))];
    const p95 = results[Math.min(results.length - 1, Math.floor(results.length * 0.95))];
    const bandwidth = 1.06 * stdDev * Math.pow(results.length, -0.2);
    const kde = calculateKDE(results, bandwidth, 100);
    self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));

    self.postMessage({
      type: 'SIMULATION_COMPLETE',
      payload: {
        results,
        stats: { mean, stdDev, p5, p95, kde },
        reproducibility: {
          seed: random.seed,
          seedSource: seed === undefined ? 'derived' : 'user',
          randomAlgorithm: random.algorithm,
          randomAlgorithmVersion: random.algorithmVersion,
          normalTransformVersion: NORMAL_TRANSFORM_VERSION,
          modelVersion: MONTE_CARLO_MODEL_VERSION,
          requestedIterations: iterations,
          acceptedSamples: results.length,
        },
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
