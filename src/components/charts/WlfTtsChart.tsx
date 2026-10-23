import React, { useMemo } from 'react';
import type { EChartsOption } from '@/lib/echarts';
import { useLanguage } from '@/contexts/LanguageContext';
import { ADVANCED_CHART_TEXT } from './advancedChartText';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';

interface WlfDiagnostics {
  shiftSearch?: string;
  interpolation?: string;
  fallbackConstantsUsed?: boolean;
  verticalShiftAssumption?: string;
}

interface WlfTtsChartProps {
  c1: number;
  c2: number;
  refTemp: number;
  shiftFactors: { temp: number; aT: number; logAT?: number; alignmentMse?: number }[];
  masterCurve: { temp: number; points: { rate: number; visc: number; originalRate: number; originalVisc: number }[] }[];
  theme: 'light' | 'dark';
  diagnostics?: WlfDiagnostics;
}

export const WlfTtsChart: React.FC<WlfTtsChartProps> = React.memo(({
  c1,
  c2,
  refTemp,
  shiftFactors,
  masterCurve,
  theme,
  diagnostics,
}) => {
  const { language } = useLanguage();
  const text = ADVANCED_CHART_TEXT[language].wlf;
  const option = useMemo<EChartsOption>(() => ({
    title: {
      text: `${text.title} (Tref=${formatScientificNumber(refTemp)} °C)`,
      subtext: `C1=${formatScientificNumber(c1)}, C2=${formatScientificNumber(c2)}; ${text.assumption}${diagnostics?.fallbackConstantsUsed ? `; ${text.fallback}` : ''}.`,
      left: 'center',
      top: 6,
      textStyle: { fontSize: 14, fontWeight: 650 },
      subtextStyle: { fontSize: 10 },
    },
    legend: { bottom: 4, data: masterCurve.map((curve) => `${curve.temp} °C`) },
    grid: { top: 76, bottom: 70, left: 76, right: 36, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = scientificTooltipItem(params);
        const seriesIndex = typeof item?.seriesIndex === 'number' ? item.seriesIndex : -1;
        const curve = masterCurve[seriesIndex];
        const point = item?.data as [number, number] | undefined;
        const factor = curve ? shiftFactors.find((entry) => entry.temp === curve.temp) : undefined;
        return curve && point
          ? `${curve.temp} °C<br/>${text.rate}: ${formatScientificNumber(point[0])}<br/>${text.viscosity}: ${formatScientificNumber(point[1])} Pa·s<br/>aT: ${factor ? formatScientificNumber(factor.aT) : '—'}`
          : '';
      },
    },
    xAxis: {
      type: 'log',
      name: text.xAxis,
      nameLocation: 'middle',
      nameGap: 38,
    },
    yAxis: {
      type: 'log',
      name: text.yAxis,
      nameLocation: 'middle',
      nameGap: 54,
    },
    series: masterCurve.map((curve, index) => ({
      name: `${curve.temp} °C`,
      type: 'scatter' as const,
      data: curve.points.map((point) => [point.rate, point.visc]),
      symbolSize: 5,
      progressive: 1_000,
      itemStyle: { color: SCIENTIFIC_PALETTE[index % SCIENTIFIC_PALETTE.length], opacity: 0.78 },
    })),
  }), [text, c1, c2, diagnostics?.fallbackConstantsUsed, masterCurve, refTemp, shiftFactors]);

  const count = masterCurve.reduce((sum, curve) => sum + curve.points.length, 0);
  return (
    <ScientificEChart
      option={option}
      theme={theme}
      ariaLabel={text.aria}
      description={text.description}
      exportName="wlf-time-temperature-superposition"
      dataCount={count}
      empty={count === 0}
    />
  );
});
