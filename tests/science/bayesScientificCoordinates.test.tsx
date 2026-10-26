// @vitest-environment node
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { describe, expect, it, vi } from 'vitest';
import { BayesChart } from '@/components/charts/BayesChart';
import type { ScientificEChartProps } from '@/components/charts/ScientificEChart';

const state = vi.hoisted(() => ({ figure: null as ScientificEChartProps | null }));
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('@/components/charts/ScientificEChart', () => ({
  ScientificEChart: (props: ScientificEChartProps) => { state.figure = props; return null; },
}));

interface SeriesData {
  count(): number;
  mapDimension(coord: string): string;
  get(dimension: string, index: number): number;
  getCalculationInfo(name: string): string | undefined;
  getItemLayout(index: number): number[];
}
interface SeriesModel {
  id: string;
  getData(): SeriesData;
  getDataParams(index: number): unknown;
}
interface ChartModel { getSeries(): SeriesModel[] }
type History = React.ComponentProps<typeof BayesChart>['historical'];

function withRealChart(historical: History, assertion: (chart: echarts.ECharts, option: EChartsOption, series: (id: string) => SeriesModel) => void) {
  state.figure = null;
  renderToStaticMarkup(<BayesChart historical={historical}
    suggestions={[{ params: { x: 1 }, mean: 9, std: 0.5, ei: 0.1 }]}
    targetName="signed response" maximize theme="light" />);
  const option = (state.figure as ScientificEChartProps | null)?.option;
  expect(option).toBeTruthy();
  const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 1200, height: 700 });
  try {
    chart.setOption({ ...option!, animation: false });
    const model = (chart as unknown as { getModel(): ChartModel }).getModel();
    const series = (id: string) => {
      const found = model.getSeries().find(entry => entry.id === id);
      expect(found, id).toBeDefined();
      return found!;
    };
    assertion(chart, option!, series);
  } finally {
    chart.dispose();
  }
}

describe('Bayesian figure coordinates and model uncertainty', () => {
  it('aligns the actual ECharts ordinal positions and keeps the candidate in the plot', () => {
    const history = [
      { index: 7, y: -3, y_pred: -3, y_std: 1 },
      { index: 21, y: 2, y_pred: 2, y_std: 0.5 },
      { index: 99, y: 8, y_pred: 8, y_std: 1 },
    ];
    withRealChart(history, (_chart, _option, series) => {
      for (const id of ['bayes-observed', 'bayes-mean', 'bayes-lower', 'bayes-band']) {
        const data = series(id).getData();
        expect(Array.from({ length: data.count() }, (_, index) => data.get(data.mapDimension('x'), index))).toEqual([0, 1, 2]);
      }
      const candidate = series('bayes-candidate').getData();
      expect(candidate.get(candidate.mapDimension('x'), 0)).toBe(3);
      expect(candidate.get(candidate.mapDimension('y'), 0)).toBe(9);
      const [pixelX, pixelY] = candidate.getItemLayout(0);
      expect(pixelX).toBeGreaterThan(0);
      expect(pixelX).toBeLessThan(1200);
      expect(pixelY).toBeGreaterThan(0);
      expect(pixelY).toBeLessThan(700);
    });
  });

  it.each([
    { name: 'positive', mean: 3, sigma: 1, expectedLower: 1, expectedUpper: 5 },
    { name: 'negative', mean: -3, sigma: 1, expectedLower: -5, expectedUpper: -1 },
    { name: 'cross-zero', mean: 0, sigma: 1, expectedLower: -2, expectedUpper: 2 },
    { name: 'zero-sigma-negative', mean: -2, sigma: 0, expectedLower: -2, expectedUpper: -2 },
  ])('draws both correct two-sigma bounds for $name responses', ({ mean, sigma, expectedLower, expectedUpper }) => {
    withRealChart([{ index: 1, y: mean, y_pred: mean, y_std: sigma }], (_chart, _option, series) => {
      const lower = series('bayes-lower').getData();
      const band = series('bayes-band').getData();
      expect(lower.get(lower.mapDimension('y'), 0)).toBe(expectedLower);
      const stacked = band.getCalculationInfo('stackResultDimension');
      expect(stacked).toBeTruthy();
      expect(band.get(stacked!, 0)).toBe(expectedUpper);
    });
  });

  it('uses the candidate series identity instead of its within-series data index in tooltips', () => {
    withRealChart([{ index: 1, y: -3, y_pred: -3, y_std: 1 }], (_chart, option, series) => {
      const formatter = (option.tooltip as { formatter: (params: unknown) => string }).formatter;
      // Real ECharts candidate dataIndex is 0, just like the first historical row.
      const candidate = formatter([series('bayes-candidate').getDataParams(0)]);
      expect(candidate).toContain('bayesChartTooltipBest');
      expect(candidate).toMatch(/bayesChartTooltipMean: 9(?:\.|<br|$)/);
      expect(candidate).not.toContain('bayesChartTooltipFeedback');
      const historical = formatter([series('bayes-observed').getDataParams(0)]);
      expect(historical).toContain('bayesChartTooltipFeedback');
      expect(historical).toMatch(/signed response: -3(?:\.|<br|$)/);
      expect(historical).not.toContain('bayesChartTooltipBest');
    });
  });
});
