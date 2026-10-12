import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ScientificEChart } from './ScientificEChart';
import { buildKdeFigure, type DensityPoint, type ObservationPoint } from './kdeFigure';

interface KdeTopologyChartProps {
  grid: DensityPoint[];
  dataPoints: ObservationPoint[];
  xLabel: string;
  yLabel: string;
  theme: 'light' | 'dark';
}

export const KdeTopologyChart: React.FC<KdeTopologyChartProps> = React.memo(({ grid, dataPoints, xLabel, yLabel, theme }) => {
  const { language } = useLanguage();
  const figure = useMemo(
    () => buildKdeFigure(grid, dataPoints, xLabel, yLabel, language, theme),
    [dataPoints, grid, language, theme, xLabel, yLabel],
  );
  return <ScientificEChart option={figure.option} theme={theme} ariaLabel={figure.title} description={figure.description} exportName="bivariate-kde" dataCount={figure.dataCount} empty={!figure.option} />;
});
