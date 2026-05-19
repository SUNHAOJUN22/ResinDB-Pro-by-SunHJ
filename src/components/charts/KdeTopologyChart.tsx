import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface KdeTopologyChartProps {
  grid: {x: number, y: number, z: number}[];
  dataPoints: {x: number, y: number}[];
  xLabel: string;
  yLabel: string;
  theme: "light" | "dark";
}

export const KdeTopologyChart: React.FC<KdeTopologyChartProps> = React.memo(({ grid, dataPoints, xLabel, yLabel, theme }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    const heatmapData = grid.map(p => [p.x, p.y, p.z]);
    const maxZ = Math.max(...grid.map(p => p.z), Number.MIN_VALUE);

    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';

    const option: echarts.EChartsOption = {
      tooltip: {
        position: 'top',
        
         
        formatter: (params: any) => {
           if (params.seriesType === 'scatter') return `Datapoint<br/>${xLabel}: ${params.data[0].toFixed(2)}<br/>${yLabel}: ${params.data[1].toFixed(2)}`;
           return `Density: ${(params.data[2] / maxZ * 100).toFixed(1)}%`;
        }
      },
      grid: {
         top: '10%',
         bottom: '15%',
         left: '10%',
         right: '15%'
      },
      xAxis: {
        type: 'value',
        name: xLabel,
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: yLabel,
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      visualMap: {
        min: 0,
        max: maxZ,
        calculable: true,
        inRange: {
          color: ['#f8fafc', '#bae6fd', '#38bdf8', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e']
        },
        textStyle: { color: textColor },
        show: true
      },
      series: [
        {
          name: 'Density Kernel',
          type: 'heatmap',
          data: heatmapData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        },
        {
          name: 'Original Points',
          type: 'scatter',
          data: dataPoints.map(p => [p.x, p.y]),
          symbolSize: 3,
          itemStyle: {
             color: '#ffffff',
             borderWidth: 0,
             opacity: 0.5
          }
        }
      ]
    };

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [grid, dataPoints, theme, xLabel, yLabel]);

  return <div ref={chartRef} className="w-full h-full" />;
});
