import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import {
  createSeededRandom,
  deriveRandomSeed,
  sampleNormalWithinBounds,
  type NumericBounds,
  type RandomSeed,
  SEEDED_RANDOM_ALGORITHM,
  SEEDED_RANDOM_ALGORITHM_VERSION,
} from '@/compute/random';
import type { FormulaConfig, Product } from '@/types/index';
import { formulaEngine } from '@/lib/formulaParser';

const SENSITIVITY_MODEL_VERSION = 'saltelli-jansen-normal-dimension-stable-4.0.0';
const MAX_BASE_SAMPLE_SIZE = 250_000;

export interface SobolMessage {
  type: 'RUN_SOBOL';
  payload: {
    targetFormulaId: string;
    formulas: FormulaConfig[];
    product: Product;
    variances: Record<string, number>;
    iterations?: number;
    seed?: RandomSeed;
    bounds?: Record<string, NumericBounds>;
  };
}

export interface SobolAnalysisMetadata {
  method: 'variance-based-sobol-indices';
  estimator: 'jansen-1999';
  samplingDesign: 'saltelli-a-b-independent-pseudorandom-normal';
  usesLowDiscrepancySobolSequence: false;
  inputDistribution: 'independent-normal';
  boundaryPolicy: 'unbounded-normal' | 'truncated-normal-rejection';
  interactionInterpretation: 'aggregate-total-minus-first-order-not-pairwise';
  modelVersion: typeof SENSITIVITY_MODEL_VERSION;
  seed: string;
  seedSource: 'user' | 'derived';
  randomAlgorithm: typeof SEEDED_RANDOM_ALGORITHM;
  randomAlgorithmVersion: typeof SEEDED_RANDOM_ALGORITHM_VERSION;
  baseSampleSize: number;
  dimensions: number;
  modelEvaluations: number;
  boundedVariables: number;
}

export interface SobolPerformanceMetadata {
  matrixStorage: 'flat-float64';
  workObjectReused: true;
  numericPropertyDictionaryReused: true;
  formulaResultObjectReused: true;
  hybridOutputStreaming: true;
  allocatedMatrixValues: number;
}

export interface SobolResponse {
  type: 'SOBOL_COMPLETE' | 'ERROR';
  payload?: {
    firstOrder: { name: string; value: number }[];
    totalEffect: { name: string; value: number }[];
    interactions: { name: string; value: number }[];
    analysis: SobolAnalysisMetadata;
    performance: SobolPerformanceMetadata;
  };
  error?: string;
}

function validateBaseSampleSize(value: number): number {
  if (!Number.isInteger(value) || value < 2 || value > MAX_BASE_SAMPLE_SIZE) {
    throw new RangeError(`Sensitivity base sample size must be an integer between 2 and ${MAX_BASE_SAMPLE_SIZE}`);
  }
  return value;
}

