import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE } from './scientificFigurePolicy';

interface PronyChartProps {
  points: { omega: number; storage: number; loss: number; storage_fit: number; loss_fit: number }[];
  theme: 'light' | 'dark';
}

export const PronyChart: React.FC<PronyChartProps> = React.memo(({ points, theme }) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].prony;
  const option = useMemo<EChartsOption>(() => {
    const sorted = [...points]
      .filter((point) => [point.omega, point.storage, point.loss, point.storage_fit, point.loss_fit].every(Number.isFinite) && point.omega > 0)
      .sort((left, right) => left.omega - right.omega);
    return {
      title: { text: text.title, subtext: text.subtitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 }, subtextStyle: { fontSize: 10 } },
      legend: { bottom: 4, data: [text.observedStorage, text.observedLoss, text.modelStorage, text.modelLoss] },
      grid: { top: 76, bottom: 70, left: 76, right: 36, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'log', name: text.xAxis, nameLocation: 'middle', nameGap: 36 },
      yAxis: { type: 'log', name: text.yAxis, nameLocation: 'middle', nameGap: 52 },
      series: [
        { name: text.observedStorage, type: 'scatter', data: sorted.map((point) => [point.omega, point.storage]), symbolSize: 6, itemStyle: { color: SCIENTIFIC_PALETTE[0] } },
        { name: text.observedLoss, type: 'scatter', data: sorted.map((point) => [point.omega, point.loss]), symbol: 'triangle', symbolSize: 6, itemStyle: { color: SCIENTIFIC_PALETTE[1] } },
        { name: text.modelStorage, type: 'line', data: sorted.map((point) => [point.omega, point.storage_fit]), symbol: 'none', smooth: false, lineStyle: { width: 1.6, color: SCIENTIFIC_PALETTE[0] } },
        { name: text.modelLoss, type: 'line', data: sorted.map((point) => [point.omega, point.loss_fit]), symbol: 'none', smooth: false, lineStyle: { width: 1.6, type: 'dashed', color: SCIENTIFIC_PALETTE[1] } },
      ],
    };
  }, [text, points]);
  return <ScientificEChart option={option} theme={theme} ariaLabel={text.aria} description={text.description} exportName="prony-viscoelastic-fit" dataCount={points.length * 4} empty={points.length === 0} />;
});
