import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface MahalanobisChartProps {
    distances: { index: number; id: string; name: string; distance: number; isOutlier: boolean }[];
    threshold: number;
    theme: "light" | "dark";
}

export const MahalanobisChart: React.FC<MahalanobisChartProps> = React.memo(({ distances, threshold, theme }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!distances || distances.length === 0 || !chartRef.current) return;

        if (!instanceRef.current) {
            instanceRef.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
        }

        const isDark = theme === "dark";
        const textColor = isDark ? "#94a3b8" : "#64748b";
        const splitLineColor = isDark ? "#334155" : "#e2e8f0";

        const outlierColor = "#ef4444"; // rose-500
        const normalColor = "#3b82f6"; // blue-500
        
        // Prepare scatter data
        const seriesData = distances.map(d => ({
            value: [d.index, d.distance],
            itemStyle: {
                color: d.isOutlier ? outlierColor : normalColor,
                opacity: 0.8
            },
            ...d
        }));

        const maxDist = Math.max(...distances.map(d => d.distance), threshold);
        const yMax = maxDist * 1.2;

        const option: echarts.EChartsOption = {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "item",
                
         
        formatter: (params: any) => {
                    const data = params.data;
                    return `<div class="font-sans text-xs">
                        <div class="font-bold mb-1">${data.name}</div>
                        <div>距离 (T²): <span class="font-mono font-bold ${data.isOutlier ? 'text-rose-500' : 'text-blue-500'}">${data.distance.toFixed(3)}</span></div>
                        <div class="mt-1">${data.isOutlier ? '<span class="text-rose-500 font-bold">⚠️ 离群批次/异常点</span>' : '<span class="text-emerald-500">✅ 正常批次</span>'}</div>
                    </div>`;
                }
            },
            grid: {
                top: 40,
                right: 30,
                bottom: 40,
                left: 60,
                containLabel: true
            },
            xAxis: {
                type: "value",
                name: "样本序号",
                nameLocation: "middle",
                nameGap: 30,
                min: 0,
                max: distances.length + 1,
                axisLabel: { color: textColor },
                splitLine: { show: false }
            },
            yAxis: {
                type: "value",
                name: "马氏距离 D² (T²)",
                max: yMax,
                axisLabel: { color: textColor },
                splitLine: { 
                    lineStyle: { color: splitLineColor, type: "dashed" } 
                }
            },
            dataZoom: [
                {
                    type: "inside",
                    xAxisIndex: 0,
                    filterMode: "filter"
                },
                {
                    type: "inside",
                    yAxisIndex: 0,
                    filterMode: "empty"
                }
            ],
            series: [
                {
                    type: "scatter",
                    symbolSize: (data: number[]) => {
                        const dist = data[1];
                        return dist > threshold ? 18 : 12; // larger bubble for outliers
                    },
                    data: seriesData,
                    markLine: {
                        symbol: ["none", "none"],
                        silent: true,
                        label: {
                            show: true,
                            position: "insideEndTop",
                            formatter: `控制界限 (χ²阈值): {c}`,
                            color: outlierColor,
                            fontWeight: 'bold',
                            fontSize: 10
                        },
                        lineStyle: {
                            color: outlierColor,
                            type: "dashed",
                            width: 2
                        },
                        data: [
                            { yAxis: threshold }
                        ]
                    }
                }
            ]
        };

        instanceRef.current.setOption(option);

        const ro = new ResizeObserver(() => { if (instanceRef.current) instanceRef.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
    }, [distances, threshold, theme]);

    return (
        <div ref={chartRef} className="w-full h-full min-h-[400px]"></div>
    );
});
