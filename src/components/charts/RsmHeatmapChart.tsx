import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface RsmHeatmapChartProps {
  grid: {x1: number, x2: number, y: number}[][];
  stationaryPoint?: {x1: number, x2: number, y: number} | null;
  minX1: number;
  maxX1: number;
  minX2: number;
  maxX2: number;
  dataPoints: {x1: number, x2: number, y: number}[];
  x1Label: string;
  x2Label: string;
  yLabel: string;
  theme: "light" | "dark";
}

export const RsmHeatmapChart: React.FC<RsmHeatmapChartProps> = React.memo(({ 
  grid, stationaryPoint, minX1: _minX1, maxX1: _maxX1, minX2: _minX2, maxX2: _maxX2, dataPoints, x1Label, x2Label, yLabel, theme 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    }
    
    // Transform grid into [x1, x2, y] array for heatmap/contour
    const heatmapData: [number, number, number][] = [];
    grid.forEach(row => {
      row.forEach(cell => {
        heatmapData.push([cell.x1, cell.x2, cell.y]);
      });
    });
    
    const scatterData = dataPoints.map(p => [p.x1, p.x2, p.y]);
    
    const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
    

    const option: echarts.EChartsOption = {
      tooltip: {
        position: 'top'
      },
      grid: {
         top: '10%',
         bottom: '15%',
         left: '10%',
         right: '15%'
      },
      xAxis: {
        type: 'value',
        name: x1Label,
        nameLocation: 'middle',
        nameGap: 30,
        min: 'dataMin',
        max: 'dataMax',
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: x2Label,
        nameLocation: 'middle',
        nameGap: 50,
        min: 'dataMin',
        max: 'dataMax',
        axisLabel: { color: textColor },
        splitLine: { show: false }
      },
      visualMap: {
        min: Math.min(...heatmapData.map(d => d[2])),
        max: Math.max(...heatmapData.map(d => d[2])),
        calculable: true,
        realtime: false,
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        },
        textStyle: { color: textColor },
        right: 0,
        top: 'middle'
      },
      series: [
        {
          name: 'Response Surface',
          type: 'heatmap',
          data: heatmapData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          tooltip: {
               
         
        formatter: (params: any) => {
                   return `${x1Label}: ${params.data[0].toFixed(2)}<br/>${x2Label}: ${params.data[1].toFixed(2)}<br/>${yLabel}: ${params.data[2].toFixed(2)}`;
               }
          }
        },
        {
          name: 'Original Points',
          type: 'scatter',
          data: scatterData,
          itemStyle: {
             color: '#ffffff',
             borderColor: '#000000',
             borderWidth: 1
          },
          tooltip: {
             
         
        formatter: (params: any) => {
                 return `Actual Data<br/>${x1Label}: ${params.data[0].toFixed(2)}<br/>${x2Label}: ${params.data[1].toFixed(2)}<br/>${yLabel}: ${params.data[2].toFixed(2)}`;
             }
          }
        }
      ]
    };
    
    if (stationaryPoint) {
         // Add stationary point as a distinct marker
         (option.series as Array<Record<string, unknown>>).push({
             name: 'Stationary Point',
             type: 'scatter',
             data: [[stationaryPoint.x1, stationaryPoint.x2, stationaryPoint.y]],
             symbol: 'diamond',
             symbolSize: 15,
             itemStyle: {
                 color: '#ff00ff',
                 borderColor: '#ffffff',
                 borderWidth: 2
             },
             zlevel: 10,
             tooltip: {
                 
         
        formatter: (params: any) => {
                     return `<strong>Optimal / Stationary Point</strong><br/>${x1Label}: ${params.data[0].toFixed(2)}<br/>${x2Label}: ${params.data[1].toFixed(2)}<br/>${yLabel}: ${params.data[2].toFixed(2)}`;
                 }
             }
         });
    }

    chartInstance.current.setOption(option);
    
    const ro = new ResizeObserver(() => { if(chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [grid, stationaryPoint, dataPoints, theme, x1Label, x2Label, yLabel]);

  return <div ref={chartRef} className="w-full h-full" />;
});
