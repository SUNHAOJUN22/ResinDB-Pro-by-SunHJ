import * as echarts from "echarts";

export const getParallelChartOption = (
  theme: "light" | "dark",
  data: {
    series: { name: string; value: number[] }[];
    indicators: { name: string; max: number }[];
  },
): echarts.EChartsOption | null => {
  if (!data || !data.series || data.series.length === 0) return null;

  const isDark = theme === "dark";
  const textColor = isDark ? "#94a3b8" : "#64748b";

  const products = data.series || [];
  const dimensions = data.indicators || [];

  if (dimensions.length === 0 || products.length === 0) return null;

  const parallelAxis = dimensions.map((dim, idx) => ({
    dim: idx,
    name: dim.name,
    nameLocation: "end" as const,
    nameTextStyle: {
      color: textColor,
      fontSize: 10,
    },
    axisLine: { lineStyle: { color: isDark ? "#334155" : "#cbd5e1" } },
    axisTick: { lineStyle: { color: isDark ? "#334155" : "#cbd5e1" } },
    axisLabel: { color: textColor, fontSize: 9 },
  }));

  const legendData = products.map((p) => p.name);

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
    },
    legend: {
      data: legendData,
      bottom: 0,
      type: "scroll",
      textStyle: { color: textColor, fontSize: 11 },
    },
    parallelAxis,
    parallel: {
      left: "5%",
      right: "10%",
      bottom: "15%",
      top: "15%",
      parallelAxisDefault: {
        type: "value",
        nameLocation: "end",
        nameGap: 10,
        nameTextStyle: {
          color: textColor,
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: isDark ? "#475569" : "#94a3b8",
          },
        },
        splitLine: {
          show: false,
        },
      },
    },
    series: products.map((p) => ({
      name: p.name,
      type: "parallel",
      lineStyle: {
        width: 2,
        opacity: 0.6,
      },
      emphasis: {
        lineStyle: {
          width: 4,
          opacity: 1,
        },
      },
      data: [p.value],
    })),
  };
};
