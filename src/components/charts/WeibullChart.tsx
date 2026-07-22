import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface WeibullChartProps {
  points: { value: number; x: number; y: number; p: number }[];
  m: number;
  eta: number;
  rSquared: number;
  safeValue95: number;
  targetKey: string;
  theme: "light" | "dark";
}

export const WeibullChart: React.FC<WeibullChartProps> = React.memo(({ points, m, eta, rSquared, safeValue95, targetKey, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const splitLineColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    const scatterData = points.map(pt => [pt.x, pt.y, pt.value, pt.p]);
    
    // Fit line points
    const minX = Math.min(...points.map(pt => pt.x));
    const maxX = Math.max(...points.map(pt => pt.x));
    
    // Y = m*X - m*ln(eta) => Y = m * (X - ln(eta))
    const lineY1 = m * (minX - Math.log(eta));
    const lineY2 = m * (maxX - Math.log(eta));

    const lineData = [
       [minX, lineY1],
       [maxX, lineY2]
    ];

    const option: echarts.EChartsOption = {
      title: {
         text: 'Weibull Probability Plot',
         left: 'center',
         textStyle: { color: textColor, fontSize: 14 }
      },
      tooltip: {
        
         
        formatter: (params: any) => {
           if (params.seriesType === 'scatter') {
               const val = params.data[2];
               const failProbability = (params.data[3] * 100).toFixed(2);
               return `<strong>Failure Point</strong><br/>Value (${targetKey}): ${val.toFixed(2)}<br/>Cumulative Failure: ${failProbability}%`;
           }
           return `Linear Fit Line`;
        }
      },
      grid: {
         top: '15%',
         bottom: '15%',
         left: '10%',
         right: '10%',
         containLabel: true
      },
      toolbox: {
         feature: {
            dataZoom: { yAxisIndex: "none" },
            restore: {},
            saveAsImage: { name: 'weibull_chart', pixelRatio: 2 }
         },
         iconStyle: { borderColor: textColor }
      },
      dataZoom: [
         { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
         { type: 'inside', yAxisIndex: 0, filterMode: 'filter' },
      ],
      xAxis: {
        type: 'value',
        name: `ln(${targetKey})`,
        nameLocation: 'middle',
        nameGap: 25,
        scale: true,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      yAxis: {
        type: 'value',
        name: 'ln(-ln(1 - P))',
        nameLocation: 'middle',
        nameGap: 35,
        scale: true,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      series: [
        {
          name: 'Data Points',
          type: 'scatter',
          data: scatterData,
          itemStyle: { color: '#0ea5e9' },
          symbolSize: 8
        },
        {
          name: 'Fit Line',
          type: 'line',
          data: lineData,
          itemStyle: { color: '#ef4444' }, // red line
          lineStyle: { width: 2, type: 'dashed' },
          symbol: 'none'
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [points, m, eta, rSquared, safeValue95, targetKey, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
});
