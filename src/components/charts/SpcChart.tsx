import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE } from './scientificFigurePolicy';

interface SpcChartProps {
  histogram: { x: number; y: number }[];
  normalCurve: { x: number; y: number }[];
  histogramBins: number[];
  mean: number;
  sigma: number;
  usl: number;
  lsl: number;
  theme: 'light' | 'dark';
}

export const SpcChart: React.FC<SpcChartProps> = React.memo(({ histogram, normalCurve, mean, sigma, usl, lsl, theme }) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].spc;
  const option = useMemo<EChartsOption>(() => {
    const upperThreeSigma = mean + 3 * sigma;
    const lowerThreeSigma = mean - 3 * sigma;
    return {
      title: { text: text.title, subtext: text.subtitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 }, subtextStyle: { fontSize: 10 } },
      legend: { bottom: 4, data: [text.histogram, text.normal] },
      grid: { top: 76, bottom: 70, left: 70, right: 36, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', name: text.xAxis, nameLocation: 'middle', nameGap: 34, scale: true },
      yAxis: { type: 'value', name: text.yAxis, nameLocation: 'middle', nameGap: 48, min: 0 },
      series: [
        {
          name: text.histogram,
          type: 'bar',
          barWidth: '92%',
          data: histogram.map((entry) => [entry.x, entry.y]),
          itemStyle: { color: SCIENTIFIC_PALETTE[0], opacity: 0.55 },
          markLine: {
            symbol: ['none', 'none'],
            silent: true,
            label: { position: 'insideEndTop', formatter: '{b}' },
            data: [
              { xAxis: lsl, name: text.lsl, lineStyle: { color: SCIENTIFIC_PALETTE[1], type: 'dashed', width: 1.5 } },
              { xAxis: usl, name: text.usl, lineStyle: { color: SCIENTIFIC_PALETTE[1], type: 'dashed', width: 1.5 } },
              { xAxis: mean, name: text.mean, lineStyle: { color: SCIENTIFIC_PALETTE[2], type: 'solid', width: 1.5 } },
              { xAxis: lowerThreeSigma, name: text.lower, lineStyle: { color: SCIENTIFIC_PALETTE[4], type: 'dotted', width: 1.3 } },
              { xAxis: upperThreeSigma, name: text.upper, lineStyle: { color: SCIENTIFIC_PALETTE[4], type: 'dotted', width: 1.3 } },
            ],
          },
        },
        { name: text.normal, type: 'line', smooth: false, showSymbol: false, data: normalCurve.map((entry) => [entry.x, entry.y]), lineStyle: { width: 1.7, color: SCIENTIFIC_PALETTE[3] } },
      ],
    };
  }, [text, histogram, lsl, mean, normalCurve, sigma, usl]);
  return <ScientificEChart option={option} theme={theme} ariaLabel={text.aria} description={text.description} exportName="spc-distribution-reference-limits" dataCount={histogram.length + normalCurve.length} empty={histogram.length === 0} />;
});
