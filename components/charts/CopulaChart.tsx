import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface CopulaChartProps {
  grid: {u: number, v: number, z: number}[];
  theme: "light" | "dark";
}

export const CopulaChart: React.FC<CopulaChartProps> = React.memo(({ grid, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const heatmapData = grid.map(p => [p.u, p.v, p.z]);
    const maxZ = Math.max(...grid.map(p => p.z), Number.MIN_VALUE);

    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';

    const option: echarts.EChartsOption = {
      title: {
         text: 'Copula Joint Probability Density c(u, v)',
         left: 'center',
         textStyle: { color: textColor, fontSize: 13 }
      },
      tooltip: {
        position: 'top',
        
         
        formatter: (params: any) => {
           return `CDF u: ${params.data[0].toFixed(2)}<br/>CDF v: ${params.data[1].toFixed(2)}<br/>Density: ${params.data[2].toFixed(2)}`;
        }
      },
      grid: {
         top: '15%',
         bottom: '15%',
         left: '10%',
         right: '15%'
      },
      xAxis: {
        type: 'value',
        name: 'u (ECDF of X)',
        nameLocation: 'middle',
        nameGap: 30,
        min: 0,
        max: 1,
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'v (ECDF of Y)',
        nameLocation: 'middle',
        nameGap: 40,
        min: 0,
        max: 1,
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      visualMap: {
        min: 0,
        max: Math.min(maxZ, 5), // Cap max visual representation for better contrast
        calculable: true,
        inRange: {
          color: ['#f8fafc', '#bae6fd', '#38bdf8', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e']
        },
        textStyle: { color: textColor },
        show: true
      },
      series: [
        {
          name: 'Copula Density',
          type: 'heatmap',
          data: heatmapData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [grid, theme]);

  return <div ref={chartRef} className="w-full h-full" />;
});
