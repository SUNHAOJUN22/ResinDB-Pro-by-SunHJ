import * as echarts from "echarts";
import { materialEngine } from "../../lib/materialScience";

// Chart 2: "Ashby" Scatter Plot Option Configuration - High-Performance Version
export const getAshbyChartOption = (
  data: { series?: unknown[]; xAxis?: string; yAxis?: string } | unknown[],
  theme: "light" | "dark",
): echarts.EChartsOption => {
  const isDark = theme === "dark";
  const colorPalette = ["#3b82f6", "#f43f5e", "#10b981", "#8b5cf6", "#f59e0b"];
  const axisColor = isDark ? "#94a3b8" : "#475569";
  const gridLineColor = isDark ? "rgba(148, 163, 184, 0.05)" : "rgba(100, 116, 139, 0.05)";

  const seriesData = (
    Array.isArray(data)
      ? data
      : (data as { series?: { name: string; data: unknown[] }[] }).series || []
  ) as { name: string; data: unknown[] }[];
  
  const typedData = data as { xAxis?: string; yAxis?: string; xBounds?: { min: number; max: number }; yBounds?: { min: number; max: number } };
  
  const xAxisName = Array.isArray(data) ? "MFR" : typedData.xAxis || "X Axis";
  const yAxisName = Array.isArray(data) ? "Impact" : typedData.yAxis || "Y Axis";

  // Filter valid positive values for log scale
  const allPoints: [number, number][] = seriesData.flatMap((s) =>
    (s.data as [number, number, string][]).map((p) => [Number(p[0]), Number(p[1])]),
  ).filter(p => !isNaN(p[0]) && !isNaN(p[1]) && p[0] > 0 && p[1] > 0) as [number, number][];

  const logCorrelation = allPoints.length > 5 ? materialEngine.analyzeCorrelationLog(allPoints) : null;
  const regressionFn = logCorrelation 
    ? (x: number) => logCorrelation.regressionFn(x) 
    : (allPoints.length > 1 ? ((x: number) => {
        const linear = materialEngine.analyzeCorrelation(allPoints);
        return linear ? linear.slope * x + linear.intercept : 0;
      }) : ((_x: number) => 0));

  const minX = typedData.xBounds?.min || (allPoints.length > 0 ? Math.min(...allPoints.map((p) => p[0]), 0.1) : 0.1);
  const maxX = typedData.xBounds?.max || (allPoints.length > 0 ? Math.max(...allPoints.map((p) => p[0]), 100) : 100);

  // Identify Pareto Frontier (Optimal materials)
  const pointsForPareto = (seriesData as { data: [number, number, string][] }[]).flatMap(s => 
    s.data.map(d => ({ x: Number(d[0]), y: Number(d[1]), name: String(d[2]) }))
  ).filter(p => p.x > 0 && p.y > 0);
  const paretoNames = materialEngine.getParetoPoints(pointsForPareto);

  const statsLabel = logCorrelation
    ? `Power Law Fit: R² = ${logCorrelation.r2.toFixed(3)} | y = ${logCorrelation.c.toExponential(1)}x^(${logCorrelation.k.toFixed(2)})`
    : (allPoints.length > 1 ? "Linear Fit Displayed" : "");

  return {
    backgroundColor: "transparent",
    color: colorPalette,
    graphic: [
      {
        type: "text",
        left: "12%",
        top: "12%",
        style: {
          text: statsLabel,
          fill: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
          font: "bold 10px 'JetBrains Mono', monospace"
        }
      }
    ],
    grid: {
      left: "10%",
      right: "10%",
      bottom: "15%",
      top: "10%",
      containLabel: true,
    },
    tooltip: {
      trigger: "item",
      padding: 12,
      backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.98)",
      borderColor: isDark ? "#334155" : "#e2e8f0",
      textStyle: { color: isDark ? "#f1f5f9" : "#1e293b", fontSize: 12 },
      // @ts-expect-error - ECharts type mismatch
      formatter: (params: { value: [number, number, string]; seriesName?: string }) => {
        const val = params.value;
        const isPareto = paretoNames.includes(val[2]);
        return `
          <div style="font-weight: 800; margin-bottom: 6px;">${val[2]}</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: 0.8;">
            <div style="display: flex; justify-content: space-between; gap: 15px;">
              <span>${xAxisName}:</span>
              <span style="font-weight: 700;">${val[0]}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 15px;">
              <span>${yAxisName}:</span>
              <span style="font-weight: 700;">${val[1]}</span>
            </div>
            ${isPareto ? '<div style="margin-top: 8px; color: #10b981; font-weight: 900; font-size: 10px; text-transform: uppercase; border-top: 1px solid rgba(16, 185, 129, 0.2); padding-top: 4px;">★ 帕累托最优材质 (Pareto Optimal)</div>' : ''}
          </div>
        `;
      },
      extraCssText: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 12px;",
    },
    legend: {
      bottom: 0,
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: axisColor, fontSize: 10, fontWeight: 600 },
      type: "scroll",
    },
    xAxis: {
      type: "log",
      name: xAxisName,
      nameLocation: "middle",
      nameGap: 30,
      min: typedData.xBounds?.min,
      max: typedData.xBounds?.max,
      nameTextStyle: { color: axisColor, fontWeight: 700, fontSize: 11 },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLabel: { 
        color: axisColor, 
        fontSize: 9, 
        fontFamily: "'JetBrains Mono', monospace",
        formatter: (value: number) => {
          if (value >= 1000) return (value / 1000) + 'k';
          if (value < 1) return value.toFixed(1);
          return value.toString();
        }
      },
      axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" } },
    },
    yAxis: {
      type: "log",
      name: yAxisName,
      nameLocation: "middle",
      nameGap: 45,
      min: typedData.yBounds?.min,
      max: typedData.yBounds?.max,
      nameTextStyle: { color: axisColor, fontWeight: 700, fontSize: 11 },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLabel: { 
        color: axisColor, 
        fontSize: 9, 
        fontFamily: "'JetBrains Mono', monospace",
        formatter: (value: number) => {
          if (value >= 1000) return (value / 1000) + 'k';
          if (value < 1) return value.toFixed(1);
          return value.toString();
        }
      },
      axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" } },
    },
    series: [
      ...seriesData.map((s) => ({
        name: s.name,
        type: "scatter" as const,
        symbolSize: 10,
        itemStyle: {
          opacity: 0.7,
          borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
          borderWidth: 1,
          shadowBlur: 8,
          shadowColor: "rgba(0,0,0,0.05)"
        },
        emphasis: {
          itemStyle: { opacity: 1, borderWidth: 2, scale: 1.4 }
        },
        data: s.data.filter((d: [number, number, string]) => d[0] > 0 && d[1] > 0),
      })),
      {
        name: "Trend",
        type: "line",
        data: [[minX, regressionFn(minX)], [maxX, regressionFn(maxX)]],
        lineStyle: { type: "dashed", color: isDark ? "#4b5563" : "#9ca3af", width: 1.5, opacity: 0.4 },
        symbol: "none",
        silent: true,
      }
    ],
    animationDuration: 1200,
    animationEasing: "exponentialOut",
  };
};
