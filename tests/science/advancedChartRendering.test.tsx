// @vitest-environment node
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { describe, expect, it, vi } from 'vitest';
import { CopulaChart } from '@/components/charts/CopulaChart';
import { RsmHeatmapChart } from '@/components/charts/RsmHeatmapChart';
import { SobolChart } from '@/components/charts/SobolChart';
import { MahalanobisChart } from '@/components/charts/MahalanobisChart';
import { SimilarityGraph } from '@/components/charts/SimilarityGraph';
import { WlfTtsChart } from '@/components/charts/WlfTtsChart';
import { MooChart } from '@/components/charts/MooChart';
import { PronyChart } from '@/components/charts/PronyChart';
import { SpcChart } from '@/components/charts/SpcChart';
import { FeatureImportanceChart } from '@/components/charts/FeatureImportanceChart';
import { ArrheniusChart } from '@/components/charts/ArrheniusChart';
import { KineticsChart } from '@/components/charts/KineticsChart';
import { BayesChart } from '@/components/charts/BayesChart';
import { DegradationSimulator } from '@/components/charts/DegradationSimulator';
import { propertyMap, translations } from '@/config/i18n';
import { buildCartesianScalarCells } from '@/components/charts/cartesianCells';
import type { ScientificEChartProps } from '@/components/charts/ScientificEChart';

// Only the browser host and locale context are isolated here. The actual chart
// components build their options, then the real ECharts SVG engine renders them.
// These checks do not claim to test browser Canvas pixels or installed fonts.
const state = vi.hoisted(() => ({ language: 'zh' as 'zh' | 'en', figure: null as ScientificEChartProps | null }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: state.language, t: (key: string) => translations[state.language][key as keyof typeof translations.en], tProp: (key: string) => state.language === 'en' ? propertyMap[key] ?? key : key }) }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@/components/charts/ScientificEChart', () => ({
  ScientificEChart: (props: ScientificEChartProps) => { state.figure = props; return null; },
}));

