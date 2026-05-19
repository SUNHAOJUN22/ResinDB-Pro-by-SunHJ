import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface SpcChartProps {
  histogram: { x: number; y: number }[];
  normalCurve: { x: number; y: number }[];
  histogramBins: number[];
  mean: number;
  sigma: number;
  usl: number;
  lsl: number;
  theme: "light" | "dark";
}

export const SpcChart: React.FC<SpcChartProps> = React.memo(({ histogram, normalCurve, mean, sigma, usl, lsl, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const splitLineColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    const barData = histogram.map(h => [h.x, h.y]);
    const lineData = normalCurve.map(n => [n.x, n.y]);
    
    const ucl = mean + 3 * sigma;
    const lcl = mean - 3 * sigma;

    const option: echarts.EChartsOption = {
      title: {
         text: '分布与控制线直方图',
         left: 'center',
         textStyle: { color: textColor, fontSize: 13 }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: {
        bottom: '0%',
        textStyle: { color: textColor }
      },
      grid: { top: '15%', bottom: '15%', left: '8%', right: '8%' },
      xAxis: {
        type: 'value',
        name: '特征值',
        nameLocation: 'middle',
        nameGap: 30,
        scale: true,
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '频率 / 密度',
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      series: [
        {
          name: '频率分布 (Histogram)',
          type: 'bar',
          barWidth: '95%',
          data: barData,
          itemStyle: { color: '#3b82f6', opacity: 0.6 },
          markLine: {
            symbol: ['none', 'none'],
            label: { position: 'middle', formatter: '{b}' },
            lineStyle: { width: 2 },
            data: [
              { xAxis: lsl, name: 'LSL', lineStyle: { color: '#ef4444', type: 'dashed' } },
              { xAxis: usl, name: 'USL', lineStyle: { color: '#ef4444', type: 'dashed' } },
              { xAxis: mean, name: 'Mean (μ)', lineStyle: { color: '#10b981', type: 'solid' } },
              { xAxis: lcl, name: '-3σ (LCL)', lineStyle: { color: '#f59e0b', type: 'dotted' } },
              { xAxis: ucl, name: '+3σ (UCL)', lineStyle: { color: '#f59e0b', type: 'dotted' } }
            ]
          }
        },
        {
          name: '正态理论曲线 (Normal Curve)',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: lineData,
          itemStyle: { color: '#6366f1' },
          lineStyle: { width: 3 }
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [histogram, normalCurve, mean, sigma, usl, lsl, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
});
