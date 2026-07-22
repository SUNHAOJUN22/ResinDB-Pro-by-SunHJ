import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface WlfTtsChartProps {
  c1: number;
  c2: number;
  refTemp: number;
  shiftFactors: { temp: number; aT: number }[];
  masterCurve: { temp: number; points: { rate: number; visc: number; originalRate: number; originalVisc: number }[] }[];
  theme: "light" | "dark";
}

export const WlfTtsChart: React.FC<WlfTtsChartProps> = React.memo(({ c1, c2, refTemp, shiftFactors, masterCurve, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const splitLineColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    const series: echarts.ScatterSeriesOption[] = [];
    
    masterCurve.forEach(mc => {
        const scatterData = mc.points.map(p => [p.rate, p.visc]);
        series.push({
            name: `${mc.temp} °C`,
            type: 'scatter',
            data: scatterData,
            symbolSize: 6,
            tooltip: {
               
         
        formatter: (params: any) => {
                   return `<strong>${mc.temp} °C</strong><br/>Shifted Rate (ώ*aT): ${params.data[0].toExponential(2)}<br/>Shifted Visc (η/aT): ${params.data[1].toExponential(2)}`;
               }
            }
        });
    });

    const option: echarts.EChartsOption = {
      title: {
         text: `Master Curve (T_ref = ${refTemp} °C)`,
         left: 'center',
         textStyle: { color: textColor, fontSize: 14 }
      },
      tooltip: {
        trigger: 'item'
      },
      legend: {
         bottom: 0,
         textStyle: { color: textColor }
      },
      grid: {
         top: '15%',
         bottom: '20%',
         left: '10%',
         right: '10%',
         containLabel: true
      },
      xAxis: {
        type: 'log',
        name: 'Shifted Frequency / Shear Rate, rad/s (ω·aT)',
        nameLocation: 'middle',
        nameGap: 25,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      yAxis: {
        type: 'log',
        name: 'Shifted Complex Viscosity, Pa·s (η/aT)',
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      series
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [c1, c2, refTemp, shiftFactors, masterCurve, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
});
