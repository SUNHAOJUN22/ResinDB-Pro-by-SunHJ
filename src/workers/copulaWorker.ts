import { inverseStandardNormal } from '@/compute/distributions';
import { createWorkerProgressMessage } from '@/compute/workerProtocol';

const COPULA_MODEL_VERSION = 'gaussian-copula-normal-scores-2.0.0';

export interface CopulaMessage {
  type: 'CALCULATE_COPULA';
  payload: {
    data: { x: number; y: number }[];
    gridSize?: number;
  };
}

export interface CopulaResponse {
  type: 'COPULA_RESULT' | 'ERROR';
  payload?: {
    rho: number;
    sortedX: number[];
    sortedY: number[];
    grid: { u: number; v: number; z: number }[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    modelVersion: typeof COPULA_MODEL_VERSION;
    method: 'gaussian-copula-normal-scores';
    pseudoObservation: '(averageRank-0.5)/n';
    observations: number;
  };
  error?: string;
}

function averageRanks(values: readonly number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length);
  let cursor = 0;
  while (cursor < indexed.length) {
    let end = cursor + 1;
    while (end < indexed.length && indexed[end].value === indexed[cursor].value) end += 1;
    const averageRank = ((cursor + 1) + end) / 2;
    for (let index = cursor; index < end; index++) ranks[indexed[index].index] = averageRank;
    cursor = end;
  }
  return ranks;
}

self.onmessage = (event: MessageEvent<CopulaMessage>) => {
  try {
    const { data, gridSize: requestedGridSize = 50 } = event.data.payload;
    if (!Number.isInteger(requestedGridSize) || requestedGridSize < 5 || requestedGridSize > 200) {
      throw new RangeError('Copula gridSize must be an integer between 5 and 200.');
    }
    const validData = (data ?? []).filter((row) => (
      row && Number.isFinite(row.x) && Number.isFinite(row.y)
    ));
    const observations = validData.length;
    if (observations < 5) throw new Error('At least five complete finite points are required.');

    const xValues = validData.map((row) => row.x);
    const yValues = validData.map((row) => row.y);
    const sortedX = [...xValues].sort((left, right) => left - right);
    const sortedY = [...yValues].sort((left, right) => left - right);
    const rankX = averageRanks(xValues);
    const rankY = averageRanks(yValues);
    const scoresX = new Float64Array(observations);
    const scoresY = new Float64Array(observations);
    let meanX = 0;
    let meanY = 0;
    for (let index = 0; index < observations; index++) {
      scoresX[index] = inverseStandardNormal((rankX[index] - 0.5) / observations);
      scoresY[index] = inverseStandardNormal((rankY[index] - 0.5) / observations);
      meanX += scoresX[index];
      meanY += scoresY[index];
    }
    meanX /= observations;
    meanY /= observations;
    let covariance = 0;
    let varianceX = 0;
    let varianceY = 0;
    for (let index = 0; index < observations; index++) {
      const centeredX = scoresX[index] - meanX;
      const centeredY = scoresY[index] - meanY;
      covariance += centeredX * centeredY;
      varianceX += centeredX * centeredX;
      varianceY += centeredY * centeredY;
    }
    const denominator = Math.sqrt(varianceX * varianceY);
    let rho = denominator > 0 ? covariance / denominator : 0;
    rho = Math.max(-0.999, Math.min(0.999, rho));

    const gridAxis = new Float64Array(requestedGridSize);
    const normalScores = new Float64Array(requestedGridSize);
    for (let index = 1; index < requestedGridSize; index++) {
      const probability = index / requestedGridSize;
      gridAxis[index] = probability;
      normalScores[index] = inverseStandardNormal(probability);
    }
    const axisPointCount = requestedGridSize - 1;
    const grid = new Array<{ u: number; v: number; z: number }>(axisPointCount * axisPointCount);
    const oneMinusRhoSquared = 1 - rho * rho;
    const inverseDensityScale = 1 / Math.sqrt(oneMinusRhoSquared);
    const inverseExponentDenominator = 1 / (2 * oneMinusRhoSquared);
    let gridIndex = 0;
    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'copula-density-grid' }));
    for (let row = 1; row < requestedGridSize; row++) {
      const u = gridAxis[row];
      const scoreU = normalScores[row];
      const scoreUSquared = scoreU * scoreU;
      for (let column = 1; column < requestedGridSize; column++) {
        const v = gridAxis[column];
        const scoreV = normalScores[column];
        const exponent = -(
          rho * rho * (scoreUSquared + scoreV * scoreV)
          - 2 * rho * scoreU * scoreV
        ) * inverseExponentDenominator;
        grid[gridIndex] = { u, v, z: Math.exp(exponent) * inverseDensityScale };
        gridIndex += 1;
      }
      self.postMessage(createWorkerProgressMessage({
        ratio: row / axisPointCount,
        completed: row,
        total: axisPointCount,
        phase: 'copula-density-grid',
      }));
    }

    self.postMessage({
      type: 'COPULA_RESULT',
      payload: {
        rho,
        sortedX,
        sortedY,
        grid,
        minX: sortedX[0],
        maxX: sortedX[observations - 1],
        minY: sortedY[0],
        maxY: sortedY[observations - 1],
        modelVersion: COPULA_MODEL_VERSION,
        method: 'gaussian-copula-normal-scores',
        pseudoObservation: '(averageRank-0.5)/n',
        observations,
      },
    } satisfies CopulaResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    } satisfies CopulaResponse);
  }
};