const copulaGrid = [0.2, 0.5, 0.8].flatMap((u) => [0.1, 0.4, 0.9].map((v) => ({ u, v, z: 1 + u * v })));
const rsmGrid = [10, 20, 30].map((x1) => [2, 4, 8].map((x2) => ({ x1, x2, y: x1 - x2 * 5 })));
const cases = [
  { key: 'copula', zh: '概率空间中的高斯 Copula 密度', en: 'Gaussian-copula density in probability space', element: <CopulaChart grid={copulaGrid} theme="light" /> },
  { key: 'rsm', zh: '二次响应面模型', en: 'Quadratic response-surface model', element: <RsmHeatmapChart grid={rsmGrid} stationaryPoint={{ x1: 20, x2: 4, y: 0 }} dataPoints={[{ x1: 15, x2: 3, y: 1 }]} minX1={10} maxX1={30} minX2={2} maxX2={8} x1Label="Temperature" x2Label="Load" yLabel="Response" theme="light" /> },
  { key: 'sobol', zh: 'Jansen 方差敏感性指数', en: 'Jansen variance-based sensitivity indices', element: <SobolChart firstOrder={[{ name: 'x', value: 0.3 }]} totalEffect={[{ name: 'x', value: 0.8 }]} interactions={[{ name: 'x', value: 0.5 }]} theme="light" /> },
  { key: 'mahalanobis', zh: '正则化马氏距离筛查', en: 'Regularized Mahalanobis distance screening', element: <MahalanobisChart distances={[{ index: 1, id: 'a', name: 'Material A', distance: 2, isOutlier: false }]} threshold={4} theme="light" /> },
  { key: 'similarity', zh: '按共有特征覆盖率调整的相似性网络', en: 'Overlap-adjusted similarity network', element: <SimilarityGraph nodes={[{ id: 'a', name: 'Material A', category: 'Source category', value: 2 }]} edges={[]} theme="light" /> },
  { key: 'wlf', zh: 'WLF 时温叠加', en: 'WLF time–temperature superposition', element: <WlfTtsChart c1={10} c2={100} refTemp={20} shiftFactors={[{ temp: 20, aT: 1 }]} masterCurve={[{ temp: 20, points: [{ rate: 1, visc: 10, originalRate: 1, originalVisc: 10 }, { rate: 2, visc: 8, originalRate: 2, originalVisc: 8 }] }]} theme="light" /> },
  { key: 'moo', zh: '双目标 Pareto 探索', en: 'Two-objective Pareto exploration', element: <MooChart evaluatedCandidates={[{ params: { p: 1 }, means: { x: 2, y: 3 } }]} paretoFront={[{ params: { p: 1 }, means: { x: 2, y: 3 }, stds: { x: 1, y: 1 } }]} historical={[{ x: 1, y: 4 }]} targets={[{ name: 'x', maximize: true }, { name: 'y', maximize: false }]} theme="light" /> },
  { key: 'prony', zh: 'Prony 级数黏弹性拟合', en: 'Prony-series viscoelastic fit', element: <PronyChart points={[{ omega: 1, storage: 2, loss: 1, storage_fit: 2.1, loss_fit: 0.9 }, { omega: 2, storage: 3, loss: 1.2, storage_fit: 2.9, loss_fit: 1.3 }]} theme="light" /> },
  { key: 'spc', zh: '过程分布与参考界限', en: 'Process distribution and reference limits', element: <SpcChart histogram={[{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 2 }]} histogramBins={[1, 2, 3]} normalCurve={[{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 2 }]} mean={2} sigma={0.5} lsl={0} usl={4} theme="light" /> },
  { key: 'ridge', zh: '标准化岭回归敏感性归因', en: 'Standardized ridge sensitivity attribution', element: <FeatureImportanceChart importances={[{ feature: 'Temperature', importance: 0.6, positive: true }, { feature: 'Load', importance: 0.4, positive: false }]} theme="light" /> },
  { key: 'arrhenius', zh: 'Arrhenius 寿命线性化', en: 'Arrhenius lifetime linearization', element: <ArrheniusChart points={[{ tempC: 20, time: 100, x: 1 / 293.15, y: Math.log(100) }, { tempC: 40, time: 50, x: 1 / 313.15, y: Math.log(50) }]} equation={{ m: 2000, b: -2 }} rSquared={0.99} theme="light" /> },
  { key: 'kinetics', zh: 'Kissinger 线性化', en: 'Kissinger linearization', element: <KineticsChart points={[{ x: 0.002, y: -3 }, { x: 0.003, y: -2 }, { x: 0.004, y: -1 }]} line={[{ x: 0.002, y: -3 }, { x: 0.004, y: -1 }]} isoCurve={[{ time: 0, alpha: 0 }, { time: 1, alpha: 50 }]} isoTemp={100} theme="light" /> },
  { key: 'bayes', zh: '高斯过程近似面与逆向探索', en: 'Gaussian Process Metamodel', element: <BayesChart historical={[{ index: 1, y: 2, y_pred: 2.1, y_std: 0.1 }]} suggestions={[{ params: { x: 1 }, mean: 3, std: 0.3, ei: 0.1 }]} targetName="Strength" maximize theme="light" /> },
  { key: 'degradation', zh: '基于规则的拉伸强度保持情景', en: 'Rule-based tensile-strength retention scenario', element: <DegradationSimulator product={{ id: 'a', gradeName: 'A', manufacturer: 'M', manufacturerId: 'm', categoryIds: [], createdAt: '', updatedAt: '', properties: { 'Tensile Strength': { value: 50, unit: 'MPa' } } }} /> },
];

describe.each(['zh', 'en'] as const)('real advanced figure rendering in %s', (language) => {
  it.each(cases)('$key preserves numeric coordinates and renders a localized figure', ({ key, element, zh, en }) => {
    state.language = language;
    state.figure = null;
    renderToStaticMarkup(element);
    const figure = state.figure as ScientificEChartProps | null;
    expect(figure?.option).toBeTruthy();
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 1200, height: 700 });
    try {
      chart.setOption({ ...figure!.option, animation: false } as EChartsOption);
      const svg = chart.renderToSVGString();
      expect(svg).toContain(language === 'zh' ? zh : en);
      expect(svg).not.toMatch(/(?:NaN|Infinity)/);
      expect(svg).toMatch(/<(?:path|rect|circle)\b/);
      if (key === 'ridge') expect(svg).toContain(language === 'zh' ? '不表示因果或 SHAP' : 'not causality or SHAP');
      if (language === 'zh') {
        expect(figure!.ariaLabel).toMatch(/\p{Script=Han}/u);
        expect(figure!.description).toMatch(/\p{Script=Han}/u);
      } else {
        expect(figure!.ariaLabel).not.toMatch(/\p{Script=Han}/u);
        expect(figure!.description).not.toMatch(/\p{Script=Han}/u);
      }
    } finally {
      chart.dispose();
    }
  });
});

