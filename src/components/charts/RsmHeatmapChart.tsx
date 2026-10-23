import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { buildCartesianScalarCells, cartesianScalarSeries } from './cartesianCells';
import { SCIENTIFIC_PALETTE, escapeScientificHtml, SCIENTIFIC_SEQUENTIAL, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';

interface RsmHeatmapChartProps {
  grid: { x1: number; x2: number; y: number }[][];
  stationaryPoint?: { x1: number; x2: number; y: number } | null;
  minX1: number;
  maxX1: number;
  minX2: number;
  maxX2: number;
  dataPoints: { x1: number; x2: number; y: number }[];
  x1Label: string;
  x2Label: string;
  yLabel: string;
  theme: 'light' | 'dark';
}

export const RsmHeatmapChart: React.FC<RsmHeatmapChartProps> = React.memo((props) => {
  const { grid, stationaryPoint, minX1, maxX1, minX2, maxX2, dataPoints, x1Label, x2Label, yLabel, theme } = props;
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].rsm;
  const cells = useMemo(() => buildCartesianScalarCells(grid.flatMap((row) => row.map((cell) => ({ x: cell.x1, y: cell.x2, z: cell.y })))), [grid]);
  const option = useMemo<EChartsOption>(() => {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const point of cells) {
      minimum = Math.min(minimum, point[2]);
      maximum = Math.max(maximum, point[2]);
    }
    const series: EChartsOption['series'] = [
      {
        ...cartesianScalarSeries(text.surface, cells),
        tooltip: {
          formatter: (params: unknown) => {
            const item = scientificTooltipItem(params);
            const value = item?.data as [number, number, number] | undefined;
            return value
              ? `${escapeScientificHtml(x1Label)}: ${formatScientificNumber(value[0])}<br/>${escapeScientificHtml(x2Label)}: ${formatScientificNumber(value[1])}<br/>${text.fitted} ${escapeScientificHtml(yLabel)}: ${formatScientificNumber(value[2])}`
              : '';
          },
        },
      },
      {
        name: text.observed,
        type: 'scatter',
        data: dataPoints.map((point) => [point.x1, point.x2, point.y]),
        symbolSize: 7,
        itemStyle: { color: theme === 'dark' ? '#ffffff' : '#0f172a', borderColor: SCIENTIFIC_PALETTE[0], borderWidth: 1.5 },
        tooltip: {
          formatter: (params: unknown) => {
            const item = scientificTooltipItem(params);
            const value = item?.data as [number, number, number] | undefined;
            return value
              ? `${text.observed}<br/>${escapeScientificHtml(x1Label)}: ${formatScientificNumber(value[0])}<br/>${escapeScientificHtml(x2Label)}: ${formatScientificNumber(value[1])}<br/>${escapeScientificHtml(yLabel)}: ${formatScientificNumber(value[2])}`
              : '';
          },
        },
      },
    ];
    if (stationaryPoint) {
      series.push({
        name: text.stationary,
        type: 'scatter',
        data: [[stationaryPoint.x1, stationaryPoint.x2, stationaryPoint.y]],
        symbol: 'diamond',
        symbolSize: 12,
        itemStyle: { color: SCIENTIFIC_PALETTE[1], borderColor: '#ffffff', borderWidth: 1.5 },
        tooltip: {
          formatter: () => `${text.stationaryNote}<br/>${escapeScientificHtml(x1Label)}: ${formatScientificNumber(stationaryPoint.x1)}<br/>${escapeScientificHtml(x2Label)}: ${formatScientificNumber(stationaryPoint.x2)}<br/>${text.fitted} ${escapeScientificHtml(yLabel)}: ${formatScientificNumber(stationaryPoint.y)}`,
        },
        z: 4,
      });
    }
    return {
      title: {
        text: text.title,
        subtext: text.subtitle,
        left: 'center',
        top: 6,
        textStyle: { fontSize: 14, fontWeight: 650 },
        subtextStyle: { fontSize: 10 },
      },
      grid: { top: 76, bottom: 62, left: 68, right: 86, containLabel: true },
      legend: { bottom: 4, data: [text.observed, ...(stationaryPoint ? [text.stationary] : [])] },
      xAxis: { type: 'value', name: x1Label, nameLocation: 'middle', nameGap: 34, min: minX1, max: maxX1 },
      yAxis: { type: 'value', name: x2Label, nameLocation: 'middle', nameGap: 48, min: minX2, max: maxX2 },
      visualMap: {
        dimension: 2,
        seriesIndex: 0,
        min: Number.isFinite(minimum) ? minimum : 0,
        max: Number.isFinite(maximum) ? maximum : 1,
        calculable: true,
        realtime: false,
        inRange: { color: [...SCIENTIFIC_SEQUENTIAL] },
        right: 4,
        top: 'middle',
        text: [yLabel, ''],
      },
      series,
    };
  }, [text, dataPoints, cells, maxX1, maxX2, minX1, minX2, stationaryPoint, theme, x1Label, x2Label, yLabel]);

  const dataCount = cells.length + dataPoints.length + (stationaryPoint ? 1 : 0);
  return (
    <ScientificEChart
      option={option}
      theme={theme}
      ariaLabel={text.aria}
      description={text.description}
      exportName="quadratic-response-surface"
      dataCount={dataCount}
      empty={cells.length === 0}
    />
  );
});
