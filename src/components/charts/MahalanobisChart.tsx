import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE, escapeScientificHtml, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';

interface MahalanobisChartProps {
  distances: { index: number; id: string; name: string; distance: number; isOutlier: boolean }[];
  threshold: number;
  theme: 'light' | 'dark';
}

export const MahalanobisChart: React.FC<MahalanobisChartProps> = React.memo(({ distances, threshold, theme }) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].mahalanobis;
  const option = useMemo<EChartsOption>(() => {
    let maximum = threshold;
    for (const entry of distances) maximum = Math.max(maximum, entry.distance);
    return {
      title: { text: text.title, subtext: text.subtitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 }, subtextStyle: { fontSize: 10 } },
      grid: { top: 76, bottom: 62, left: 70, right: 36, containLabel: true },
      dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'filter' }],
      tooltip: { formatter: (params: unknown) => { const item = scientificTooltipItem(params); const data = item?.data as { name?: string; distance?: number; isOutlier?: boolean } | undefined; return data ? `<strong>${escapeScientificHtml(data.name)}</strong><br/>D²: ${formatScientificNumber(Number(data.distance))}<br/>${text.status}: ${data.isOutlier ? text.above : text.within}` : ''; } },
      xAxis: { type: 'value', name: text.xAxis, nameLocation: 'middle', nameGap: 32, min: 0, max: distances.length + 1 },
      yAxis: { type: 'value', name: text.yAxis, nameLocation: 'middle', nameGap: 46, min: 0, max: maximum > 0 ? maximum * 1.15 : 1 },
      series: [{
        name: text.series,
        type: 'scatter',
        symbolSize: 7,
        progressive: 1_000,
        data: distances.map((entry) => ({
          value: [entry.index, entry.distance],
          name: entry.name,
          distance: entry.distance,
          isOutlier: entry.isOutlier,
          itemStyle: { color: entry.isOutlier ? SCIENTIFIC_PALETTE[1] : SCIENTIFIC_PALETTE[0], opacity: 0.78 },
        })),
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          lineStyle: { color: SCIENTIFIC_PALETTE[1], type: 'dashed', width: 1.5 },
          label: { formatter: text.reference },
          data: [{ yAxis: threshold }],
        },
      }],
    };
  }, [text, distances, threshold]);
  return <ScientificEChart option={option} theme={theme} ariaLabel={text.aria} description={text.description} exportName="mahalanobis-screening" dataCount={distances.length} empty={distances.length === 0} />;
});
