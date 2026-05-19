import * as echarts from "echarts";

// Chart: MFR vs Density Scatter Plot Option Configuration - Scientific Refinement
export const getMfrDensityChartOption = (
  data: { series?: unknown[]; xAxis?: string; yAxis?: string } | unknown[],
  theme: "light" | "dark",
): echarts.EChartsOption => {
  const isDark = theme === "dark";
  const colorPalette = ["#0ea5e9", "#f43f5e", "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#8b5cf6"];
  const axisColor = isDark ? "#94a3b8" : "#475569";
  const gridLineColor = isDark ? "rgba(148, 163, 184, 0.05)" : "rgba(100, 116, 139, 0.05)";

  const seriesData = (
    Array.isArray(data)
      ? data
      : (data as { series?: { name: string; data: unknown[] }[] }).series || []
  ) as { name: string; data: unknown[] }[];

  const typedData = data as { xAxis?: string; yAxis?: string; xBounds?: { min: number; max: number }; yBounds?: { min: number; max: number } };

  const xAxisName = Array.isArray(data) ? "Density" : typedData.xAxis || "Density";
  const yAxisName = Array.isArray(data) ? "MFR" : typedData.yAxis || "MFR";

  return {
    backgroundColor: "transparent",
    color: colorPalette,
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
      formatter: (params: { value: [number, number, string]; color?: string }) => {
        const val = params.value;
        return `
          <div style="font-weight: 800; margin-bottom: 6px;">${val[2]}</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; gap: 20px;">
              <span style="color: #94a3b8;">${xAxisName}:</span>
              <span style="font-weight: 700; color: ${params.color}">${val[0]}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 20px;">
              <span style="color: #94a3b8;">${yAxisName}:</span>
              <span style="font-weight: 700; color: ${params.color}">${val[1]}</span>
            </div>
          </div>
        `;
      },
      extraCssText: "box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border-radius: 12px;",
    },
    legend: {
      bottom: 0,
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: axisColor, fontSize: 10, fontWeight: 600 },
      type: "scroll",
    },
    xAxis: {
      type: "value",
      name: xAxisName,
      nameLocation: "middle",
      nameGap: 30,
      scale: true,
      min: typedData.xBounds?.min,
      max: typedData.xBounds?.max,
      nameTextStyle: { color: axisColor, fontWeight: 700, fontSize: 12 },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLabel: { 
        color: axisColor, 
        fontSize: 10, 
        fontFamily: "'JetBrains Mono', monospace",
        formatter: (value: number) => value.toString()
      },
      axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" } },
    },
    yAxis: {
      type: "log",
      name: yAxisName,
      nameLocation: "middle",
      nameGap: 40,
      min: typedData.yBounds?.min,
      max: typedData.yBounds?.max,
      nameTextStyle: { color: axisColor, fontWeight: 700, fontSize: 12 },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLabel: { 
        color: axisColor, 
        fontSize: 10, 
        fontFamily: "'JetBrains Mono', monospace",
        formatter: (value: number) => value < 1 ? value.toString() : Math.round(value).toString()
      },
      axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" } },
    },
    series: seriesData.map((s) => ({
      name: s.name,
      type: "scatter" as const,
      symbolSize: 12,
      itemStyle: {
        opacity: 0.65,
        borderColor: "#fff",
        borderWidth: 1.5,
        shadowBlur: 5,
        shadowColor: "rgba(0,0,0,0.1)",
      },
      emphasis: {
        itemStyle: { opacity: 1, borderWidth: 2, scale: 1.3 }
      },
      data: s.data.filter((d: [number, number, string]) => d[0] > 0 && d[1] > 0),
    })),
    animationDuration: 1200,
    animationEasing: "cubicOut",
  };
};
