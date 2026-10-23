import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { buildCartesianScalarCells, cartesianScalarSeries } from './cartesianCells';
import { SCIENTIFIC_SEQUENTIAL, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';

interface CopulaChartProps { grid: { u: number; v: number; z: number }[]; theme: 'light' | 'dark' }

export const CopulaChart: React.FC<CopulaChartProps> = React.memo(({ grid, theme }) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].copula;
  const cells = useMemo(() => buildCartesianScalarCells(grid
    .filter((point) => point.z >= 0)
    .map((point) => ({ x: point.u, y: point.v, z: point.z }))), [grid]);
  const option = useMemo<EChartsOption>(() => {
    let maxDensity = 0;
    for (const cell of cells) maxDensity = Math.max(maxDensity, cell[2]);
    return {
      title: { text: text.title, subtext: text.subtitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 }, subtextStyle: { fontSize: 10 } },
      grid: { top: 76, bottom: 62, left: 68, right: 84, containLabel: true },
      tooltip: { formatter: (params: unknown) => { const item = scientificTooltipItem(params); const value = item?.data as [number, number, number] | undefined; return value ? `u: ${formatScientificNumber(value[0])}<br/>v: ${formatScientificNumber(value[1])}<br/>${text.density}: ${formatScientificNumber(value[2])}` : ''; } },
      xAxis: { type: 'value', name: 'u = ECDF(X)', nameLocation: 'middle', nameGap: 34, min: 0, max: 1 },
      yAxis: { type: 'value', name: 'v = ECDF(Y)', nameLocation: 'middle', nameGap: 46, min: 0, max: 1 },
      visualMap: { min: 0, max: maxDensity || 1, dimension: 2, seriesIndex: 0, calculable: true, realtime: false, right: 4, top: 'middle', inRange: { color: [...SCIENTIFIC_SEQUENTIAL] } },
      series: [cartesianScalarSeries(text.series, cells)],
    };
  }, [text, cells]);
  return <ScientificEChart option={option} theme={theme} ariaLabel={text.aria} description={text.description} exportName="gaussian-copula-density" dataCount={cells.length} empty={cells.length === 0} />;
});
