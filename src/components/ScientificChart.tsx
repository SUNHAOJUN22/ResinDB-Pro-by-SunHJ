import React, { useEffect, useRef, useState, useCallback } from "react";
import * as echarts from "echarts";
import {
  Loader2,
  AlertCircle,
  Database,
  ChevronDown,
  ChevronRight,
  Bug,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { getRadarChartOption } from "@/components/charts/RadarBenchmark";
import { getAshbyChartOption } from "@/components/charts/AshbyScatter";
import { getGpcChartOption } from "@/components/charts/GpcDistribution";
import { getRheologyChartOption } from "@/components/charts/RheologyCurve";
import { getMfrDensityChartOption } from "@/components/charts/MfrDensityScatter";
import { getParallelChartOption } from "@/components/charts/ParallelCoordinates";
import { Product } from "@/types";

import { motion, AnimatePresence } from "motion/react";

export type ChartType =
  | "radar"
  | "ashby"
  | "gpc"
  | "rheology"
  | "mfr_density"
  | "parallel";

interface ScientificChartProps {
  type: ChartType;
  data: unknown;
  loading?: boolean;
  className?: string;
  height?: string | number;
  onChartReady?: (instance: echarts.ECharts) => void;
}

export const ScientificChart: React.FC<ScientificChartProps> = ({
  type,
  data,
  loading = false,
  className = "",
  height = "100%",
  onChartReady,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const { theme } = useTheme();

  const [error, setError] = useState<string | null>(null);
  const [isChartEmpty, setIsChartEmpty] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const disposeChart = useCallback(() => {
    if (chartInstance.current) {
      if (!chartInstance.current.isDisposed()) {
        chartInstance.current.dispose();
      }
      chartInstance.current = null;
    }
  }, []);

  const validateData = useCallback(() => {
    if (!data) return false;

    // Rheology expects { products: [], temps: [] }
    if (type === "rheology") {
      const rData = data as { products?: unknown[] };
      return (
        rData.products &&
        Array.isArray(rData.products) &&
        rData.products.length > 0
      );
    }

    // For Radar, ensure there are values and they are not all empty/NaN
    if (type === "radar") {
      const rData = data as { series?: unknown[] };
      const radarSeries = rData.series || (Array.isArray(data) ? data : []);
      if (!Array.isArray(radarSeries) || radarSeries.length === 0) return false;
      return radarSeries.some(
        (d: { value?: unknown[] }) =>
          d.value &&
          Array.isArray(d.value) &&
          d.value.some(
            (v: unknown) => v !== undefined && v !== null && !isNaN(Number(v)),
          ),
      );
    }

    if (type === "ashby" || type === "mfr_density") {
      const aData = data as { series?: unknown[] };
      const series = Array.isArray(data) ? data : aData.series;
      if (!series || series.length === 0) return false;
      return series.some(
        (s: { data?: unknown[] }) =>
          s.data && Array.isArray(s.data) && s.data.length > 0,
      );
    }

    if (type === "parallel") {
      const pData = data as { indicators: unknown[]; series: unknown[] };
      return Boolean(
        pData &&
        pData.series &&
        pData.series.length > 0 &&
        pData.indicators &&
        pData.indicators.length > 0,
      );
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return false;
    }

    return true;
  }, [data, type]);

  const getOption = useCallback(() => {
    try {
      let option: echarts.EChartsOption = {};
      const typedData = (data || {}) as Record<string, unknown>;
      switch (type) {
        case "radar": {
          const radarSeries = Array.isArray(data) ? data : (typedData.series as unknown[]) || [];
          if (!Array.isArray(radarSeries)) throw new Error("Radar data series is not an array");
          option = getRadarChartOption(
            radarSeries,
            theme,
            typedData.indicators as { name: string; max: number }[],
          );
          break;
        }
        case "ashby":
          option = getAshbyChartOption(data, theme);
          break;
        case "mfr_density":
          option = getMfrDensityChartOption(data, theme);
          break;
        case "parallel": {
          const pData = data as {
            series: { name: string; value: number[] }[];
            indicators: { name: string; max: number }[];
          };
          if (!pData || !pData.series || !Array.isArray(pData.series)) throw new Error("Parallel data is missing required series array");
          option = getParallelChartOption(theme, pData) || {};
          break;
        }
        case "gpc":
          if (!Array.isArray(data)) throw new Error("GPC data must be an array of products");
          option = getGpcChartOption(data as Product[], theme);
          break;
        case "rheology":
          if (!typedData.products || !Array.isArray(typedData.products)) throw new Error("Rheology data missing items");
          option = getRheologyChartOption(
            typedData.products as Product[],
            theme,
            (typedData.temps as number[]) || [],
          );
          break;
        default:
          throw new Error(`Unknown chart type: ${type}`);
      }

      if (option.grid) {
        (option.grid as echarts.GridComponentOption).containLabel = true;
      }
      if (!option.tooltip) option.tooltip = {};
      const tooltip = option.tooltip as echarts.TooltipComponentOption;
      tooltip.confine = true;
      tooltip.enterable = true;
      // CRITICAL: Higher Z-Index for Tooltip to stay above UI overlays
      tooltip.extraCssText =
        "z-index: 99999 !important; box-shadow: 0 20px 40px rgba(0,0,0,0.25); border-radius: 12px; border: none; backdrop-filter: blur(8px); background: rgba(255,255,255,0.9); pointer-events: none;";
      if (theme === "dark") {
        tooltip.extraCssText =
          "z-index: 99999 !important; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.9); pointer-events: none;";
      }

      ["xAxis", "yAxis"].forEach((axis) => {
        const axisObj = (option as Record<string, unknown>)[axis];
        if (axisObj && (axisObj as { type?: string }).type === "log") {
          (axisObj as { logBase?: number }).logBase = 10;
          if (!(axisObj as { min?: unknown }).min)
            (axisObj as { min?: unknown }).min = (v: {
              min: number;
              max: number;
            }) => (v.min > 0 ? v.min * 0.9 : 0.01);
        }
      });
      return option;
    } catch (err: unknown) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to generate visualization",
      );
    }
  }, [type, data, theme]);

  useEffect(() => {
    if (!chartRef.current) return;

    // Clear error on new data
    setError(null);

    if (!validateData()) {
      setIsChartEmpty(true);
      if (chartInstance.current) {
        chartInstance.current.clear();
      }
      return;
    }

    setIsChartEmpty(false);
    setError(null);

    // If type changed, we MUST dispose the old instance to prevent component pollution or overlaps
    if (chartInstance.current && chartInstance.current.getOption()) {
      // Small optimization: only dispose if the container exists but we want a fresh start for a new chart type
      disposeChart();
    }

    if (!chartInstance.current) {
      chartInstance.current =
        echarts.getInstanceByDom(chartRef.current) ||
        echarts.init(chartRef.current, undefined, { renderer: "canvas" });
      if (onChartReady) onChartReady(chartInstance.current);
    }

    try {
      const option = getOption();
      chartInstance.current.setOption(option, { notMerge: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      // Do not dispose immediately to keep the container size, just clear
      chartInstance.current.clear();
    }

    if (!resizeObserver.current) {
      let resizeTimeout: ReturnType<typeof setTimeout>;
      resizeObserver.current = new ResizeObserver((entries) => {
        if (!chartInstance.current || chartInstance.current.isDisposed())
          return;

        // Debounce resize to prevent flickering and performance issues
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
              chartInstance.current?.resize({
                animation: {
                  duration: 300,
                  easing: "cubicOut",
                },
              });
            }
          }
        }, 100);
      });
      resizeObserver.current.observe(chartRef.current);
    }
  }, [data, theme, type, validateData, getOption, disposeChart, onChartReady]);

  useEffect(() => {
    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }
      disposeChart();
    };
  }, [disposeChart]);

  // Helper to make error messages friendlier with scientific context
  const getFriendlyErrorMessage = (rawError: string) => {
    if (rawError.includes("series") || rawError.includes("indicators"))
      return "数理结构失匹配：当前样本的属性维度（如拉伸、冲击等）不全，无法生成多维对比图。";
    if (rawError.includes("log") || rawError.includes("positive"))
      return "坐标系冲突：阿什比图采用对数坐标，部分数值为 0 或负值的样本已被自动剔除。";
    if (rawError.includes("GPC") || rawError.includes("MWD"))
      return "GPC 诊断提示：当前样本缺少分子量分布原始数据点，无法执行 MWD 矩计算。";
    return `数理引擎提示: ${rawError.length > 40 ? rawError.substring(0, 40) + '...' : rawError}`;
  };

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl ${className} relative overflow-hidden`}
        style={{ height, minHeight: "300px" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(#e11d48_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.03]"></div>

        <div className="z-10 flex flex-col items-center max-w-sm text-center p-6">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-2xl mb-4 shadow-lg shadow-rose-500/10 animate-bounce">
            <AlertCircle className="text-rose-500" size={28} />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2">
            Visualization Unavailable
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            {getFriendlyErrorMessage(error)} <br />
            <span className="opacity-70">
              Try selecting different products or checking your filters.
            </span>
          </p>

          <div className="w-full">
            <motion.button
              whileHover={{
                scale: 1.02,
                backgroundColor: "rgba(241, 245, 249, 0.5)",
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <Bug size={12} />
              {showDebug ? "Hide" : "Show"} Technical Details
              {showDebug ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </motion.button>

            <AnimatePresence>
              {showDebug && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] font-mono text-left break-all shadow-inner border border-slate-700 overflow-hidden"
                >
                  <p className="mb-1 text-rose-400 font-bold">Error Trace:</p>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ height, minHeight: "300px" }}
    >
      <div
        ref={chartRef}
        className={`w-full h-full transition-opacity duration-500 ${loading || isChartEmpty ? "opacity-0" : "opacity-100"}`}
      />

      <AnimatePresence>
        {loading && (
          <motion.div
            key="chart-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl"
          >
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 animate-pulse tracking-widest">
              PROCESSING DATA...
            </span>
          </motion.div>
        )}

        {!loading && isChartEmpty && (
          <motion.div
            key="chart-empty-state"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 backdrop-blur-[2px]"
          >
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-700 relative group"
            >
              <Database
                className="text-slate-300 dark:text-slate-600 group-hover:text-primary-400 transition-all duration-500"
                size={32}
              />
              <div className="absolute inset-0 bg-primary-500/5 rounded-full scale-0 group-hover:scale-150 transition-transform duration-700 ease-out" />
            </motion.div>
            <h3 className="text-base font-black text-slate-700 dark:text-slate-200 tracking-tight mb-2 uppercase">
              {type === "mfr_density"
                ? "MFR-密度"
                : type === "ashby" ? "阿什比对标" : type.toUpperCase()}{" "}
              分析模型未激活
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px] text-center leading-relaxed font-medium">
              当前样本集合缺乏生成此维度图表所需的关键实验参数（如粘度阶梯或分子量分布）。请尝试选择不同类别的牌号以开启数理对标。
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
