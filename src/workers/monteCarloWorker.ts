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

const MONTE_CARLO_MODEL_VERSION = 'monte-carlo-formula-2.0.0';
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

export interface MonteCarloPerformance {
  stochasticProperties: number;
  workObjectReused: true;
  typedResultBuffer: true;
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
      kde: {x: number; y: number}[];
    };
    reproducibility: MonteCarloReproducibility;
    performance: MonteCarloPerformance;
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

function calculateKDE(
  data: ArrayLike<number>,
  bandwidth: number,
  steps = 100,
): {x: number; y: number}[] {
  if (data.length === 0) return [];
  const safeSteps = Number.isInteger(steps) && steps > 0 ? steps : 100;
  let min = data[0];
  let max = data[0];
  for (let index = 1; index < data.length; index++) {
    const value = data[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const fallbackScale = Math.max(Math.abs(min), Math.abs(max), 1) * 1e-6;
  const safeBandwidth = Math.abs(bandwidth) > 1e-15 ? Math.abs(bandwidth) : fallbackScale;
  const margin = (max - min) * 0.1 || safeBandwidth * 3;
  min -= margin;
  max += margin;
  const span = max - min;
  const normalization = data.length * safeBandwidth;
  const gaussianNormalization = Math.sqrt(2 * Math.PI);
  const kde: {x: number; y: number}[] = [];
  for (let step = 0; step <= safeSteps; step++) {
    const x = min + (step / safeSteps) * span;
    let sum = 0;
    for (let index = 0; index < data.length; index++) {
      const standardized = (x - data[index]) / safeBandwidth;
      sum += Math.exp(-0.5 * standardized * standardized) / gaussianNormalization;
    }
    kde.push({ x, y: sum / normalization });
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
    for (const [key, variance] of Object.entries(variances)) validateVariancePercent(variance, key);
    const actualSeed = seed ?? deriveRandomSeed('monte-carlo-formula-v2', {
      targetFormulaId,
      formulas,
      product,
      variances,
      iterations,
    });
    const random = createSeededRandom(actualSeed);
    const evaluator = formulaEngine.compileGraph(formulas);
    const workingProperties = Object.fromEntries(
      Object.entries(product.properties).map(([key, property]) => [key, { ...property }]),
    ) as Record<string, PropertyValue>;
    const workingProduct = { ...product, properties: workingProperties } as Product;
    const stochasticProperties: { key: string; mean: number; standardDeviation: number }[] = [];
    for (const [key, property] of Object.entries(workingProperties)) {
      const mean = Number(property.value);
      const variancePercent = variances[key] ?? 0;
      if (Number.isFinite(mean) && variancePercent > 0) {
        stochasticProperties.push({
          key,
          mean,
          standardDeviation: Math.abs(mean) * (variancePercent / 100),
        });
      }
    }

    const resultBuffer = new Float64Array(iterations);
    let acceptedSamples = 0;
    const progressInterval = Math.max(1, Math.floor(iterations / 20));
    self.postMessage(createWorkerProgressMessage({
      ratio: 0,
      completed: 0,
      total: iterations,
      phase: 'sampling',
    }));

    for (let iteration = 0; iteration < iterations; iteration++) {
      for (const stochastic of stochasticProperties) {
        workingProperties[stochastic.key].value = random.normal(
          stochastic.mean,
          stochastic.standardDeviation,
        );
      }
      const result = evaluator(workingProduct)[targetFormulaId];
      if (Number.isFinite(result)) {
        resultBuffer[acceptedSamples] = result;
        acceptedSamples += 1;
      }

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
    if (acceptedSamples === 0) throw new Error('Simulation yielded no valid finite numeric results.');

    self.postMessage(createWorkerProgressMessage({ ratio: 0.9, phase: 'statistics' }));
    const validResults = resultBuffer.subarray(0, acceptedSamples);
    validResults.sort();
    let sum = 0;
    for (let index = 0; index < validResults.length; index++) sum += validResults[index];
    const mean = sum / validResults.length;
    let squaredDeviationSum = 0;
    for (let index = 0; index < validResults.length; index++) {
      squaredDeviationSum += (validResults[index] - mean) ** 2;
    }
    const stdDev = Math.sqrt(squaredDeviationSum / validResults.length);
    const p5 = validResults[Math.min(validResults.length - 1, Math.floor(validResults.length * 0.05))];
    const p95 = validResults[Math.min(validResults.length - 1, Math.floor(validResults.length * 0.95))];
    const bandwidth = 1.06 * stdDev * Math.pow(validResults.length, -0.2);
    const kde = calculateKDE(validResults, bandwidth, 100);
    const results = Array.from(validResults);
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
          acceptedSamples,
        },
        performance: {
          stochasticProperties: stochasticProperties.length,
          workObjectReused: true,
          typedResultBuffer: true,
        },
      },
    } satisfies MonteCarloResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    } satisfies MonteCarloResponse);
  }
};
