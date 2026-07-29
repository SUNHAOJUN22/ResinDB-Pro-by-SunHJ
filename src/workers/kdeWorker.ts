import { createWorkerProgressMessage } from '@/compute/workerProtocol';

const KDE_MODEL_VERSION = 'bivariate-gaussian-kde-scott-2.0.0';

export interface KdeMessage {
  type: 'CALCULATE_KDE';
  payload: {
    points: {x: number; y: number}[];
    gridSize?: number;
  };
}

export interface KdeResponse {
  type: 'KDE_CALCULATED' | 'ERROR';
  payload?: {
    grid: {x: number; y: number; z: number}[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    modelVersion: typeof KDE_MODEL_VERSION;
    method: 'product-gaussian-bivariate-kde';
    bandwidth: { x: number; y: number; rule: 'scott-d2' };
    observations: number;
  };
  error?: string;
}

function sampleStandardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let squared = 0;
  for (const value of values) squared += (value - mean) ** 2;
  return Math.sqrt(squared / (values.length - 1));
}

self.onmessage = (event: MessageEvent<KdeMessage>) => {
  try {
    const { points, gridSize: requestedGridSize = 50 } = event.data.payload;
    if (!Number.isInteger(requestedGridSize) || requestedGridSize < 5 || requestedGridSize > 300) {
      throw new RangeError('KDE gridSize must be an integer between 5 and 300.');
    }
    const validPoints = (points ?? []).filter((point) => (
      point && Number.isFinite(point.x) && Number.isFinite(point.y)
    ));
    if (validPoints.length === 0) throw new Error('No complete finite points were provided for KDE.');

    const xValues = validPoints.map((point) => point.x);
    const yValues = validPoints.map((point) => point.y);
    let minX = xValues[0];
    let maxX = xValues[0];
    let minY = yValues[0];
    let maxY = yValues[0];
    for (let index = 1; index < validPoints.length; index++) {
      minX = Math.min(minX, xValues[index]);
      maxX = Math.max(maxX, xValues[index]);
      minY = Math.min(minY, yValues[index]);
      maxY = Math.max(maxY, yValues[index]);
    }
    const rangeX = maxX - minX || Math.max(Math.abs(minX), 1);
    const rangeY = maxY - minY || Math.max(Math.abs(minY), 1);
    const scottFactor = validPoints.length ** (-1 / 6);
    const bandwidthX = Math.max(sampleStandardDeviation(xValues) * scottFactor, rangeX * 1e-3);
    const bandwidthY = Math.max(sampleStandardDeviation(yValues) * scottFactor, rangeY * 1e-3);
    minX -= rangeX * 0.1;
    maxX += rangeX * 0.1;
    minY -= rangeY * 0.1;
    maxY += rangeY * 0.1;

    const inverseBandwidthX = 1 / bandwidthX;
    const inverseBandwidthY = 1 / bandwidthY;
    const normalization = 1 / (
      2 * Math.PI * validPoints.length * bandwidthX * bandwidthY
    );
    const grid: {x: number; y: number; z: number}[] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;
    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'density-grid' }));
    for (let row = 0; row < requestedGridSize; row++) {
      const y = minY + (row / (requestedGridSize - 1)) * (maxY - minY);
      for (let column = 0; column < requestedGridSize; column++) {
        const x = minX + (column / (requestedGridSize - 1)) * (maxX - minX);
        let kernelSum = 0;
        for (const point of validPoints) {
          const standardizedX = (point.x - x) * inverseBandwidthX;
          const standardizedY = (point.y - y) * inverseBandwidthY;
          kernelSum += Math.exp(-0.5 * (
            standardizedX * standardizedX + standardizedY * standardizedY
          ));
        }
        const z = kernelSum * normalization;
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
        grid.push({ x, y, z });
      }
      self.postMessage(createWorkerProgressMessage({
        ratio: (row + 1) / requestedGridSize,
        completed: row + 1,
        total: requestedGridSize,
        phase: 'density-grid',
      }));
    }

    self.postMessage({
      type: 'KDE_CALCULATED',
      payload: {
        grid,
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
        modelVersion: KDE_MODEL_VERSION,
        method: 'product-gaussian-bivariate-kde',
        bandwidth: { x: bandwidthX, y: bandwidthY, rule: 'scott-d2' },
        observations: validPoints.length,
      },
    } satisfies KdeResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    } satisfies KdeResponse);
  }
};
