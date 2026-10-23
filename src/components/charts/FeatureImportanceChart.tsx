import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE, escapeScientificHtml, formatScientificNumber } from './scientificFigurePolicy';

interface FeatureImportanceChartProps {
  importances: { feature: string; importance: number; positive: boolean }[];
  theme: 'light' | 'dark';
}

export const FeatureImportanceChart: React.FC<FeatureImportanceChartProps> = React.memo(({ importances, theme }) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].ridge;
  const option = useMemo<EChartsOption>(() => {
    const sorted = [...importances].sort((left, right) => left.importance - right.importance);
    return {
      title: {
        text: text.title,
        subtext: text.subtitle,
        left: 'center',
        top: 6,
        textStyle: { fontSize: 14, fontWeight: 650 },
        subtextStyle: { fontSize: 10 },
      },
      grid: { top: 76, bottom: 58, left: 24, right: 52, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const entry = Array.isArray(params) ? params[0] as { dataIndex: number; name: string; value: number } : null;
          if (!entry) return '';
          const source = sorted[entry.dataIndex];
          return `<strong>${escapeScientificHtml(entry.name)}</strong><br/>${text.share}: ${formatScientificNumber(entry.value)}%<br/>${text.direction}: ${source.positive ? text.positive : text.negative}<br/><em>${text.caveat}</em>`;
        },
      },
      xAxis: {
        type: 'value',
        name: text.xAxis,
        nameLocation: 'middle',
        nameGap: 32,
        min: 0,
        axisLabel: { formatter: '{value}%' },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((entry) => entry.feature),
        axisLabel: { width: 180, overflow: 'truncate' },
        axisTick: { show: false },
      },
      series: [{
        name: text.series,
        type: 'bar',
        barMaxWidth: 22,
        data: sorted.map((entry) => ({
          value: entry.importance * 100,
          itemStyle: { color: entry.positive ? SCIENTIFIC_PALETTE[2] : SCIENTIFIC_PALETTE[1] },
        })),
        label: { show: true, position: 'right', formatter: ({ value }: { value?: unknown }) => `${formatScientificNumber(Number(value))}%` },
      }],
    };
  }, [text, importances]);

  return (
    <ScientificEChart
      option={option}
      theme={theme}
      ariaLabel={text.aria}
      description={text.description}
      exportName="ridge-sensitivity-attribution"
      dataCount={importances.length}
      empty={importances.length === 0}
    />
  );
});
