import { describe, expect, it } from 'vitest';
import { weibullFigureData } from '@/components/charts/weibullFigure';
const points = [1, 2, 3].map((value, i) => ({ value, x: Math.log(value), y: i - 2, p: (i + 1) / 4 }));
describe('finite and identifiable Weibull plot contract', () => {
  it('preserves valid observations and the median-rank OLS model', () => {
    const data = weibullFigureData(points, 2, 3, 0.9, 0.5);
    expect(data?.observations).toHaveLength(3);
    expect(data?.fitted[1][1]).toBeCloseTo(0);
    expect(data?.b5Log).toBeCloseTo(Math.log(0.5));
  });
  it.each([NaN, Infinity, -Infinity, 0, -1])('rejects invalid positive model parameter %s', (value) => {
    expect(weibullFigureData(points, value, 3, 0.9, 0.5)).toBeNull();
    expect(weibullFigureData(points, 2, value, 0.9, 0.5)).toBeNull();
    expect(weibullFigureData(points, 2, 3, 0.9, value)).toBeNull();
  });
  it('rejects nonfinite observations, invalid probabilities, degenerate coordinates and overflow', () => {
    for (const changed of [{ x: NaN }, { y: Infinity }, { value: 0 }, { p: 1 }, { p: 0 }]) {
      expect(weibullFigureData([{ ...points[0], ...changed }, ...points.slice(1)], 2, 3, 0.9, 0.5)).toBeNull();
    }
    expect(weibullFigureData([points[0], points[0], points[0]], 2, 3, 0.9, 0.5)).toBeNull();
    expect(weibullFigureData(points, Number.MAX_VALUE, 1e-300, 0.9, 0.5)).toBeNull();
    expect(weibullFigureData(points, 2, 3, NaN, 0.5)).toBeNull();
    expect(weibullFigureData(points.slice(0, 2), 2, 3, 0.9, 0.5)).toBeNull();
  });
});
