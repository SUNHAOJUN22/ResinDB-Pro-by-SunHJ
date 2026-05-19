import * as echarts from "echarts";

interface RadarData {
  name: string;
  value: number[];
}

interface Indicator {
  name: string;
  max?: number;
  min?: number;
}

// Chart: "Performance Fingerprint" Radar Chart Option Configuration
export const getRadarChartOption = (
  data: RadarData[],
  theme: "light" | "dark",
  customIndicators?: Indicator[],
): echarts.EChartsOption => {
  const isDark = theme === "dark";
  const colorPalette = ["#0284c7", "#06b6d4", "#14b8a6", "#6366f1", "#f59e0b"];

  // Define indicators: 6 Metrics for high-impact visual fingerprinting.
  const defaultIndicators: Indicator[] = [
    { name: "流动性\nFlow", max: 100 },
    { name: "硬度刚性\nRigidity", max: 3000 },
    { name: "耐热性\nThermal", max: 250 },
    { name: "拉伸性能\nTensile", max: 100 },
    { name: "冲击强度\nImpact", max: 100 },
    { name: "综合数据\nQuality", max: 100 },
  ];

  const indicators = customIndicators || defaultIndicators;

  return {
    backgroundColor: "transparent",
    color: colorPalette,
    title: {
      text: "多维性能指纹 (Performance Fingerprint)",
      subtext: "刚柔加工对标 (Benchmarking)",
      left: "center",
      top: 5,
      textStyle: {
        color: isDark ? "#e2e8f0" : "#333333",
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Inter, Arial, sans-serif",
      },
    },
    tooltip: {
      trigger: "item",
      confine: true,
      backgroundColor: isDark
        ? "rgba(15, 23, 42, 0.9)"
        : "rgba(255, 255, 255, 0.95)",
      borderColor: isDark ? "#334155" : "#eeeeee",
      borderWidth: 1,
      textStyle: { color: isDark ? "#f8fafc" : "#333333" },
    },
    legend: {
      bottom: 5,
      data: data.map((d) => d.name),
      textStyle: { color: isDark ? "#94a3b8" : "#666666" },
    },
    toolbox: {
      feature: {
        saveAsImage: { name: 'radar_benchmark', pixelRatio: 2 }
      },
      iconStyle: { borderColor: isDark ? '#94a3b8' : '#475569' }
    },
    radar: {
      indicator: indicators,
      shape: "polygon",
      splitNumber: 5,
      center: ["50%", "52%"],
      radius: "60%",
      axisName: {
        color: isDark ? "#94a3b8" : "#475569",
        fontWeight: 600,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', Inter, monospace"
      },
      splitLine: {
        lineStyle: {
          color: isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(100, 116, 139, 0.1)",
        },
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: isDark
            ? ["rgba(30, 41, 59, 0.3)", "rgba(15, 23, 42, 0.2)"]
            : ["rgba(241, 245, 249, 0.5)", "rgba(255, 255, 255, 0.1)"],
        },
      },
      axisLine: {
        lineStyle: {
          color: isDark ? "rgba(148, 163, 184, 0.15)" : "rgba(100, 116, 139, 0.15)",
        },
      },
    },
    series: [
      {
        name: "Performance Fingerprint",
        type: "radar",
        data: data.map((item) => ({
          value: item.value,
          name: item.name,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, opacity: 0.8 },
          areaStyle: { opacity: 0.1 },
          itemStyle: { opacity: 0.8 }
        })),
        animationDuration: 1200,
        animationEasing: "cubicOut",
      },
    ],
  };
};
