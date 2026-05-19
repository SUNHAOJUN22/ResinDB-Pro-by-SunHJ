import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface MooChartProps {
    evaluatedCandidates: { params: Record<string, number>; means: Record<string, number> }[];
    paretoFront: { params: Record<string, number>; means: Record<string, number>; stds: Record<string, number> }[];
    historical: Record<string, number>[];
    targets: { name: string; maximize: boolean }[];
    theme: "light" | "dark";
}

export const MooChart: React.FC<MooChartProps> = React.memo(({ evaluatedCandidates, paretoFront, historical, targets, theme }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!chartRef.current) return;
        if (!instanceRef.current) {
            instanceRef.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
        }

        if (targets.length !== 2) {
            // Plot is optimized for exactly 2 targets
            return;
        }

        const tX = targets[0];
        const tY = targets[1];

        const isDark = theme === "dark";
        const textColor = isDark ? "#94a3b8" : "#64748b";
        const splitLineColor = isDark ? "#334155" : "#e2e8f0";

        // Separate points by type
        const bgPoints = evaluatedCandidates.map(c => [c.means[tX.name], c.means[tY.name]]);
        
        // Sort pareto front to form a continuous line
        const sortedPareto = [...paretoFront].sort((a, b) => a.means[tX.name] - b.means[tX.name]);
        const paretoPoints = sortedPareto.map(p => [p.means[tX.name], p.means[tY.name]]);
        const histPoints = historical.map(h => [h[tX.name], h[tY.name]]);

        const option: echarts.EChartsOption = {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "item",
                
                 
                formatter: function (params: any) {
                    if (params.seriesName === "Pareto Front") {
                        const pt = sortedPareto[params.dataIndex];
                        let tip = `<b>Pareto Optimal Point</b><br />`;
                        tip += `${tX.name}: ${pt.means[tX.name].toFixed(4)}<br />`;
                        tip += `${tY.name}: ${pt.means[tY.name].toFixed(4)}<br />`;
                        tip += `<hr style="margin: 4px 0; border-color: ${splitLineColor}" />`;
                        tip += `<div style="font-size: 10px; color: ${textColor}">Recommended Formulation:</div>`;
                        Object.keys(pt.params).forEach(k => {
                            tip += `<div style="font-size: 10px">${k}: ${pt.params[k].toFixed(4)}</div>`;
                        });
                        return tip;
                    } else if (params.seriesName === "Historical Data") {
                         return `<b>Historical Point</b><br />${tX.name}: ${params.value[0].toFixed(2)}<br />${tY.name}: ${params.value[1].toFixed(2)}`;
                    } else {
                         return `<b>Evaluated Formulation</b><br />${tX.name}: ${params.value[0].toFixed(2)}<br />${tY.name}: ${params.value[1].toFixed(2)}`;
                    }
                }
            },
            legend: {
                data: ["Historical Data", "Evaluated Pool", "Pareto Front"],
                textStyle: { color: textColor }
            },
            grid: { top: 40, right: 30, bottom: 40, left: 50, containLabel: true },
            xAxis: {
                type: "value",
                name: `${tX.name} ${tX.maximize ? '(Max)' : '(Min)'}`,
                nameLocation: 'middle',
                nameGap: 25,
                scale: true,
                axisLabel: { color: textColor },
                splitLine: { show: false }
            },
            yAxis: {
                type: "value",
                name: `${tY.name} ${tY.maximize ? '(Max)' : '(Min)'}`,
                nameLocation: 'middle',
                nameGap: 35,
                scale: true,
                axisLabel: { color: textColor },
                splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } }
            },
            series: [
                {
                    name: "Evaluated Pool",
                    type: "scatter",
                    data: bgPoints,
                    itemStyle: { color: isDark ? "#4b5563" : "#cbd5e1" }, // slate-600 / slate-300
                    symbolSize: 4
                },
                {
                    name: "Historical Data",
                    type: "scatter",
                    data: histPoints,
                    itemStyle: { color: "#3b82f6" }, // blue-500
                    symbolSize: 8,
                    symbol: "triangle"
                },
                {
                    name: "Pareto Front",
                    type: "line",
                    data: paretoPoints,
                    itemStyle: { color: "#ea580c" }, // orange-600
                    lineStyle: { color: "#ea580c", width: 3 },
                    symbol: "circle",
                    symbolSize: 10,
                    zlevel: 10
                }
            ]
        };

        instanceRef.current.setOption(option);

        const ro = new ResizeObserver(() => { if (instanceRef.current) instanceRef.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
    }, [evaluatedCandidates, paretoFront, historical, targets, theme]);

    return (
        <div ref={chartRef} className="w-full h-full min-h-[400px]"></div>
    );
});
