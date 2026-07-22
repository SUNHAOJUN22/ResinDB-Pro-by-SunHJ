import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface PronyChartProps {
    points: { omega: number; storage: number; loss: number; storage_fit: number; loss_fit: number }[];
    theme: "light" | "dark";
}

export const PronyChart: React.FC<PronyChartProps> = React.memo(({ points, theme }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        if (!instanceRef.current) {
            instanceRef.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
        }

        const isDark = theme === "dark";
        const textColor = isDark ? "#94a3b8" : "#64748b";
        const splitLineColor = isDark ? "#334155" : "#e2e8f0";

        // Sort points to make lines continuous
        const sorted = [...points].sort((a,b)=>a.omega - b.omega);

        const option: echarts.EChartsOption = {
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" },
            legend: {
                data: ["E' (Storage)", "E'' (Loss)", "E' Fit", "E'' Fit"],
                textStyle: { color: textColor }
            },
            grid: { top: 50, right: 30, bottom: 40, left: 60, containLabel: true },
            xAxis: {
                type: "log",
                name: "频率 ω (rad/s)",
                nameLocation: "middle",
                nameGap: 25,
                axisLabel: { color: textColor },
                splitLine: { show: false }
            },
            yAxis: {
                type: "log",
                name: "模量 Modulus (MPa)",
                nameGap: 30,
                axisLabel: { color: textColor },
                splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } }
            },
            series: [
                {
                    name: "E' (Storage)",
                    type: "scatter",
                    data: sorted.map(p => [p.omega, p.storage]),
                    itemStyle: { color: "#3b82f6" }, // blue-500
                    symbol: "circle",
                    symbolSize: 8
                },
                {
                    name: "E'' (Loss)",
                    type: "scatter",
                    data: sorted.map(p => [p.omega, p.loss]),
                    itemStyle: { color: "#ef4444" }, // red-500
                    symbol: "triangle",
                    symbolSize: 8
                },
                {
                    name: "E' Fit",
                    type: "line",
                    data: sorted.map(p => [p.omega, p.storage_fit]),
                    itemStyle: { color: "#1e3a8a" }, // blue-900
                    lineStyle: { width: 2 },
                    symbol: "none",
                    smooth: true
                },
                {
                    name: "E'' Fit",
                    type: "line",
                    data: sorted.map(p => [p.omega, p.loss_fit]),
                    itemStyle: { color: "#7f1d1d" }, // red-900
                    lineStyle: { width: 2, type: "dashed" },
                    symbol: "none",
                    smooth: true
                }
            ]
        };

        instanceRef.current.setOption(option);

        const ro = new ResizeObserver(() => { if (instanceRef.current) instanceRef.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
    }, [points, theme]);

    return (
        <div ref={chartRef} className="w-full h-full min-h-[400px]"></div>
    );
});
