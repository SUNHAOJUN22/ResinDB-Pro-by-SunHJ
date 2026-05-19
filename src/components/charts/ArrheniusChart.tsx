import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface ArrheniusChartProps {
  points: { tempC: number; time: number; x: number; y: number }[];
  equation: { m: number; b: number };
  rSquared: number;
  theme: "light" | "dark";
}

export const ArrheniusChart: React.FC<ArrheniusChartProps> = React.memo(({ points, equation, rSquared, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const splitLineColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    // X-axis plotted as 1000/T for readability, standard in Arrhenius plots
    const scatterData = points.map(pt => [pt.x * 1000, pt.y, pt.tempC, pt.time]);
    
    const minX = Math.min(...points.map(pt => pt.x));
    const maxX = Math.max(...points.map(pt => pt.x));
    
    const range = maxX - minX;
    // Add margin for visual fit line
    const lineStartX = minX - (range || 0.001) * 0.1;
    const lineEndX = maxX + (range || 0.001) * 0.1;

    const lineData = [
       [lineStartX * 1000, equation.m * lineStartX + equation.b],
       [lineEndX * 1000, equation.m * lineEndX + equation.b]
    ];

    const option: echarts.EChartsOption = {
      title: {
         text: 'Arrhenius Plot',
         left: 'center',
         textStyle: { color: textColor, fontSize: 13 }
      },
      tooltip: {
        
         
        formatter: (params: any) => {
           if (params.seriesType === 'scatter') {
               return `<strong>${params.data[2]} °C</strong><br/>1000/T: ${params.data[0].toFixed(3)} K⁻¹<br/>ln(time): ${params.data[1].toFixed(3)}<br/>Time: ${params.data[3].toFixed(1)} hrs`;
           }
           return `Linear Fit<br/>R² = ${rSquared.toFixed(4)}`;
        }
      },
      grid: { top: '15%', bottom: '15%', left: '12%', right: '10%' },
      xAxis: {
        type: 'value',
        name: '1000 / T (K⁻¹)',
        nameLocation: 'middle',
        nameGap: 25,
        scale: true,
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'ln(time)',
        nameLocation: 'middle',
        nameGap: 35,
        scale: true,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      series: [
        {
          name: 'Experimental Data',
          type: 'scatter',
          data: scatterData,
          itemStyle: { color: '#ea580c' }, // orange-600
          symbolSize: 8
        },
        {
          name: 'Fit Line',
          type: 'line',
          data: lineData,
          itemStyle: { color: '#ef4444' }, // red border
          lineStyle: { width: 2, type: 'dashed' },
          symbol: 'none'
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [points, equation, rSquared, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
});
