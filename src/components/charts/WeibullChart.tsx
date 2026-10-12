import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EChartsOption } from '@/lib/echarts';
import { ScientificEChart } from './ScientificEChart';
import { SCIENTIFIC_PALETTE, escapeScientificHtml, formatScientificNumber, scientificTooltipItem } from './scientificFigurePolicy';
import { summarizeFinite } from '@/lib/numericAggregation';

const WEIBULL_TEXT = {
  zh: {
    title: '双参数 Weibull 概率图',
    estimator: 'Bernard 中位秩最小二乘拟合（非极大似然估计）',
    observed: '中位秩观测值', fitted: '最小二乘拟合（模型）',
    failure: '累积失效概率', survival: 'B5 / 95% 存活率',
    description: '采用 Bernard 中位秩和普通最小二乘线性化，不是极大似然估计；B5 是拟合模型的 5% 失效分位数，不是安全保证。',
  },
  en: {
    title: 'Two-parameter Weibull probability plot',
    estimator: 'Bernard median-rank OLS (not MLE)',
    observed: 'Median-rank observations', fitted: 'OLS fit (model)',
    failure: 'Cumulative failure', survival: 'B5 / 95% survival',
    description: 'The figure uses Bernard median ranks and ordinary least-squares linearization, not maximum-likelihood estimation. B5 is the fitted 5% failure quantile, not a safety guarantee.',
  },
} as const;

interface WeibullChartProps {
  points: { value: number; x: number; y: number; p: number }[];
  m: number;
  eta: number;
  rSquared: number;
  safeValue95: number;
  targetKey: string;
  theme: 'light' | 'dark';
}

export const WeibullChart: React.FC<WeibullChartProps> = React.memo((props) => {
  const { language } = useLanguage();
  const text = WEIBULL_TEXT[language];
  const { points, m, eta, rSquared, safeValue95, targetKey, theme } = props;
  const option = useMemo<EChartsOption>(() => {
    const bounds = summarizeFinite(points, (point) => point.x);
    const minX = bounds?.minimum ?? 0;
    const maxX = bounds?.maximum ?? 0;
    const b5Log = safeValue95 > 0 ? Math.log(safeValue95) : null;
    return {
      title: {
        text: text.title,
        subtext: `${text.estimator}; m=${formatScientificNumber(m)}, η=${formatScientificNumber(eta)}, R²=${rSquared.toFixed(4)}.`,
        left: 'center',
        top: 6,
        textStyle: { fontSize: 14, fontWeight: 650 },
        subtextStyle: { fontSize: 10 },
      },
      legend: { bottom: 4, data: [text.observed, text.fitted] },
      grid: { top: 76, bottom: 70, left: 72, right: 36, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const item = scientificTooltipItem(params);
          if (item?.seriesType === 'line') return text.estimator;
          const value = item?.data as [number, number, number, number] | undefined;
          return value
            ? `${text.observed}<br/>${escapeScientificHtml(targetKey)}: ${formatScientificNumber(value[2])}<br/>${text.failure}: ${formatScientificNumber(value[3] * 100)}%`
            : '';
        },
      },
      xAxis: { type: 'value', name: `ln(${targetKey})`, nameLocation: 'middle', nameGap: 34, scale: true },
      yAxis: { type: 'value', name: 'ln[-ln(1 − P)]', nameLocation: 'middle', nameGap: 50, scale: true },
      series: [
        {
          name: text.observed,
          type: 'scatter',
          data: points.map((point) => [point.x, point.y, point.value, point.p]),
          symbolSize: 7,
          itemStyle: { color: SCIENTIFIC_PALETTE[0] },
          markLine: b5Log === null ? undefined : {
            symbol: ['none', 'none'],
            silent: true,
            lineStyle: { color: SCIENTIFIC_PALETTE[2], type: 'dotted', width: 1.4 },
            label: { formatter: `${text.survival} = ${formatScientificNumber(safeValue95)}` },
            data: [{ xAxis: b5Log }],
          },
        },
        {
          name: text.fitted,
          type: 'line',
          data: [[minX, m * (minX - Math.log(eta))], [maxX, m * (maxX - Math.log(eta))]],
          symbol: 'none',
          lineStyle: { color: SCIENTIFIC_PALETTE[1], width: 1.6, type: 'dashed' },
          silent: true,
        },
      ],
    };
  }, [eta, m, points, rSquared, safeValue95, targetKey, text]);

  return (
    <ScientificEChart
      option={option}
      theme={theme}
      ariaLabel={text.title}
      description={text.description}
      exportName="weibull-median-rank-ols"
      dataCount={points.length + 2}
      empty={points.length < 3}
    />
  );
});