function validateVariancePercent(value: number, key: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Variance for ${key} must be a non-negative finite percentage`);
  }
  return value;
}

self.onmessage = (event: MessageEvent<SobolMessage>) => {
  try {
    const {
      targetFormulaId,
      formulas,
      product,
      variances,
      iterations: requestedIterations = 2000,
      seed,
      bounds,
    } = event.data.payload;
    const baseSampleSize = validateBaseSampleSize(requestedIterations);
    for (const [key, variance] of Object.entries(variances)) {
      validateVariancePercent(variance, key);
    }
    const actualSeed = seed ?? deriveRandomSeed('saltelli-jansen-normal-v4', {
      targetFormulaId,
      formulas,
      product,
      variances,
      bounds,
      baseSampleSize,
    });
    const random = createSeededRandom(actualSeed);
    const evaluator = formulaEngine.compileSampledPropertyGraph(formulas, product);
    const baseProperties = formulaEngine.createPropertyDictionary(product);
    const workingProperties = { ...baseProperties };
    const formulaResults: Record<string, number> = {};
    const collidingFormulaNames = formulas
      .map((formula) => formula.name)
      .filter((name) => Object.hasOwn(baseProperties, name));
    const inputKeys: string[] = [];
    const inputMeans: number[] = [];
    const inputStandardDeviations: number[] = [];
    const inputBounds: (NumericBounds | undefined)[] = [];

    for (const [key, numericValue] of Object.entries(baseProperties)) {
      const variancePercent = variances[key];
      if (Number.isFinite(numericValue) && variancePercent !== undefined && variancePercent > 0) {
        const standardDeviation = Math.abs(numericValue) * (variancePercent / 100);
        if (!Number.isFinite(standardDeviation) || (numericValue !== 0 && standardDeviation === 0)) {
          throw new RangeError(`Input standard deviation is not representable for ${key}`);
        }
        inputKeys.push(key);
        inputMeans.push(numericValue);
        inputStandardDeviations.push(standardDeviation);
        inputBounds.push(bounds?.[key]);
      }
    }
    const dimensions = inputKeys.length;
    if (dimensions === 0) {
      throw new Error('No finite input variables with variance greater than zero were provided for sensitivity analysis.');
    }
    const boundedVariables = inputBounds.filter((value) => value !== undefined).length;
    const progressInterval = Math.max(1, Math.floor(baseSampleSize / 20));
    const matrixLength = baseSampleSize * dimensions;
    const matrixA = new Float64Array(matrixLength);
    const matrixB = new Float64Array(matrixLength);

    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'sampling' }));
    for (let sample = 0; sample < baseSampleSize; sample++) {
      const offset = sample * dimensions;
      for (let dimension = 0; dimension < dimensions; dimension++) {
        matrixA[offset + dimension] = sampleNormalWithinBounds(
          random,
          inputMeans[dimension],
          inputStandardDeviations[dimension],
          inputBounds[dimension],
        );
        matrixB[offset + dimension] = sampleNormalWithinBounds(
          random,
          inputMeans[dimension],
          inputStandardDeviations[dimension],
          inputBounds[dimension],
        );
      }
      const completed = sample + 1;
      if (completed % progressInterval === 0 || completed === baseSampleSize) {
        self.postMessage(createWorkerProgressMessage({
          ratio: (completed / baseSampleSize) * 0.15,
          completed,
          total: baseSampleSize,
          phase: 'sampling',
        }));
      }
    }

    const evaluate = (
      primary: Float64Array,
      sample: number,
      secondary?: Float64Array,
      swappedDimension = -1,
    ): number => {
      for (const name of collidingFormulaNames) workingProperties[name] = baseProperties[name];
      const offset = sample * dimensions;
      for (let dimension = 0; dimension < dimensions; dimension++) {
        workingProperties[inputKeys[dimension]] = (
          secondary && dimension === swappedDimension
            ? secondary[offset + dimension]
            : primary[offset + dimension]
        );
      }
      const result = evaluator(workingProperties, formulaResults)[targetFormulaId];
      if (!Number.isFinite(result)) {
        throw new Error(`Sensitivity model produced a non-finite value for formula ${targetFormulaId}`);
      }
      return result;
    };

    const outputA = new Float64Array(baseSampleSize);
    const outputB = new Float64Array(baseSampleSize);
    for (let sample = 0; sample < baseSampleSize; sample++) {
      outputA[sample] = evaluate(matrixA, sample);
      outputB[sample] = evaluate(matrixB, sample);
      const completed = sample + 1;
      if (completed % progressInterval === 0 || completed === baseSampleSize) {
        self.postMessage(createWorkerProgressMessage({
          ratio: 0.15 + (completed / baseSampleSize) * 0.3,
          completed,
          total: baseSampleSize,
          phase: 'base-evaluation',
        }));
      }
    }

    // Jansen indices are invariant to a common affine transformation of all
    // outputs. Center before scaling to retain small changes on a large offset.
    // Opposite-sign extremes can overflow the subtraction itself; in that case
    // divide first using one common finite scale. Reuse the existing buffers.
    const anchor = outputA[0];
    let differenceScale = 0;
    let absoluteScale = 0;
    let subtractionOverflowed = false;
    for (const buffer of [outputA, outputB]) {
      for (const value of buffer) {
        absoluteScale = Math.max(absoluteScale, Math.abs(value));
        const difference = value - anchor;
        if (Number.isFinite(difference)) differenceScale = Math.max(differenceScale, Math.abs(difference));
        else subtractionOverflowed = true;
      }
    }
    const scale = subtractionOverflowed ? absoluteScale : differenceScale;
    if (scale === 0) {
      throw new Error('Output variance is numerically zero; sensitivity indices cannot be estimated.');
    }
    const normalizeOutput = (value: number): number => {
      const difference = value - anchor;
      const normalized = Number.isFinite(difference)
        ? difference / scale : value / scale - anchor / scale;
      if (!Number.isFinite(normalized) || (difference !== 0 && normalized === 0)) {
        throw new RangeError('Sensitivity output normalization is not representable.');
      }
      return normalized;
    };
    let sum = 0;
    let sumCorrection = 0;
    for (const buffer of [outputA, outputB]) {
      for (let sample = 0; sample < baseSampleSize; sample++) {
        const value = normalizeOutput(buffer[sample]);
        buffer[sample] = value;
        const next = sum + value;
        sumCorrection += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum;
        sum = next;
      }
    }
    const mean = (sum + sumCorrection) / (2 * baseSampleSize);
    let sumSquares = 0;
    let squareCorrection = 0;
    for (const buffer of [outputA, outputB]) {
      for (const value of buffer) {
        const term = (value - mean) ** 2;
        const next = sumSquares + term;
        squareCorrection += Math.abs(sumSquares) >= term ? (sumSquares - next) + term : (term - next) + sumSquares;
        sumSquares = next;
      }
    }
    const outputVariance = (sumSquares + squareCorrection) / (2 * baseSampleSize);
    if (!Number.isFinite(outputVariance) || outputVariance <= 0) {
      throw new Error('Output variance is numerically zero; sensitivity indices cannot be estimated.');
    }

    const firstOrder: { name: string; value: number }[] = [];
    const totalEffect: { name: string; value: number }[] = [];
    const interactions: { name: string; value: number }[] = [];
    for (let dimension = 0; dimension < dimensions; dimension++) {
      let totalContribution = 0;
      let firstContributionComplement = 0;
      for (let sample = 0; sample < baseSampleSize; sample++) {
        const outputHybrid = normalizeOutput(evaluate(matrixA, sample, matrixB, dimension));
        totalContribution += (outputA[sample] - outputHybrid) ** 2;
        firstContributionComplement += (outputB[sample] - outputHybrid) ** 2;
      }
      if (!Number.isFinite(totalContribution) || !Number.isFinite(firstContributionComplement)) {
        throw new RangeError('Sensitivity variance contributions are not representable.');
      }
      const totalIndex = Math.max(0, totalContribution / (2 * baseSampleSize * outputVariance));
      let firstIndex = Math.max(0, 1 - firstContributionComplement / (2 * baseSampleSize * outputVariance));
      if (!Number.isFinite(totalIndex) || !Number.isFinite(firstIndex)) {
        throw new RangeError('Sensitivity indices are not representable.');
      }
      if (firstIndex > totalIndex) firstIndex = totalIndex;
      firstOrder.push({ name: inputKeys[dimension], value: firstIndex });
      totalEffect.push({ name: inputKeys[dimension], value: totalIndex });
      interactions.push({ name: inputKeys[dimension], value: totalIndex - firstIndex });
      self.postMessage(createWorkerProgressMessage({
        ratio: 0.45 + ((dimension + 1) / dimensions) * 0.5,
        completed: dimension + 1,
        total: dimensions,
        phase: 'sensitivity-estimation',
      }));
    }

    const order = Array.from({ length: dimensions }, (_, index) => index)
      .sort((left, right) => totalEffect[right].value - totalEffect[left].value);
    self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));
    self.postMessage({
      type: 'SOBOL_COMPLETE',
      payload: {
        firstOrder: order.map((index) => firstOrder[index]),
        totalEffect: order.map((index) => totalEffect[index]),
        interactions: order.map((index) => interactions[index]),
        analysis: {
          method: 'variance-based-sobol-indices',
          estimator: 'jansen-1999',
          samplingDesign: 'saltelli-a-b-independent-pseudorandom-normal',
          usesLowDiscrepancySobolSequence: false,
          inputDistribution: 'independent-normal',
          boundaryPolicy: boundedVariables > 0 ? 'truncated-normal-rejection' : 'unbounded-normal',
          interactionInterpretation: 'aggregate-total-minus-first-order-not-pairwise',
          modelVersion: SENSITIVITY_MODEL_VERSION,
          seed: random.seed,
          seedSource: seed === undefined ? 'derived' : 'user',
          randomAlgorithm: random.algorithm,
          randomAlgorithmVersion: random.algorithmVersion,
          baseSampleSize,
          dimensions,
          modelEvaluations: baseSampleSize * (dimensions + 2),
          boundedVariables,
        },
        performance: {
          matrixStorage: 'flat-float64',
          workObjectReused: true,
          numericPropertyDictionaryReused: true,
          formulaResultObjectReused: true,
          hybridOutputStreaming: true,
          allocatedMatrixValues: matrixA.length + matrixB.length + outputA.length + outputB.length,
        },
      },
    } satisfies SobolResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    } satisfies SobolResponse);
  }
};
