import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE, escapeScientificHtml, formatScientificNumber } from './scientificFigurePolicy';

interface SobolChartProps {
  firstOrder: { name: string; value: number }[];
  totalEffect: { name: string; value: number }[];
  interactions: { name: string; value: number }[];
  theme: 'light' | 'dark';
}

export const SobolChart: React.FC<SobolChartProps> = React.memo(({ firstOrder, totalEffect, interactions, theme }) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].sobol;
  const option = useMemo<EChartsOption>(() => {
    const firstByName = new Map(firstOrder.map((entry) => [entry.name, entry.value]));
    const interactionByName = new Map(interactions.map((entry) => [entry.name, entry.value]));
    const ordered = [...totalEffect].reverse();
    return {
      title: { text: text.title, subtext: text.subtitle, left: 'center', top: 6, textStyle: { fontSize: 14, fontWeight: 650 }, subtextStyle: { fontSize: 10 } },
      legend: { bottom: 4, data: [text.first, text.aggregate] },
      grid: { top: 76, bottom: 70, left: 28, right: 40, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params: unknown) => { const entries = Array.isArray(params) ? params as Array<{ name: string; seriesName: string; value: number }> : []; if (!entries.length) return ''; const name = entries[0].name; const first = Number(firstByName.get(name) ?? 0); const aggregate = Number(interactionByName.get(name) ?? 0); const total = Number(totalEffect.find((entry) => entry.name === name)?.value ?? first + aggregate); return `<strong>${escapeScientificHtml(name)}</strong><br/>${text.total}: ${formatScientificNumber(total)}<br/>${text.first}: ${formatScientificNumber(first)}<br/>${text.aggregate}: ${formatScientificNumber(aggregate)}<br/><em>${text.caveat}</em>`; } },
      xAxis: { type: 'value', name: text.axis, nameLocation: 'middle', nameGap: 34, min: 0 },
      yAxis: { type: 'category', data: ordered.map((entry) => entry.name), axisLabel: { width: 160, overflow: 'truncate' }, axisTick: { show: false } },
      series: [
        { name: text.first, type: 'bar', stack: 'total', data: ordered.map((entry) => firstByName.get(entry.name) ?? 0), barMaxWidth: 22, itemStyle: { color: SCIENTIFIC_PALETTE[0] } },
        { name: text.aggregate, type: 'bar', stack: 'total', data: ordered.map((entry) => interactionByName.get(entry.name) ?? 0), barMaxWidth: 22, itemStyle: { color: SCIENTIFIC_PALETTE[4] } },
      ],
    };
  }, [text, firstOrder, interactions, totalEffect]);
  return <ScientificEChart option={option} theme={theme} ariaLabel={text.aria} description={text.description} exportName="jansen-sensitivity-indices" dataCount={totalEffect.length * 2} empty={totalEffect.length === 0} />;
});
