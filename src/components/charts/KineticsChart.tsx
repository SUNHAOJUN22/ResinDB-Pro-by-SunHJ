import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface KineticsChartProps {
    points: { x: number; y: number }[];
    line: { x: number; y: number }[];
    isoCurve: { time: number; alpha: number }[];
    isoTemp: number;
    theme: "light" | "dark";
}

export const KineticsChart: React.FC<KineticsChartProps> = React.memo(({ points, line, isoCurve, isoTemp, theme }) => {
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

        const option: echarts.EChartsOption = {
            backgroundColor: "transparent",
            tooltip: {
                trigger: "axis",
            },
            grid: [
                { top: '15%', bottom: '55%', left: '10%', right: '10%' },
                { top: '60%', bottom: '15%', left: '10%', right: '10%' }
            ],
            xAxis: [
                {
                    gridIndex: 0,
                    type: "value",
                    name: "1000 / Tp (K⁻¹)",
                    nameLocation: "middle",
                    nameGap: 25,
                    scale: true,
                    axisLabel: { 
                        color: textColor,
                        formatter: (val: number) => (val * 1000).toFixed(2)
                    },
                    splitLine: { show: false }
                },
                {
                    gridIndex: 1,
                    type: "value",
                    name: "恒温时间 Time (min)",
                    nameLocation: "middle",
                    nameGap: 25,
                    scale: true,
                    axisLabel: { color: textColor },
                    splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } }
                }
            ],
            yAxis: [
                {
                    gridIndex: 0,
                    type: "value",
                    name: "ln(β / Tp²)",
                    nameLocation: "middle",
                    nameGap: 35,
                    scale: true,
                    axisLabel: { color: textColor },
                    splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } }
                },
                {
                    gridIndex: 1,
                    type: "value",
                    name: "转化率 Conversion (%)",
                    nameLocation: "middle",
                    nameGap: 35,
                    min: 0,
                    max: 100,
                    axisLabel: { color: textColor },
                    splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } }
                }
            ],
            series: [
                // Plot 1: Kissinger Plot
                {
                    name: "实测点",
                    type: "scatter",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: points.map(p => [p.x, p.y]),
                    itemStyle: { color: "#14b8a6" }, // teal-500
                    symbolSize: 10
                },
                {
                    name: "Kissinger 拟合线",
                    type: "line",
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: line.map(p => [p.x, p.y]),
                    itemStyle: { color: "#0f766e" }, // teal-700
                    lineStyle: { width: 2, type: "dashed" },
                    symbol: "none"
                },
                // Plot 2: Isothermal Curing Curve
                {
                    name: `恒温固化模拟 (${isoTemp}°C)`,
                    type: "line",
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: isoCurve.map(p => [p.time, p.alpha]),
                    itemStyle: { color: "#ec4899" }, // pink-500
                    lineStyle: { width: 3 },
                    symbol: "none",
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(236, 72, 153, 0.4)' },
                            { offset: 1, color: 'rgba(236, 72, 153, 0.0)' }
                        ])
                    }
                }
            ]
        };

        instanceRef.current.setOption(option);

        const ro = new ResizeObserver(() => { if (instanceRef.current) instanceRef.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
    }, [points, line, isoCurve, isoTemp, theme]);

    return (
        <div ref={chartRef} className="w-full h-full min-h-[500px]"></div>
    );
});
