import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface SobolChartProps {
  firstOrder: { name: string; value: number }[];
  totalEffect: { name: string; value: number }[];
  interactions: { name: string; value: number }[];
  theme: "light" | "dark";
}

export const SobolChart: React.FC<SobolChartProps> = React.memo(({ firstOrder, totalEffect, interactions, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const splitLineColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    const names = totalEffect.map(item => item.name);
    // Reverse arrays for horizontal bar chart (so top item is at the top)
    names.reverse();
    const firstOrderData = firstOrder.map(item => item.value).reverse();
    const interactionsData = interactions.map(item => item.value).reverse();

    const option: echarts.EChartsOption = {
      title: {
         text: 'Sobol Sensitivity Indices',
         left: 'center',
         textStyle: { color: textColor, fontSize: 13 }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        
         
        formatter: (params: any) => {
            const name = params[0].name;
            const first = params.find((p: any  ) => p.seriesName === 'First-Order (Main Effect)')?.value || 0;
            const inter = params.find((p: any  ) => p.seriesName === 'Interactions (Coupling)')?.value || 0;
            const total = first + inter;
            return `<strong>${name}</strong><br/>
                    Total Effect (S_T): ${total.toFixed(4)}<br/>
                    First-Order (S_A): ${first.toFixed(4)}<br/>
                    Interactions (S_i - S_A): ${inter.toFixed(4)}`;
        }
      },
      legend: {
        bottom: '0%',
        textStyle: { color: textColor }
      },
      grid: { top: '15%', bottom: '15%', left: '3%', right: '8%', containLabel: true },
      xAxis: {
        type: 'value',
        name: 'Sensitivity Index',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: textColor },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { color: textColor, width: 120, overflow: 'break' },
        axisTick: { show: false }
      },
      series: [
        {
          name: 'First-Order (Main Effect)',
          type: 'bar',
          stack: 'total',
          data: firstOrderData,
          itemStyle: { color: '#3b82f6' }, // blue-500
          barMaxWidth: 30
        },
        {
          name: 'Interactions (Coupling)',
          type: 'bar',
          stack: 'total',
          data: interactionsData,
          itemStyle: { color: '#f59e0b' }, // amber-500
          barMaxWidth: 30
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [firstOrder, interactions, totalEffect, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
});
