export interface WeibullPoint { value: number; x: number; y: number; p: number }
export interface WeibullFigureData {
  observations: [number, number, number, number][];
  fitted: [number, number][];
  b5Log: number;
}

/** Invalid input is not an empty successful fit and must not reach ECharts. */
export function weibullFigureData(
  points: readonly WeibullPoint[], m: number, eta: number, rSquared: number, b5: number,
): WeibullFigureData | null {
  if (points.length < 3 || ![m, eta, rSquared, b5].every(Number.isFinite) || m <= 0 || eta <= 0 || b5 <= 0) return null;
  let low = Infinity;
  let high = -Infinity;
  const observations: [number, number, number, number][] = [];
  for (const point of points) {
    if (![point.value, point.x, point.y, point.p].every(Number.isFinite)
        || point.value <= 0 || point.p <= 0 || point.p >= 1) return null;
    low = Math.min(low, point.x);
    high = Math.max(high, point.x);
    observations.push([point.x, point.y, point.value, point.p]);
  }
  if (low === high) return null;
  const fitted: [number, number][] = [[low, m * (low - Math.log(eta))], [high, m * (high - Math.log(eta))]];
  if (!fitted.every((point) => point.every(Number.isFinite))) return null;
  return { observations, fitted, b5Log: Math.log(b5) };
}
