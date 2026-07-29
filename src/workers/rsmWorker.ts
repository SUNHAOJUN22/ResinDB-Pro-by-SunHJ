import { solveLeastSquares, type LeastSquaresDiagnostics } from '@/compute/leastSquares';

const RSM_MODEL_VERSION = 'quadratic-rsm-qr-svd-1.0.0';

export interface RSMMessage {
  type: 'CALCULATE_RSM';
  payload: {
    data: {x1: number, x2: number, y: number}[];
  };
}

export interface RSMResponse {
  type: 'RSM_CALCULATED' | 'ERROR';
  payload?: {
    beta: number[];
    stationaryPoint: {x1: number, x2: number, y: number} | null;
    grid: {x1: number, x2: number, y: number}[][];
    minX1: number;
    maxX1: number;
    minX2: number;
    maxX2: number;
    modelVersion: typeof RSM_MODEL_VERSION;
    diagnostics: LeastSquaresDiagnostics;
  };
  error?: string;
}

self.onmessage = (event: MessageEvent<RSMMessage>) => {
  try {
    const { data } = event.data.payload;
    const validData = (data || []).filter((point) => (
      point
      && Number.isFinite(point.x1)
      && Number.isFinite(point.x2)
      && Number.isFinite(point.y)
    ));
    if (validData.length < 6) {
      throw new Error('RSM requires at least 6 valid data points to fit a quadratic surface.');
    }

    const design: number[][] = [];
    const target: number[] = [];
    let minX1 = Infinity;
    let maxX1 = -Infinity;
    let minX2 = Infinity;
    let maxX2 = -Infinity;

    for (const point of validData) {
      design.push([1, point.x1, point.x2, point.x1 ** 2, point.x2 ** 2, point.x1 * point.x2]);
      target.push(point.y);
      minX1 = Math.min(minX1, point.x1);
      maxX1 = Math.max(maxX1, point.x1);
      minX2 = Math.min(minX2, point.x2);
      maxX2 = Math.max(maxX2, point.x2);
    }

    const rangeX1 = maxX1 - minX1;
    const rangeX2 = maxX2 - minX2;
    if (rangeX1 === 0 || rangeX2 === 0) {
      throw new Error('Independent variables must have variation.');
    }

    const fit = solveLeastSquares(design, target);
    const beta = fit.solution;
    const [b0, b1, b2, b11, b22, b12] = beta;
    const determinant = 4 * b11 * b22 - b12 ** 2;
    const stationaryTolerance = Number.EPSILON * Math.max(1, Math.abs(4 * b11 * b22), b12 ** 2) * 64;
    let stationaryPoint: {x1: number, x2: number, y: number} | null = null;
    if (Math.abs(determinant) > stationaryTolerance) {
      const x1 = (-2 * b1 * b22 + b2 * b12) / determinant;
      const x2 = (-2 * b2 * b11 + b1 * b12) / determinant;
      const y = b0 + b1 * x1 + b2 * x2 + b11 * x1 ** 2 + b22 * x2 ** 2 + b12 * x1 * x2;
      if (Number.isFinite(x1) && Number.isFinite(x2) && Number.isFinite(y)) {
        stationaryPoint = { x1, x2, y };
      }
    }

    const gridSize = 30;
    const grid: {x1: number, x2: number, y: number}[][] = [];
    const gridMinX1 = minX1 - rangeX1 * 0.2;
    const gridMaxX1 = maxX1 + rangeX1 * 0.2;
    const gridMinX2 = minX2 - rangeX2 * 0.2;
    const gridMaxX2 = maxX2 + rangeX2 * 0.2;

    for (let rowIndex = 0; rowIndex < gridSize; rowIndex++) {
      const row: {x1: number, x2: number, y: number}[] = [];
      const x2 = gridMinX2 + (rowIndex / (gridSize - 1)) * (gridMaxX2 - gridMinX2);
      for (let columnIndex = 0; columnIndex < gridSize; columnIndex++) {
        const x1 = gridMinX1 + (columnIndex / (gridSize - 1)) * (gridMaxX1 - gridMinX1);
        const y = b0 + b1 * x1 + b2 * x2 + b11 * x1 ** 2 + b22 * x2 ** 2 + b12 * x1 * x2;
        row.push({ x1, x2, y });
      }
      grid.push(row);
    }

    self.postMessage({
      type: 'RSM_CALCULATED',
      payload: {
        beta,
        stationaryPoint,
        grid,
        minX1: gridMinX1,
        maxX1: gridMaxX1,
        minX2: gridMinX2,
        maxX2: gridMaxX2,
        modelVersion: RSM_MODEL_VERSION,
        diagnostics: fit.diagnostics,
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
