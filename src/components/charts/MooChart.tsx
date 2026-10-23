import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE, escapeScientificHtml, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';

interface MooChartProps {
  evaluatedCandidates: { params: Record<string, number>; means: Record<string, number> }[];
  paretoFront: { params: Record<string, number>; means: Record<string, number>; stds: Record<string, number> }[];
  historical: Record<string, number>[];
  targets: { name: string; maximize: boolean }[];
  theme: 'light' | 'dark';
}

export const MooChart: React.FC<MooChartProps> = React.memo(({ evaluatedCandidates, paretoFront, historical, targets, theme }) => {
  const { language, tProp } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].moo;
  const option = useMemo<EChartsOption | null>(() => {
    if (targets.length !== 2) return null;
    const [xTarget, yTarget] = targets;
    const xLabel = tProp(xTarget.name);
    const yLabel = tProp(yTarget.name);
    const sortedPareto = [...paretoFront].sort((left, right) => left.means[xTarget.name] - right.means[xTarget.name]);
    return {
      title: { text: text.title, subtext: text.subtitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 }, subtextStyle: { fontSize: 10 } },
      legend: { bottom: 4, data: [text.historical, text.pool, text.pareto] },
      grid: { top: 76, bottom: 70, left: 70, right: 36, containLabel: true },
      tooltip: { trigger: 'item', formatter: (params: unknown) => {
        const item = scientificTooltipItem(params);
        const value = item?.value as [number, number] | undefined;
        if (!value) return '';
        if (item?.seriesName === text.pareto) {
          const dataIndex = typeof item.dataIndex === 'number' ? item.dataIndex : -1;
          const point = sortedPareto[dataIndex];
          const parameters = point ? Object.entries(point.params).map(([name, parameter]) => `${escapeScientificHtml(tProp(name))}: ${formatScientificNumber(parameter)}`).join('<br/>') : '';
          return `${text.candidate}<br/>${escapeScientificHtml(xLabel)}: ${formatScientificNumber(value[0])}<br/>${escapeScientificHtml(yLabel)}: ${formatScientificNumber(value[1])}${parameters ? `<br/><hr/>${parameters}` : ''}`;
        }
        return `${escapeScientificHtml(item?.seriesName)}<br/>${escapeScientificHtml(xLabel)}: ${formatScientificNumber(value[0])}<br/>${escapeScientificHtml(yLabel)}: ${formatScientificNumber(value[1])}`;
      } },
      xAxis: { type: 'value', name: `${xLabel} (${xTarget.maximize ? text.maximize : text.minimize})`, nameLocation: 'middle', nameGap: 34, scale: true },
      yAxis: { type: 'value', name: `${yLabel} (${yTarget.maximize ? text.maximize : text.minimize})`, nameLocation: 'middle', nameGap: 48, scale: true },
      series: [
        { name: text.pool, type: 'scatter', data: evaluatedCandidates.map((candidate) => [candidate.means[xTarget.name], candidate.means[yTarget.name]]), symbolSize: 3, progressive: 2_000, large: evaluatedCandidates.length > 8_000, itemStyle: { color: '#94a3b8', opacity: 0.35 } },
        { name: text.historical, type: 'scatter', data: historical.map((entry) => [entry[xTarget.name], entry[yTarget.name]]), symbolSize: 7, symbol: 'triangle', itemStyle: { color: SCIENTIFIC_PALETTE[0] } },
        { name: text.pareto, type: 'line', data: sortedPareto.map((entry) => [entry.means[xTarget.name], entry.means[yTarget.name]]), symbolSize: 6, lineStyle: { color: SCIENTIFIC_PALETTE[1], width: 1.8 }, itemStyle: { color: SCIENTIFIC_PALETTE[1] } },
      ],
    };
  }, [text, evaluatedCandidates, historical, paretoFront, targets, tProp]);
  return <ScientificEChart option={option} theme={theme} ariaLabel={text.aria} description={text.description} exportName="predicted-pareto-front" dataCount={evaluatedCandidates.length + historical.length + paretoFront.length} empty={!option} />;
});
