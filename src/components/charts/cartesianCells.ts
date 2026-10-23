import type { CustomSeriesOption } from 'echarts/charts';

export interface CartesianScalarPoint { x: number; y: number; z: number }
export type CartesianScalarCell = [number, number, number, number, number, number, number];

function coordinateBounds(values: readonly number[]): Map<number, [number, number]> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const bounds = new Map<number, [number, number]>();
  // A single coordinate cannot establish a cell width in physical units.
  if (sorted.length < 2) return bounds;
  for (let index = 0; index < sorted.length; index++) {
    const center = sorted[index];
    const lower = index === 0 ? center - (sorted[1] - center) / 2 : sorted[index - 1] / 2 + center / 2;
    const upper = index === sorted.length - 1 ? center + (center - sorted[index - 1]) / 2 : center / 2 + sorted[index + 1] / 2;
    if (Number.isFinite(lower) && Number.isFinite(upper) && upper > lower) bounds.set(center, [lower, upper]);
  }
  return bounds;
}

/** Preserve physical coordinates and signed scalar values without interpolation. */
export function buildCartesianScalarCells(grid: readonly CartesianScalarPoint[]): CartesianScalarCell[] {
  const finite = grid.filter((point) => [point.x, point.y, point.z].every(Number.isFinite));
  const xBounds = coordinateBounds(finite.map((point) => point.x));
  const yBounds = coordinateBounds(finite.map((point) => point.y));
  return finite.flatMap((point): CartesianScalarCell[] => {
    const x = xBounds.get(point.x);
    const y = yBounds.get(point.y);
    return x && y ? [[point.x, point.y, point.z, x[0], x[1], y[0], y[1]]] : [];
  });
}

/** ECharts heatmap requires category axes; continuous surfaces use bounded cells. */
export function cartesianScalarSeries(name: string, cells: CartesianScalarCell[]): CustomSeriesOption {
  return {
    name, type: 'custom', coordinateSystem: 'cartesian2d', clip: true,
    dimensions: ['x', 'y', 'scalar', 'xLower', 'xUpper', 'yLower', 'yUpper'],
    encode: { x: [3, 4], y: [5, 6], tooltip: [0, 1, 2] }, data: cells,
    renderItem: (_params, api) => {
      const low = api.coord([api.value(3), api.value(5)]);
      const high = api.coord([api.value(4), api.value(6)]);
      if (![...low, ...high].every(Number.isFinite)) return null;
      return {
        type: 'rect',
        shape: { x: Math.min(low[0], high[0]), y: Math.min(low[1], high[1]), width: Math.abs(high[0] - low[0]), height: Math.abs(high[1] - low[1]) },
        style: { fill: api.visual('color') },
      };
    },
  };
}
