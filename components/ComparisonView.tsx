import React, { useMemo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Radar,
  Factory,
  Layers,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
} from "lucide-react";
import { Product } from "../types";
import { PROPERTY_GROUPS } from "../constants";
import { RADAR_KEYS, isLowBest } from "../productUtils";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import * as echarts from "echarts";

const KEY_SPECS = [
  "CAS Number",
  "CAS号",
  "Chemical Name",
  "化学名称",
  "典型应用",
  "应用",
  "Applications",
];

interface ComparisonViewProps {
  isOpen: boolean;
  products: Product[];
  onClose: () => void;
  onRemoveProduct: (id: string) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  isOpen,
  products,
  onClose,
  onRemoveProduct,
}) => {
  const { t, tProp } = useLanguage();
  const { theme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [baselineId, setBaselineId] = useState<string | null>(null);

  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (products.length > 0) {
      setCachedProducts(products);
    }
  }, [products]);
  const displayProducts = products.length > 0 ? products : cachedProducts;

  // Pre-calculate best values for each property
  const bestValuesMap = useMemo(() => {
    const map: Record<string, number> = {};
    const allPropKeys = new Set<string>();
    displayProducts.forEach((p) =>
      Object.keys(p.properties).forEach((k) => allPropKeys.add(k)),
    );

    allPropKeys.forEach((key) => {
      const values = displayProducts
        .map((p) => {
          const val = p.properties[key]?.value;
          return typeof val === "number" ? val : parseFloat(String(val));
        })
        .filter((n) => !isNaN(n));

      if (values.length > 1) {
        map[key] = isLowBest(key) ? Math.min(...values) : Math.max(...values);
      }
    });
    return map;
  }, [displayProducts]);

  const baselineProduct = useMemo(
    () => displayProducts.find((p) => p.id === baselineId),
    [displayProducts, baselineId],
  );

  // Tech Blue Palette
  const colors = useMemo(
    () => ["#0284c7", "#06b6d4", "#14b8a6", "#6366f1", "#f59e0b"],
    [],
  );

  // Radar Chart Data Prep (ECharts format)
  const radarKeys = useMemo(() => {
    let availableProps = RADAR_KEYS.filter((key) =>
      displayProducts.some((p) => p.properties[key] !== undefined),
    );

    if (availableProps.length < 3) {
      const numericProps = new Set<string>();
      displayProducts.forEach((p) => {
        Object.keys(p.properties).forEach((k) => {
          const val = p.properties[k]?.value;
          if (typeof val === "number" || !isNaN(parseFloat(String(val)))) {
            numericProps.add(k);
          }
        });
      });
      availableProps = Array.from(numericProps).slice(0, 6);
    }

    return availableProps.length >= 3 ? availableProps : RADAR_KEYS;
  }, [displayProducts]);

  useEffect(() => {
    if (!chartRef.current || displayProducts.length === 0) return;

    // Initialize Chart once
    if (!chartInstance.current) {
      chartInstance.current =
        echarts.getInstanceByDom(chartRef.current) ||
        echarts.init(chartRef.current);
    }

    const indicator = radarKeys.map((key) => ({
      name: tProp(key),
    }));

    const seriesData = displayProducts.map((p, idx) => ({
      value: radarKeys.map((key) => {
        const val = Number(p.properties[key]?.value);
        return isNaN(val) ? 0 : val;
      }),
      name: p.gradeName,
      areaStyle: {
        opacity: 0.15,
      },
      lineStyle: {
        width: 3,
      },
      itemStyle: {
        color: colors[idx % colors.length],
      },
      symbol: "circle",
      symbolSize: 8,
    }));

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
        borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
        textStyle: { color: theme === "dark" ? "#f1f5f9" : "#0f172a" },
        padding: [10, 15],
        borderRadius: 12,
        shadowBlur: 10,
        shadowColor: "rgba(0,0,0,0.1)",
      },
      legend: {
        bottom: 0,
        data: displayProducts.map((p) => p.gradeName),
        textStyle: {
          color: theme === "dark" ? "#94a3b8" : "#475569",
          fontSize: 10,
          fontWeight: "bold",
        },
        itemGap: 20,
      },
      radar: {
        indicator: indicator,
        shape: "circle",
        splitNumber: 4,
        axisName: {
          color: theme === "dark" ? "#cbd5e1" : "#1e293b",
          fontWeight: "bold",
          fontSize: 10,
          formatter: (name: string) =>
            name.length > 8 ? name.slice(0, 8) + "..." : name,
        },
        splitLine: {
          lineStyle: {
            color:
              theme === "dark"
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(0, 0, 0, 0.05)",
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color:
              theme === "dark"
                ? ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.04)"]
                : ["rgba(0,0,0,0.01)", "rgba(0,0,0,0.02)"],
          },
        },
        axisLine: {
          lineStyle: {
            color:
              theme === "dark"
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
          },
        },
      },
      series: [
        {
          type: "radar",
          data: seriesData,
          emphasis: {
            lineStyle: {
              width: 4,
            },
          },
        },
      ],
    };

    chartInstance.current.setOption(option, true); // Use true to not merge with previous options

    const ro = new ResizeObserver(() => { if (chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [displayProducts, theme, tProp, isOpen, colors, radarKeys]);

  // Dispose chart only when component unmounts or isOpen changes to false
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // Aggregate all unique properties from selected products
  const allProperties = useMemo(() => {
    const props = new Set<string>();
    displayProducts.forEach((p) =>
      Object.keys(p.properties).forEach((k) => props.add(k)),
    );
    return Array.from(props);
  }, [displayProducts]);

  // Group properties based on constants
  const groupedProps = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    Object.keys(PROPERTY_GROUPS).forEach((g) => (grouped[g] = []));
    grouped["Other"] = [];

    allProperties.forEach((prop) => {
      if (KEY_SPECS.includes(prop)) return; // Skip key specs as they are handled separately
      let found = false;
      for (const [group, keys] of Object.entries(PROPERTY_GROUPS)) {
        if (keys.some((k) => prop.includes(k) || k === prop)) {
          grouped[group].push(prop);
          found = true;
          break;
        }
      }
      if (!found) grouped["Other"].push(prop);
    });

    return Object.entries(grouped).filter(([_, props]) => props.length > 0);
  }, [allProperties]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="comparison-overlay-container"
          className="fixed inset-0 z-[110] pointer-events-none flex flex-col"
        >
          <motion.div
            key="comparison-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />
          <motion.div
            key="comparison-content"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 z-[120] bg-slate-50 dark:bg-slate-950 flex flex-col pointer-events-auto"
          >
            {/* Header */}
            <div className="px-4 md:px-6 py-3 md:py-4 bg-white dark:bg-slate-950 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center shrink-0 relative overflow-hidden">
              <div className="flex items-center gap-3 md:gap-4 relative z-10">
                <div className="p-1.5 md:p-2 bg-primary-600 text-white border border-primary-700">
                  <Layers size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs md:text-sm font-serif text-slate-800 dark:text-white tracking-tight leading-none mb-1 truncate">
                    Material Fingerprint
                  </h2>
                  <p className="text-[8px] md:text-[10px] font-mono text-slate-500 items-center gap-2 uppercase tracking-widest hidden sm:flex">
                    Benchmarking{" "}
                    <span className="text-primary-500 font-bold">
                      {products.length}
                    </span>{" "}
                    grades{" "}
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />{" "}
                    multi-dimensional analysis
                  </p>
                  <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest sm:hidden">
                    Comparing {products.length} grades
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                aria-label="Close Comparison"
                className="p-1.5 md:p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 z-10"
              >
                <X size={18} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-auto md:overflow-hidden flex flex-col md:flex-row">
              {/* Radar Chart Section */}
              <div className="h-[300px] md:h-full md:w-2/5 bg-slate-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-slate-300 dark:border-slate-700 p-4 md:p-6 flex flex-col relative overflow-hidden shrink-0">
                <h3 className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                  <Radar size={12} className="text-primary-500" /> Property
                  Overlap Analysis
                </h3>
                <div className="flex-1 w-full min-h-0 relative bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 group/radar">
                  {displayProducts.length > 0 ? (
                    <div ref={chartRef} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                        <Radar
                          size={32}
                          className="text-slate-300 dark:text-slate-600"
                        />
                      </div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        No products selected
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800/30 text-[10px] font-mono text-slate-600 dark:text-slate-400 leading-relaxed flex gap-3 relative z-10">
                  <div className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 h-fit">
                    <Info size={12} className="text-primary-500" />
                  </div>
                  <p>
                    <span className="font-bold text-primary-600 dark:text-primary-400 uppercase">
                      Expert Insight:
                    </span>{" "}
                    Areas of intersection indicate competitive equivalence.
                    Outer spikes represent superior performance in specific
                    domains.
                  </p>
                </div>
              </div>

              {/* Comparison Table Section */}
              <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-950 relative">
                <table className="w-full text-sm text-left border-separate border-spacing-0">
                  <thead className="text-[10px] font-mono text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 sticky top-0 z-30">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 border-b border-r border-slate-300 dark:border-slate-700 min-w-[140px] md:min-w-[200px] sticky left-0 bg-slate-50 dark:bg-slate-900 z-40 uppercase tracking-widest">
                        {t("propertyName")}
                      </th>
                      {displayProducts.map((p, idx) => (
                        <th
                          key={p.id}
                          className="px-4 md:px-6 py-3 md:py-4 border-b border-r border-slate-300 dark:border-slate-700 min-w-[200px] md:min-w-[250px] relative group overflow-hidden"
                        >
                          <div
                            className="absolute top-0 left-0 w-full h-0.5"
                            style={{
                              backgroundColor: colors[idx % colors.length],
                            }}
                          />
                          <div className="flex justify-between items-start relative z-10">
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-serif font-bold text-slate-800 dark:text-white text-base md:text-lg mb-1 truncate tracking-tight"
                                style={{ color: colors[idx % colors.length] }}
                                title={p.gradeName}
                              >
                                {p.gradeName}
                              </div>
                              <div
                                className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 md:px-2 py-0.5 border border-slate-200 dark:border-slate-700 w-fit mb-2 md:mb-3 truncate max-w-full uppercase tracking-widest"
                                title={p.manufacturer}
                              >
                                <Factory size={10} className="shrink-0" />{" "}
                                <span className="truncate">
                                  {p.manufacturer}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    setBaselineId(
                                      baselineId === p.id ? null : p.id,
                                    )
                                  }
                                  aria-label={
                                    baselineId === p.id
                                      ? "Clear baseline"
                                      : `Set ${p.gradeName} as baseline`
                                  }
                                  className={`flex items-center gap-1 md:gap-2 text-[8px] md:text-[9px] font-mono uppercase tracking-widest px-2 md:px-3 py-1 md:py-1.5 border transition-all ${baselineId === p.id ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20" : "bg-white dark:bg-slate-800 text-slate-500 hover:text-primary-500 border-slate-300 dark:border-slate-700 shadow-sm"}`}
                                >
                                  <Target
                                    size={12}
                                    className={
                                      baselineId === p.id ? "animate-pulse" : ""
                                    }
                                  />
                                  <span className="whitespace-nowrap">
                                    {baselineId === p.id
                                      ? "Baseline"
                                      : "Set Baseline"}
                                  </span>
                                </motion.button>
                                <motion.button
                                  whileHover={{
                                    scale: 1.1,
                                    backgroundColor: "rgba(254, 226, 226, 1)",
                                  }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => onRemoveProduct(p.id)}
                                  className="p-1 md:p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors rounded-lg shadow-sm"
                                  title="Remove from comparison"
                                >
                                  <X size={12} />
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                    {/* Key Specifications Section */}
                    {KEY_SPECS.some((key) =>
                      displayProducts.some((p) => p.properties[key]),
                    ) && (
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <td
                          colSpan={displayProducts.length + 1}
                          className="px-6 py-2 text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-y border-slate-300 dark:border-slate-700"
                        >
                          Key Specifications / 核心参数
                        </td>
                      </tr>
                    )}
                    {KEY_SPECS.filter((key) =>
                      displayProducts.some((p) => p.properties[key]),
                    ).map((key) => (
                      <tr
                        key={key}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                      >
                        <td className="px-6 py-3 font-mono font-bold text-slate-600 dark:text-slate-400 border-r border-slate-300 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 transition-colors z-20 text-[10px] uppercase tracking-widest">
                          {tProp(key)}
                        </td>
                        {displayProducts.map((p) => (
                          <td
                            key={`${p.id}-${key}`}
                            className="px-6 py-3 border-r border-slate-300 dark:border-slate-700"
                          >
                            <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
                              {p.properties[key]?.value || "-"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}

                    {groupedProps.map(([group, props]) => (
                      <React.Fragment key={group}>
                        <tr className="bg-slate-50 dark:bg-slate-900">
                          <td
                            colSpan={displayProducts.length + 1}
                            className="px-6 py-2 text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-y border-slate-300 dark:border-slate-700"
                          >
                            {t(`group_${group}` as Parameters<typeof t>[0])}{" "}
                            {t("properties")}
                          </td>
                        </tr>
                        {props.map((propKey, pIdx) => (
                          <motion.tr
                            key={propKey}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: pIdx * 0.01 }}
                            className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                          >
                            <td
                              className="px-6 py-3 font-mono text-slate-600 dark:text-slate-400 border-r border-slate-300 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 transition-colors z-20 text-[10px] truncate max-w-[200px]"
                              title={tProp(propKey)}
                            >
                              {tProp(propKey)}
                            </td>
                            {displayProducts.map((p) => {
                              const prop = p.properties[propKey];
                              const numVal = Number(prop?.value);
                              const isBest =
                                !isNaN(numVal) &&
                                bestValuesMap[propKey] === numVal;
                              const lowBest = isLowBest(propKey);

                              // Baseline comparison logic
                              let diffDisplay = null;
                              if (
                                baselineId &&
                                baselineId !== p.id &&
                                !isNaN(numVal)
                              ) {
                                const baselineProp =
                                  baselineProduct?.properties[propKey];
                                const baselineVal = Number(baselineProp?.value);
                                if (!isNaN(baselineVal) && baselineVal !== 0) {
                                  const diff =
                                    ((numVal - baselineVal) / baselineVal) *
                                    100;
                                  const isZero = Math.abs(diff) < 0.01;
                                  const isGood = lowBest ? diff < 0 : diff > 0;

                                  diffDisplay = (
                                    <div
                                      className={`flex items-center gap-0.5 text-[9px] font-mono font-bold mt-1 ${isZero ? "text-slate-400" : isGood ? "text-emerald-500" : "text-rose-500"}`}
                                    >
                                      {isZero ? (
                                        <Minus size={8} />
                                      ) : diff > 0 ? (
                                        <ArrowUpRight size={8} />
                                      ) : (
                                        <ArrowDownRight size={8} />
                                      )}
                                      {Math.abs(diff).toFixed(1)}%
                                    </div>
                                  );
                                }
                              }

                              return (
                                <td
                                  key={`${p.id}-${propKey}`}
                                  className={`px-6 py-3 border-r border-slate-300 dark:border-slate-700 ${isBest && !baselineId ? "bg-sky-50 dark:bg-sky-900/10" : ""} ${baselineId === p.id ? "bg-emerald-50 dark:bg-emerald-900/10" : ""}`}
                                >
                                  <div className="flex flex-col">
                                    <div className="flex items-baseline gap-1">
                                      <span
                                        className={`text-[11px] font-mono font-bold ${isBest && !baselineId ? "text-sky-700 dark:text-sky-400" : "text-slate-700 dark:text-slate-300"}`}
                                      >
                                        {prop?.value ?? "-"}
                                      </span>
                                      {prop?.unit && (
                                        <span className="text-[9px] font-mono text-slate-400">
                                          {prop.unit}
                                        </span>
                                      )}
                                    </div>
                                    {diffDisplay}
                                  </div>
                                </td>
                              );
                            })}
                          </motion.tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
