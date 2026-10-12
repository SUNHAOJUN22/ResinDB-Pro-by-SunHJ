import type { EChartsOption } from '@/lib/echarts';
import type { Language } from '@/types/index';
import { SCIENTIFIC_SEQUENTIAL, escapeScientificHtml, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';

export interface DensityPoint { x: number; y: number; z: number }
export interface ObservationPoint { x: number; y: number }
export type DensityCell = [number, number, number, number, number, number, number];

export const KDE_FIGURE_TEXT = {
  zh: {
    title: '二维高斯核密度估计',
    description: '颜色表示拟合密度，散点表示有限观测值；有限显示窗口内的密度积分不保证为 1。',
    density: '拟合密度', observed: '观测点', relative: '相对于网格最大密度',
    invalid: '未绘制的无效网格点',
  },
  en: {
    title: 'Bivariate Gaussian kernel-density estimate',
    description: 'Color shows fitted density; markers show finite observations. Density over the displayed window need not integrate to one.',
    density: 'Fitted density', observed: 'Observed points', relative: 'Relative to grid maximum',
    invalid: 'Invalid grid points omitted',
  },
} as const;

function coordinateBounds(values: readonly number[]): Map<number, [number, number]> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const bounds = new Map<number, [number, number]>();
  // A single coordinate does not define a density-cell width in physical units.
  if (sorted.length < 2) return bounds;
  for (let index = 0; index < sorted.length; index++) {
    const center = sorted[index];
    const left = index === 0 ? center - (sorted[1] - center) / 2 : sorted[index - 1] / 2 + center / 2;
    const right = index === sorted.length - 1 ? center + (center - sorted[index - 1]) / 2 : center / 2 + sorted[index + 1] / 2;
    if (Number.isFinite(left) && Number.isFinite(right) && right > left) bounds.set(center, [left, right]);
  }
  return bounds;
}

/** Cell boundaries preserve continuous coordinates; densities are not rescaled. */
export function buildDensityCells(grid: readonly DensityPoint[]): DensityCell[] {
  const finite = grid.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z) && point.z >= 0);
  const xBounds = coordinateBounds(finite.map((point) => point.x));
  const yBounds = coordinateBounds(finite.map((point) => point.y));
  return finite.flatMap((point): DensityCell[] => {
    const x = xBounds.get(point.x);
    const y = yBounds.get(point.y);
    return x && y ? [[point.x, point.y, point.z, x[0], x[1], y[0], y[1]]] : [];
  });
}

export function buildKdeFigure(
  grid: readonly DensityPoint[], observations: readonly ObservationPoint[],
  xLabel: string, yLabel: string, language: Language, theme: 'light' | 'dark',
): { option: EChartsOption | null; dataCount: number; description: string; title: string } {
  const text = KDE_FIGURE_TEXT[language];
  const cells = buildDensityCells(grid);
  const points = observations.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const description = `${text.description}${cells.length < grid.length ? ` ${text.invalid}: ${grid.length - cells.length}.` : ''}`;
  if (!cells.length) return { option: null, dataCount: 0, description, title: text.title };
  const maximum = cells.reduce((value, cell) => Math.max(value, cell[2]), 0);
  const option: EChartsOption = {
    title: { text: text.title, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 } },
    grid: { top: 54, bottom: 62, left: 68, right: 84, containLabel: true },
    tooltip: { formatter: (params: unknown) => {
      const item = scientificTooltipItem(params);
      const value = item?.data as number[] | undefined;
      if (!value) return '';
      const coordinates = `${escapeScientificHtml(xLabel)}: ${formatScientificNumber(value[0])}<br/>${escapeScientificHtml(yLabel)}: ${formatScientificNumber(value[1])}`;
      return item?.seriesType === 'scatter'
        ? `${text.observed}<br/>${coordinates}`
        : `${text.density}: ${formatScientificNumber(value[2])}<br/>${coordinates}<br/>${text.relative}: ${formatScientificNumber(maximum > 0 ? value[2] / maximum * 100 : 0)}%`;
    } },
    xAxis: { type: 'value', name: xLabel, nameLocation: 'middle', nameGap: 34, scale: true },
    yAxis: { type: 'value', name: yLabel, nameLocation: 'middle', nameGap: 46, scale: true },
    visualMap: { min: 0, max: maximum || 1, dimension: 2, seriesIndex: 0, calculable: true, realtime: false, right: 4, top: 'middle', inRange: { color: [...SCIENTIFIC_SEQUENTIAL] } },
    series: [
      {
        name: text.density, type: 'custom', coordinateSystem: 'cartesian2d', clip: true,
        dimensions: ['x', 'y', 'density', 'xLower', 'xUpper', 'yLower', 'yUpper'],
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
        emphasis: { disabled: true },
      },
      { name: text.observed, type: 'scatter', data: points.map((point) => [point.x, point.y]), symbolSize: points.length > 2_000 ? 2 : 4, progressive: 1_000, itemStyle: { color: theme === 'dark' ? '#ffffff' : '#0f172a', opacity: 0.55 } },
    ],
  };
  return { option, dataCount: cells.length + points.length, description, title: text.title };
}