function captureFigure(element: React.ReactElement, language: 'zh' | 'en') {
  state.language = language;
  state.figure = null;
  renderToStaticMarkup(element);
  return state.figure as unknown as ScientificEChartProps;
}

describe('continuous model surfaces and their tooltips', () => {
  it('preserves nonuniform physical cells and negative responses without changing observations', () => {
    const cells = buildCartesianScalarCells(rsmGrid.flat().map((point) => ({ x: point.x1, y: point.x2, z: point.y })));
    expect(cells[0]).toEqual([10, 2, 0, 5, 15, 1, 3]);
    expect(cells[2]).toEqual([10, 8, -30, 5, 15, 6, 10]);
    expect(cells.map((cell) => cell[2])).toEqual(rsmGrid.flat().map((point) => point.y));
    expect(buildCartesianScalarCells([{ x: 1, y: 1, z: 2 }])).toEqual([]);
    const figure = captureFigure(cases.find((item) => item.key === 'rsm')!.element, 'zh');
    const series = figure.option!.series as Array<{ type: string; data: number[][] }>;
    expect(series[0].type).toBe('custom');
    expect(series[1].data).toEqual([[15, 3, 1]]);
    expect(series[2].data).toEqual([[20, 4, 0]]);
    expect(figure.option!.xAxis).toMatchObject({ type: 'value', min: 10, max: 30 });
    expect(figure.option!.yAxis).toMatchObject({ type: 'value', min: 2, max: 8 });
    expect(figure.option!.visualMap).toMatchObject({ min: -30, max: 20, dimension: 2, seriesIndex: 0 });
  });

  it.each(['zh', 'en'] as const)('escapes labels in the RSM tooltip and localizes every layer (%s)', (language) => {
    const maliciousLabel = '<img src=x onerror=alert(1)>';
    const figure = captureFigure(<RsmHeatmapChart grid={rsmGrid} stationaryPoint={{ x1: 20, x2: 4, y: 0 }} dataPoints={[{ x1: 15, x2: 3, y: 1 }]} minX1={10} maxX1={30} minX2={2} maxX2={8} x1Label={maliciousLabel} x2Label="Y" yLabel={maliciousLabel} theme="light" />, language);
    const series = figure.option!.series as Array<{ name: string; tooltip: { formatter: (params: unknown) => string } }>;
    for (const layer of series) {
      const tooltip = layer.tooltip.formatter({ data: [15, 3, 1] });
      expect(tooltip).toContain('&lt;img');
      expect(tooltip).not.toContain('<img');
      if (language === 'zh') {
        expect(layer.name).toMatch(/\p{Script=Han}/u);
        expect(tooltip).toMatch(/\p{Script=Han}/u);
      } else {
        expect(layer.name).not.toMatch(/\p{Script=Han}/u);
        expect(tooltip).not.toMatch(/\p{Script=Han}/u);
      }
    }
  });

  it.each(['zh', 'en'] as const)('localizes custom tooltip labels and legend entries (%s)', (language) => {
    for (const key of ['copula', 'sobol', 'mahalanobis', 'similarity', 'wlf', 'moo', 'ridge', 'arrhenius']) {
      const figure = captureFigure(cases.find((item) => item.key === key)!.element, language);
      const tooltip = figure.option!.tooltip as { formatter: (params: unknown) => string };
      const params = key === 'sobol' || key === 'ridge'
        ? [{ name: '<b>x</b>', dataIndex: 0, value: 0.3 }]
        : { data: key === 'mahalanobis' ? { name: 'A', distance: 2, isOutlier: true } : [0.2, 0.4, 1, 2], value: [0.2, 0.4], seriesName: 'test', seriesIndex: 0 };
      const html = tooltip.formatter(params);
      expect(html).not.toMatch(/\{text\.|<b>x<\/b>|NaN|Infinity/);
      // The ordinary MOO series label comes from ECharts; inspect its localized
      // non-dominated series and dedicated formatter path instead.
      const localizedHtml = key === 'moo' ? tooltip.formatter({ value: [0.2, 0.4], seriesName: language === 'zh' ? '预测 Pareto 前沿' : 'Predicted Pareto front', dataIndex: 0 }) : html;
      if (language === 'zh') expect(localizedHtml).toMatch(/\p{Script=Han}/u);
      else expect(localizedHtml).not.toMatch(/\p{Script=Han}/u);
    }
  });
});
