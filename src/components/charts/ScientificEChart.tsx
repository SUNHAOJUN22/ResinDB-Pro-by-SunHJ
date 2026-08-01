import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Database, Loader2 } from 'lucide-react';
import * as echarts from '@/lib/echarts';
import { applyScientificFigurePolicy, type ScientificFigureTheme } from './scientificFigurePolicy';

export interface ScientificEChartProps {
  option: echarts.EChartsOption | null;
  theme: ScientificFigureTheme;
  ariaLabel: string;
  description?: string;
  exportName?: string;
  dataCount?: number;
  loading?: boolean;
  empty?: boolean;
  error?: string | null;
  className?: string;
  height?: number | string;
  onChartReady?: (chart: echarts.ECharts) => void;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export const ScientificEChart: React.FC<ScientificEChartProps> = React.memo(({
  option,
  theme,
  ariaLabel,
  description,
  exportName,
  dataCount = 0,
  loading = false,
  empty = false,
  error = null,
  className = '',
  height = '100%',
  onChartReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const reducedMotion = useReducedMotion();
  const normalizedOption = useMemo(() => (
    option
      ? applyScientificFigurePolicy(option, {
          theme,
          title: ariaLabel,
          description,
          exportName,
          dataCount,
          reducedMotion,
        })
      : null
  ), [ariaLabel, dataCount, description, exportName, option, reducedMotion, theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const chart = echarts.getInstanceByDom(container)
      ?? echarts.init(container, undefined, { renderer: 'canvas', useDirtyRect: true });
    chartRef.current = chart;
    onChartReady?.(chart);
    return () => {
      if (!chart.isDisposed()) chart.dispose();
      chartRef.current = null;
    };
  }, [onChartReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed()) return;
    if (!normalizedOption || empty || error) {
      chart.clear();
      return;
    }
    chart.setOption(normalizedOption, { notMerge: true, lazyUpdate: true });
  }, [empty, error, normalizedOption]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      if (!entries.some((entry) => entry.contentRect.width > 0 && entry.contentRect.height > 0)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const chart = chartRef.current;
        if (chart && !chart.isDisposed()) chart.resize({ animation: { duration: 0 } });
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const stateVisible = loading || empty || Boolean(error);
  return (
    <div
      className={`scientific-figure relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${className}`}
      style={{ height, minHeight: 300 }}
      data-scientific-figure="true"
    >
      <div
        ref={containerRef}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={description ? `${exportName ?? 'scientific-figure'}-description` : undefined}
        className={`h-full w-full transition-opacity ${stateVisible ? 'opacity-0' : 'opacity-100'}`}
      />
      {description && <span id={`${exportName ?? 'scientific-figure'}-description`} className="sr-only">{description}</span>}
      {stateVisible && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/96 p-6 text-center dark:bg-slate-950/96" role={error ? 'alert' : 'status'}>
          <div className="max-w-sm">
            {loading ? (
              <Loader2 className="mx-auto mb-3 animate-spin text-indigo-600 motion-reduce:animate-none" size={28} aria-hidden="true" />
            ) : error ? (
              <AlertCircle className="mx-auto mb-3 text-rose-600" size={28} aria-hidden="true" />
            ) : (
              <Database className="mx-auto mb-3 text-slate-400" size={28} aria-hidden="true" />
            )}
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {loading ? 'Calculating scientific figure' : error ? 'Figure unavailable' : 'No plottable data'}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {error ?? (loading ? 'The numerical model is running in a background Worker.' : 'Adjust the variables, filters, or sample selection.')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
