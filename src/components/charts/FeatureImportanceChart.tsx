import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface FeatureImportanceChartProps {
  importances: { feature: string; importance: number; positive: boolean }[];
  theme: "light" | "dark";
}

export const FeatureImportanceChart: React.FC<FeatureImportanceChartProps> = React.memo(({ importances, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    // Sort ascending for bottom-up horizontal bar visualization
    const sorted = [...importances].sort((a, b) => a.importance - b.importance);
    
    const categories = sorted.map(d => d.feature);
    const dataVals = sorted.map(d => ({
        value: d.importance * 100, // as percentage
        itemStyle: {
            color: d.positive ? '#10b981' : '#f43f5e' // emerald for pos, rose for neg
        }
    }));
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    const splitLineColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        
         
        formatter: (params: any) => {
           const p = params[0];
           const dir = sorted[p.dataIndex].positive ? 'Positive' : 'Negative';
           return `<strong>${p.name}</strong><br/>Weight: ${p.value.toFixed(2)}%<br/>Impact: ${dir}`;
        }
      },
      grid: {
         top: '5%',
         bottom: '10%',
         left: '10%',
         right: '5%',
         containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Relative Importance (%)',
        nameLocation: 'middle',
        nameGap: 25,
        axisLabel: { color: textColor, formatter: '{value}%' },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: textColor, width: 120, overflow: 'truncate' },
        axisTick: { show: false },
        splitLine: { show: false }
      },
      series: [
        {
          name: 'Importance',
          type: 'bar',
          data: dataVals,
          label: {
              show: true,
              position: 'right',
              formatter: '{c}%',
              color: textColor
          },
          barMaxWidth: 30,
          itemStyle: {
              borderRadius: [0, 4, 4, 0]
          }
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [importances, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
});
