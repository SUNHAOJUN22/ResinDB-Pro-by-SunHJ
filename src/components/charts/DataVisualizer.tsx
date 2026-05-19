import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { motion } from "motion/react";
import {
  Settings,
  Activity,
  X,
  FileJson,
  Image as ImageIcon,
  Hexagon,
  ScatterChart,
  Waves,
  Info,
  Loader2,
  Filter,
  Plus,
  Check,
  AlertTriangle,
  Thermometer,
  Target,
  Calculator,
  Layers,
  Network,
  BarChart3,
  Map,
  ShieldAlert,
  ThermometerSnowflake,
  Combine,
  Flame,
  Factory,
  BrainCircuit,
  GitMerge,
  Zap
} from "lucide-react";
import * as echarts from "echarts";
import { Product, FormulaConfig } from '@/types/index';
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { ScientificChart, ChartType as SCChartType } from '@/components/charts/ScientificChart';
import { CanvasScatterGraph } from "@/components/charts/CanvasScatterGraph";
import { CorrelationMatrix } from "@/components/charts/CorrelationMatrix";
import { SimilarityGraph } from "@/components/charts/SimilarityGraph";
import { RheologyGraph } from "@/components/charts/RheologyGraph";
import { useSimilarityWorker } from '@/hooks/math/useSimilarity';
import { useRsmWorker } from '@/hooks/workers/useRsmWorker';
import { useParetoWorker } from '@/hooks/workers/useParetoWorker';
import { useTheme } from "@/contexts/ThemeContext";
import { useFeatureImportanceWorker } from '@/hooks/workers/useFeatureImportanceWorker';
import { useKdeWorker } from '@/hooks/workers/useKdeWorker';
import { useWeibullWorker } from '@/hooks/workers/useWeibullWorker';
import { useWlfWorker } from '@/hooks/workers/useWlfWorker';
import { useCopulaWorker } from '@/hooks/workers/useCopulaWorker';
import { useArrheniusWorker } from '@/hooks/workers/useArrheniusWorker';
import { ArrheniusChart } from "@/components/charts/ArrheniusChart";
import { useSobolWorker } from '@/hooks/workers/useSobolWorker';
import { SobolChart } from "@/components/charts/SobolChart";
import { useSpcWorker } from '@/hooks/workers/useSpcWorker';
import { SpcChart } from "@/components/charts/SpcChart";
import { RADAR_KEYS, getPerformanceFingerprint } from '@/utils/productUtils';

export type ViewChartType = SCChartType | "canvas_scatter" | "correlation" | "similarity_graph" | "rsm" | "feature_importance" | "kde_topology" | "weibull" | "wlf_tts" | "copula" | "arrhenius" | "sobol" | "spc" | "bayes" | "mahalanobis" | "kinetics" | "prony" | "moo";
import { PCA } from "@/lib/math/pca";
import { useKMeansWorker } from '@/hooks/workers/useKMeansWorker';
import { materialEngine } from "@/lib/materialScience";
import { useBayesWorker } from '@/hooks/workers/useBayesWorker';
import { BayesChart } from "@/components/charts/BayesChart";
import { useMooWorker } from '@/hooks/workers/useMooWorker';
import { MooChart } from "@/components/charts/MooChart";
import { useMahalanobisWorker } from '@/hooks/workers/useMahalanobisWorker';

import { MahalanobisChart } from "@/components/charts/MahalanobisChart";
import { useKineticsWorker } from '@/hooks/workers/useKineticsWorker';
import { KineticsChart } from "@/components/charts/KineticsChart";
import { usePronyWorker } from '@/hooks/workers/usePronyWorker';
import { PronyChart } from "@/components/charts/PronyChart";
import { formulaEngine } from "@/lib/formulaParser";
import { useFormulas } from '@/hooks/math/useFormulas';
import { RsmHeatmapChart } from "@/components/charts/RsmHeatmapChart";
import { FeatureImportanceChart } from "@/components/charts/FeatureImportanceChart";
import { KdeTopologyChart } from "@/components/charts/KdeTopologyChart";
import { WeibullChart } from "@/components/charts/WeibullChart";
import { WlfTtsChart } from "@/components/charts/WlfTtsChart";
import { CopulaChart } from "@/components/charts/CopulaChart";

interface DataVisualizerProps {
  data: Product[];
  selectedProducts?: Product[];
  initialChartType?: string;
  formulas?: FormulaConfig[];
}

export const DataVisualizer: React.FC<DataVisualizerProps> = React.memo(
  ({ data, selectedProducts, initialChartType, formulas: propFormulas }) => {
    const { t, tProp } = useLanguage();
    const { theme } = useTheme();
    const { formulas: hookFormulas } = useFormulas();
    const formulas = propFormulas || hookFormulas;
    const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(
      null,
    );
    const [activeChart, setActiveChart] = useState<ViewChartType>("radar");
    const [showConfig, setShowConfig] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    // Canvas Scatter settings
    const [scatterXKey, setScatterXKey] = useState<string>("密度");
    const [scatterYKey, setScatterYKey] = useState<string>("熔融指数");
    const [enableConvexHull, setEnableConvexHull] = useState(false);
    
    // Pareto Settings
    const { paretoFrontIds, computePareto } = useParetoWorker();
    const [enablePareto, setEnablePareto] = useState(false);
    const [paretoXDir, setParetoXDir] = useState<'min' | 'max'>('max');
    const [paretoYDir, setParetoYDir] = useState<'min' | 'max'>('max');

    // Rheology specific configuration
    const [selectedRheologyTemps, setSelectedRheologyTemps] = useState<
      number[]
    >([190, 210, 230]);

    // Scatter specific state
    const { clusters, computeKMeans, isComputingKMeans } = useKMeansWorker();
    
    // Similarity Graph specific configuration
    const [similarityThreshold, setSimilarityThreshold] = useState(0.95);
    const [similarityFeatures, setSimilarityFeatures] = useState<string[]>([]);
    const { nodes: simNodes, edges: simEdges, isCalculating: isCalculatingSim, calculateSimilarity } = useSimilarityWorker();

    // Similarity variables and worker will trigger later
    
    // RSM specific configuration
    const [rsmX1Key, setRsmX1Key] = useState<string>("");
    const [rsmX2Key, setRsmX2Key] = useState<string>("");
    const [rsmYKey, setRsmYKey] = useState<string>("");
    const { isCalculating: isCalculatingRsm, rsmResult, error: rsmError, calculateRSM } = useRsmWorker();

    // Feature Importance configuration
    const [fiTargetKey, setFiTargetKey] = useState<string>("");
    const { isCalculating: isCalculatingFI, importanceResult, error: fiError, calculateImportance } = useFeatureImportanceWorker();

    // KDE Topology configuration
    const [kdeXKey, setKdeXKey] = useState<string>("");
    const [kdeYKey, setKdeYKey] = useState<string>("");
    const { isCalculating: isCalculatingKDE, kdeResult, calculateKde } = useKdeWorker();

    // Weibull configuration
    const [weibullKey, setWeibullKey] = useState<string>("");
    const { isCalculating: isCalculatingWeibull, weibullResult, error: weibullError, calculateWeibull } = useWeibullWorker();

    // TTS configuration
    const [wlfRefTemp, setWlfRefTemp] = useState<number>(210);
    const { isCalculating: isCalculatingWLF, wlfResult, error: wlfError, calculateWLF } = useWlfWorker();

    // Copula configuration
    const [copulaXKey, setCopulaXKey] = useState<string>("");
    const [copulaYKey, setCopulaYKey] = useState<string>("");
    const [copulaThreshX, setCopulaThreshX] = useState<number | "">("");
    const [copulaThreshY, setCopulaThreshY] = useState<number | "">("");
    const [jointFailureProb, setJointFailureProb] = useState<number | null>(null);
    const { isCalculating: isCalculatingCopula, copulaResult, error: copulaError, calculateCopula, getJointFailureProb } = useCopulaWorker();

    // Arrhenius configuration
    const [arrheniusPoints, setArrheniusPoints] = useState<{id: number; temp: number; time: number}[]>([
        { id: 1, temp: 110, time: 8500 },
        { id: 2, temp: 130, time: 2200 },
        { id: 3, temp: 150, time: 600 }
    ]);
    const [predTemp, setPredTemp] = useState<number>(25);
    const { isCalculating: isCalculatingArrhenius, arrheniusResult, error: arrheniusError, calculateArrhenius, getPredictedLife } = useArrheniusWorker();

    // Sobol configuration
    const [sobolTargetFormulaId, setSobolTargetFormulaId] = useState<string>("");
    const [sobolVariances, setSobolVariances] = useState<Record<string, number>>({});
    const [sobolIterations, setSobolIterations] = useState<number>(2000);
    const { isCalculating: isCalculatingSobol, sobolResult, error: sobolError, runAnalysis: runSobol } = useSobolWorker();

    // SPC configuration
    const [spcTargetKey, setSpcTargetKey] = useState<string>("");
    const [spcUSL, setSpcUSL] = useState<number | "">("");
    const [spcLSL, setSpcLSL] = useState<number | "">("");
    const { isCalculating: isCalculatingSpc, spcResult, error: spcError, calculateSpc } = useSpcWorker();

    // Bayes configuration
    const [bayesFeatures, setBayesFeatures] = useState<string[]>([]);
    const [bayesTarget, setBayesTarget] = useState<string>("");
    const [bayesMaximize, setBayesMaximize] = useState<boolean>(true);
    const { isCalculating: isCalculatingBayes, bayesResult, error: bayesError, runBayesOpt } = useBayesWorker();

    // Moo configuration
    const [mooFeatures, setMooFeatures] = useState<string[]>([]);
    const [mooTargets, setMooTargets] = useState<{name: string, maximize: boolean}[]>([]);
    const { isCalculating: isCalculatingMoo, mooResult, error: mooError, runMooOpt } = useMooWorker();

    // Mahalanobis configuration
    const [mahalanobisFeatures, setMahalanobisFeatures] = useState<string[]>([]);
    const [mahalanobisAlpha, setMahalanobisAlpha] = useState<number>(0.05);
    const { isCalculating: isCalculatingMahalanobis, result: mahalanobisResult, error: mahalanobisError, runAnalysis: runMahalanobis } = useMahalanobisWorker();

    // Kinetics configuration
    const [kineticsData, setKineticsData] = useState<{ beta: number; tp: number }[]>([
        { beta: 5, tp: 120 },
        { beta: 10, tp: 132 },
        { beta: 15, tp: 140 },
        { beta: 20, tp: 145 },
    ]);
    const [kineticsIsoTemp, setKineticsIsoTemp] = useState<number>(80);
    const { isCalculating: isCalculatingKinetics, result: kineticsResult, error: kineticsError, runAnalysis: runKinetics } = useKineticsWorker();

    // Prony configuration
    const [pronyData, setPronyData] = useState<{ omega: number; storage: number; loss: number }[]>([
        { omega: 1e-4, storage: 1.5, loss: 0.2 },
        { omega: 1e-3, storage: 3.1, loss: 0.8 },
        { omega: 1e-2, storage: 10.5, loss: 4.2 },
        { omega: 1e-1, storage: 45.2, loss: 22.1 },
        { omega: 1, storage: 150.8, loss: 65.3 },
        { omega: 1e1, storage: 420.5, loss: 120.4 },
        { omega: 1e2, storage: 850.1, loss: 150.2 },
        { omega: 1e3, storage: 1200.0, loss: 120.5 },
        { omega: 1e4, storage: 1500.5, loss: 80.2 },
        { omega: 1e5, storage: 1700.2, loss: 40.1 },
    ]);
    const [pronyTerms, setPronyTerms] = useState<number>(7);
    const { isCalculating: isCalculatingProny, result: pronyResult, error: pronyError, runProny } = usePronyWorker();

    useEffect(() => {
      if (
        initialChartType &&
        ["radar", "ashby", "mfr_density", "gpc", "rheology", "canvas_scatter"].includes(
          initialChartType,
        )
      ) {
        setActiveChart(initialChartType as ViewChartType);
      }
    }, [initialChartType]);

    // Filter State
    const [filters, setFilters] = useState<
      Record<string, { min: string; max: string }>
    >({});
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          filterDropdownRef.current &&
          !filterDropdownRef.current.contains(event.target as Node)
        ) {
          setIsFilterDropdownOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Determine base data set
    const baseData = useMemo(() => {
      return selectedProducts && selectedProducts.length > 0
        ? selectedProducts
        : data;
    }, [data, selectedProducts]);

    // Extract available numeric properties for filtering - Memoized to prevent heavy loop on every render
    const numericProperties = useMemo(() => {
      if (!baseData || baseData.length === 0) return [];
      const props = new Set<string>();

      // Limit scan depth: Scanning 50,000 products just to fish out property names is wasteful.
      // Usually, the first 100 products cover the entire statistical schema.
      const scanLimit = Math.min(baseData.length, 250);
      for (let i = 0; i < scanLimit; i++) {
        const properties = baseData[i].properties;
        for (const key in properties) {
          if (props.has(key)) continue;
          const val = properties[key]?.value;
          const num = typeof val === "number" ? val : parseFloat(String(val));
          if (!isNaN(num)) {
            props.add(key);
          }
        }
      }

      // Add computed formulas as virtual numeric properties
      formulas.forEach((f) => {
        props.add(`formula_${f.id}`);
      });

      return Array.from(props).sort();
    }, [baseData, formulas]);

    // Default keys init
    useEffect(() => {
       if (numericProperties.length >= 3 && !rsmX1Key) {
           setRsmX1Key(numericProperties[0]);
           setRsmX2Key(numericProperties[1]);
           setRsmYKey(numericProperties[2]);
       }
       if (numericProperties.length >= 1 && !fiTargetKey) {
           setFiTargetKey(numericProperties[0]);
       }
       if (numericProperties.length >= 2 && !kdeXKey) {
           setKdeXKey(numericProperties[0]);
           setKdeYKey(numericProperties[1]);
       }
       if (numericProperties.length >= 2 && !copulaXKey) {
           setCopulaXKey(numericProperties[0]);
           setCopulaYKey(numericProperties[1]);
       }
    }, [numericProperties, rsmX1Key, fiTargetKey, kdeXKey, copulaXKey]);

    // Default RSM keys
    useEffect(() => {
       if (numericProperties.length >= 3 && !rsmX1Key) {
           setRsmX1Key(numericProperties[0]);
           setRsmX2Key(numericProperties[1]);
           setRsmYKey(numericProperties[2]);
       }
    }, [numericProperties, rsmX1Key]);

    // Run Pareto computation effect will be placed after getVal and filteredData

    // Apply filters to baseData
    const filteredData = useMemo(() => {
      if (!baseData || baseData.length === 0) return [];
      const filterKeys = Object.keys(filters);
      if (filterKeys.length === 0) return baseData;

      // Compile float boundaries ONCE outside the main 50,000 document iteration loop
      const compiledFilters = filterKeys.map((key) => ({
        key,
        min: filters[key].min === "" ? -Infinity : parseFloat(filters[key].min),
        max: filters[key].max === "" ? Infinity : parseFloat(filters[key].max),
      }));

      const numFilters = compiledFilters.length;
      const res: Product[] = [];
      const len = baseData.length;

      for (let i = 0; i < len; i++) {
        const p = baseData[i];
        let pass = true;
        for (let f = 0; f < numFilters; f++) {
          const rule = compiledFilters[f];
          const rawVal = p.properties[rule.key]?.value;
          const numVal =
            typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
          if (isNaN(numVal) || numVal < rule.min || numVal > rule.max) {
            pass = false;
            break;
          }
        }
        if (pass) res.push(p);
      }
      return res;
    }, [baseData, filters]);
    
    // Trigger similarity calculation
    useEffect(() => {
        if (activeChart === 'similarity_graph') {
            if (similarityFeatures.length >= 2) {
                calculateSimilarity(filteredData, similarityFeatures, similarityThreshold);
            }
        }
    }, [activeChart, filteredData, similarityFeatures, similarityThreshold, calculateSimilarity]);

    // Helper: Safe Float Parser (Layer 1: Anti-Crash)
    const safeParse = useCallback((val: unknown, fallback = 0): number => {
      if (val === undefined || val === null || val === "") return fallback;
      const num = parseFloat(String(val));
      return isNaN(num) ? fallback : num;
    }, []);

    const formulaExecutor = useMemo(() => formulaEngine.compileGraph(formulas), [formulas]);

    const getVal = useCallback(
      (p: Product, key: string): number => {
        if (key.startsWith("formula_")) {
          const id = key.replace("formula_", "");
          const f = formulas.find((form) => form.id === id);
          if (!f) return 0;
          try {
            const val = formulaExecutor(p)[f.id];
            return typeof val === "number" ? val : parseFloat(String(val)) || 0;
          } catch {
            return 0;
          }
        }
        return safeParse(p.properties[key]?.value);
      },
      [formulas, safeParse, formulaExecutor],
    );

    // Run Pareto computation
    useEffect(() => {
        if (activeChart === "canvas_scatter" && enablePareto) {
            const dataPayload = filteredData.map(d => ({
                id: d.id,
                values: {
                    [scatterXKey]: getVal(d, scatterXKey),
                    [scatterYKey]: getVal(d, scatterYKey)
                }
            }));
            const objectives = [
                { key: scatterXKey, minimize: paretoXDir === 'min' },
                { key: scatterYKey, minimize: paretoYDir === 'min' }
            ];
            computePareto(dataPayload, objectives);
        }
    }, [activeChart, enablePareto, paretoXDir, paretoYDir, scatterXKey, scatterYKey, filteredData, getVal, computePareto]);

    const handleAddFilter = React.useCallback((key: string) => {
      if (!filters[key]) {
        setFilters((prev) => ({ ...prev, [key]: { min: "", max: "" } }));
      }
      setIsFilterDropdownOpen(false);
    }, [filters]);

    const updateFilter = React.useCallback((key: string, field: "min" | "max", val: string) => {
      // Allow only numbers and decimals
      if (val && !/^-?\d*\.?\d*$/.test(val)) return;
      setFilters((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: val },
      }));
    }, []);

    const removeFilter = React.useCallback((key: string) => {
      setFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, []);

    // --- Data Preparation Logic (Defensive) using filteredData ---

    // 1. Radar Data: Percentile-based ranking for maximum visual differentiation
    const radarData = useMemo(() => {
      if (!filteredData || filteredData.length === 0)
        return { series: [], indicators: [] };
      try {
        const source = filteredData.slice(0, 6);
        
        // Dynamic statistical map for the current filtered set to enable relative ranking
        const stats: Record<string, number[]> = {};
        RADAR_KEYS.forEach((key, idx) => {
          stats[key] = filteredData.map(p => getPerformanceFingerprint(p)[idx]).filter(v => v > 0);
        });

        const indicators = RADAR_KEYS.map((key) => {
          const enKey = key === "流动性" ? "Flow" : 
                        key === "硬度刚性" ? "Rigidity" :
                        key === "耐热性" ? "Thermal" :
                        key === "拉伸性能" ? "Tensile" :
                        key === "冲击强度" ? "Impact" : "Quality";
          return {
            name: `${tProp(key)}\n${enKey}`,
            max: 100, // Normalized ranking percentage
          };
        });

        const series = source.map((p) => {
          const raw = getPerformanceFingerprint(p);
          return {
            name: p.gradeName,
            // Maps actual value to its percentile rank in the current group
            value: raw.map((v, i) => materialEngine.normalizePercentile(v, stats[RADAR_KEYS[i]]))
          };
        });

        return { series, indicators };
      } catch (e) {
        logger.error("Radar Prep Error:", e);
        return { series: [], indicators: [] };
      }
    }, [filteredData, tProp]);

    // 2. Ashby Data: Auto-scaling Scatter Plot
    const ashbyData = useMemo(() => {
      if (!filteredData || filteredData.length === 0)
        return { series: [], xAxis: "", yAxis: "" };
      try {
        let xAxis = "弯曲模量";
        let yAxis = "悬臂梁缺口冲击强度";

        const hasPropMatch = (keys: string[]) =>
          filteredData.some((p) => keys.some(k => p.properties[k] !== undefined));

        if (!hasPropMatch(["弯曲模量", "Flexural Modulus", "Flex Modulus"])) {
          xAxis = hasPropMatch(["拉伸屈服应力", "Tensile Yield Stress", "Yield Strength"]) ? "拉伸屈服应力" : (numericProperties[0] || "密度");
        }
        if (!hasPropMatch(["悬臂梁缺口冲击强度", "Izod Impact", "Notched Izod"])) {
          yAxis = hasPropMatch(["拉伸强度", "Tensile Strength"]) ? "拉伸强度" : (numericProperties[1] || "熔体质量流动速率");
        }

        const xValues: number[] = [];
        const yValues: number[] = [];
        const groups: Record<string, [number, number, string][]> = {};

        filteredData.forEach((p) => {
          const xVal = getVal(p, xAxis);
          const yVal = getVal(p, yAxis);
          
          if (xVal > 0 && yVal > 0) {
            const man = p.manufacturer || "Unknown";
            if (!groups[man]) groups[man] = [];
            groups[man].push([xVal, yVal, p.gradeName]);
            xValues.push(xVal);
            yValues.push(yVal);
          }
        });

        return {
          series: Object.entries(groups).map(([name, data]) => ({ name, data })),
          xAxis: tProp(xAxis),
          yAxis: tProp(yAxis),
          xBounds: materialEngine.calculateBounds(xValues, true),
          yBounds: materialEngine.calculateBounds(yValues, true)
        };
      } catch {
        return { series: [], xAxis: "", yAxis: "" };
      }
    }, [filteredData, tProp, getVal, numericProperties]);

    // 3. MFR vs Density Data: Processability-Structure Matrix with Adaptive Ranges
    const mfrDensityData = useMemo(() => {
      if (!filteredData || filteredData.length === 0)
        return { series: [], xAxis: "", yAxis: "" };
      try {
        let xAxis = "密度";
        let yAxis = "熔体质量流动速率";

        const hasPropMatch = (keys: string[]) =>
          filteredData.some((p) => keys.some(k => p.properties[k] !== undefined));

        if (!hasPropMatch(["密度", "Density"])) {
          xAxis = numericProperties[0] || "乙烯含量";
        }
        if (!hasPropMatch(["熔体质量流动速率", "MFR", "MFI"])) {
          yAxis = hasPropMatch(["门尼粘度", "Mooney"]) ? "门尼粘度" : (numericProperties[1] || "密度");
        }

        const xValues: number[] = [];
        const yValues: number[] = [];
        const groups: Record<string, [number, number, string][]> = {};

        filteredData.forEach((p) => {
          const xVal = getVal(p, xAxis);
          const yVal = getVal(p, yAxis);
          
          if (xVal > 0 && yVal > 0) {
            const man = p.manufacturer || "Unknown";
            if (!groups[man]) groups[man] = [];
            groups[man].push([xVal, yVal, p.gradeName]);
            xValues.push(xVal);
            yValues.push(yVal);
          }
        });

        return {
          series: Object.entries(groups).map(([name, data]) => ({ name, data })),
          xAxis: tProp(xAxis),
          yAxis: tProp(yAxis),
          xBounds: materialEngine.calculateBounds(xValues, false), // Linear for density usually better
          yBounds: materialEngine.calculateBounds(yValues, true)   // Log for MFR
        };
      } catch (e) {
        logger.error("Mfr-Density Prep Error:", e);
        return { series: [], xAxis: "", yAxis: "" };
      }
    }, [filteredData, tProp, getVal, numericProperties]);

    // Select the correct data based on chart type to pass to ScientificChart
    const currentChartData = useMemo(() => {
      try {
        switch (activeChart) {
          case "radar":
          case "parallel":
            return radarData;
          case "ashby":
            return ashbyData;
          case "mfr_density":
            return mfrDensityData;
          case "gpc":
            return filteredData;
          case "rheology":
            return { products: filteredData, temps: selectedRheologyTemps };
          default:
            return [];
        }
      } catch (e) {
        logger.error("Chart data selection error:", e);
        return [];
      }
    }, [
      activeChart,
      radarData,
      ashbyData,
      mfrDensityData,
      filteredData,
      selectedRheologyTemps,
    ]);

    const handleExport = async (format: "png" | "json") => {
      setIsExporting(true);
      try {
        if (format === "png" && chartInstance) {
          const dataUrl = chartInstance.getDataURL({
            type: "png",
            pixelRatio: 2,
            backgroundColor: "#fff",
          });
          const a = document.createElement("a");
          a.style.display = 'none';
          a.href = dataUrl;
          a.download = `resindb_${activeChart}_analysis.png`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 100);
        } else if (format === "json") {
          const jsonStr = JSON.stringify(currentChartData, null, 2);
          const blob = new Blob([jsonStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = 'none';
          a.href = url;
          a.download = `resindb_${activeChart}_data.json`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 100);
        }
      } catch (e) {
        logger.error("Failed to export chart:", e);
      } finally {
        setIsExporting(false);
      }
    };

    const chartDescriptions = {
      radar: t("desc_radar"),
      ashby: t("desc_ashby"),
      mfr_density: t("desc_mfr_density"),
      gpc: t("desc_gpc"),
      rheology: t("desc_rheology"),
      parallel: t(
        "desc_parallel",
        "多维属性坐标展示，对比多个物料在不同性能指标下的整体表现模式。",
      ),
    };

    const toggleRheologyTemp = (temp: number) => {
      setSelectedRheologyTemps((prev) =>
        prev.includes(temp)
          ? prev.filter((t) => t !== temp)
          : [...prev, temp].sort(),
      );
    };

    // Check if we have valid data for the current view to show improved empty state
    const hasValidData = useMemo(() => {
      if (!currentChartData || filteredData.length === 0) return false;
      
      // 1. Array-based data (GPC)
      if (Array.isArray(currentChartData)) return currentChartData.length > 0;
      
      // 2. Series-based data (Scatter/Radar/Parallel)
      const chartObj = currentChartData as {
        series?: { data?: unknown[]; value?: unknown[] }[];
        products?: unknown[];
      };
      if (chartObj.series) {
        return chartObj.series.length > 0 && chartObj.series.some((s) => 
          (s.data?.length ?? 0) > 0 || (s.value?.length ?? 0) > 0
        );
      }
      
      // 3. Model-based data (Rheology)
      if (chartObj.products) {
        return chartObj.products.length > 0;
      }

      return true;
    }, [currentChartData, filteredData]);

    const activeInsight = useMemo(() => {
      const insight = materialEngine.generateExpertInsight(activeChart);
      
      const chartData = currentChartData as { series?: { name: string; data: [number, number][] }[] };
      
      // 1. Ashby/Scatter Statistical Rigor
      if ((activeChart === 'ashby' || activeChart === 'mfr_density') && chartData?.series) {
        const allPoints: [number, number][] = [];
        chartData.series.forEach((s) => {
          if (Array.isArray(s.data)) {
            s.data.forEach((d) => {
              if (Array.isArray(d) && typeof d[0] === 'number' && typeof d[1] === 'number') {
                allPoints.push([d[0], d[1]]);
              }
            });
          }
        });
        
        if (allPoints.length > 3) {
          const corr = materialEngine.analyzeCorrelation(allPoints);
          const pearson = materialEngine.calculatePearson(allPoints);
          
          if (corr && corr.r2 > 0.05) {
            const ci = materialEngine.calculateCI(allPoints, corr.slope, corr.intercept);
            const pValue = materialEngine.calculatePValue(pearson, allPoints.length);
            const spearman = materialEngine.calculateSpearman(allPoints);
            const integrity = materialEngine.analyzeDatalineIntegrity(allPoints, corr.slope, corr.intercept);
            
            insight.content += `\n\n[高阶数理统计报告]`;
            insight.content += `\n- 线性关联 (Pearson r): ${pearson.toFixed(4)}`;
            insight.content += `\n- 单调关联 (Spearman ρ): ${spearman.toFixed(4)}`;
            insight.content += `\n- 统计显著性 (P-Value): ${pValue < 0.001 ? "< 0.001" : pValue.toFixed(4)}`;
            insight.content += `\n- 拟合置信度 (R²): ${(corr.r2 * 100).toFixed(1)}%`;
            
            if (pValue < 0.05) {
              const relType = Math.abs(pearson - spearman) > 0.2 ? "非线性单调" : "高度线性";
              insight.content += `\n- 物理逻辑判定: 存在${relType}正相关`;
            } else {
              insight.content += `\n- 结论强度: 统计不显著 (数据可能受实验误差主导)`;
            }

            if (ci) {
              insight.content += `\n- 斜率置信区间 (95%): [${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`;
            }

            if (integrity.healthScore < 80) {
              insight.content += `\n- ⚠️ 稳健性提示: 模型受 ${integrity.influentialPointsCount} 个高槓杆特征点主导，置信度受限。`;
            }
            
            // Robust Outlier Detection
            const xValues = allPoints.map(p => p[0]);
            const iqrOutliers = materialEngine.findOutliersIQR(xValues);
            if (iqrOutliers.length > 0) {
              insight.content += `\n- 离群值排查: 检测到 ${iqrOutliers.length} 个实验偏离点，已通过 IQR 算法标记。`;
            }

            // Enhanced Distribution Analysis
            const stats = materialEngine.getStats(xValues);
            if (stats) {
              const momentsX = materialEngine.calculateDistributionMoments(xValues);
              const isNormal = Math.abs(momentsX?.skewness || 0) < 0.5;
              insight.content += `\n- 样本数理性: ${isNormal ? "符合正态分布" : "呈现偏态分布"}${!isNormal ? ` (SK: ${momentsX?.skewness.toFixed(2)})` : ""}`;
            }

            insight.content += `\n- 决策建议: ${pearson > 0.7 && pValue < 0.05 ? "模型具备高度物理预测力，可直接用于牌号配方反推。" : "数理关联一般，建议排除干扰项或增加样本量。"}`;
          }
        }
      }

      // 2. Radar Chart - Quality Balance Score
      const chartObj = currentChartData as { series?: { name: string; value: number[] }[] };
      if (activeChart === 'radar' && chartObj?.series) {
        const series = chartObj.series;
        insight.content += `\n\n[材料性能均衡性评价]`;
        series.forEach((s) => {
          if (Array.isArray(s.value)) {
            const pi = materialEngine.calculatePerformanceIndex(s.value);
            insight.content += `\n- ${s.name}: 均衡分 ${pi.toFixed(1)} ${pi > 80 ? "(全能型)" : pi > 50 ? "(平衡型)" : "(专业/偏科型)"}`;
          }
        });
      }
      
      return insight;
    }, [activeChart, currentChartData]);

    return (
      <div className="flex flex-col lg:flex-row h-full gap-4 overflow-y-auto lg:overflow-hidden custom-scrollbar">
        {/* Scientific Controls Sidebar */}
        <div
          className={`flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl lg:rounded-3xl transition-all duration-500 ease-out shrink-0 overflow-hidden shadow-xl print:hidden ${showConfig ? "w-full lg:w-72 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-10 border-0 pointer-events-none"}`}
        >
          <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 font-black text-xs md:text-sm text-slate-800 dark:text-white uppercase tracking-widest">
              <Activity size={16} className="text-emerald-500" />
              {t("analysisMode")}
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowConfig(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 rounded-md p-1"
            >
              <X size={20} />
            </motion.button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4 space-y-2">
              {[
                {
                  id: "radar",
                  label: t("chart_radar"),
                  icon: Hexagon,
                  color: "text-indigo-500",
                },
                {
                  id: "canvas_scatter",
                  label: t("chart_canvas_scatter", "Canvas Heatmap/Scatter"),
                  icon: Layers,
                  color: "text-purple-500",
                },
                {
                  id: "correlation",
                  label: "Correlation Matrix",
                  icon: Target,
                  color: "text-rose-500",
                },
                {
                  id: "ashby",
                  label: t("chart_ashby"),
                  icon: ScatterChart,
                  color: "text-rose-500",
                },
                {
                  id: "mfr_density",
                  label: t("chart_mfr_density"),
                  icon: Target,
                  color: "text-sky-500",
                },
                {
                  id: "gpc",
                  label: t("chart_gpc"),
                  icon: Waves,
                  color: "text-blue-500",
                },
                {
                  id: "rheology",
                  label: t("chart_rheology"),
                  icon: Activity,
                  color: "text-amber-500",
                },
                {
                  id: "parallel",
                  label: t("chart_parallel", "平行坐标分析"),
                  icon: Layers,
                  color: "text-emerald-500",
                },
                {
                  id: "similarity_graph",
                  label: t("chart_similarity", "相似度网络 (Similarity Network)"),
                  icon: Network,
                  color: "text-purple-500",
                },
                {
                   id: "rsm",
                   label: t("chart_rsm", "响应面分析 (RSM)"),
                   icon: Calculator,
                   color: "text-indigo-500"
                },
                {
                   id: "feature_importance",
                   label: t("chart_fi", "特征敏感度归因 (SHAP / LASSO)"),
                   icon: BarChart3,
                   color: "text-rose-500"
                },
                {
                   id: "kde_topology",
                   label: t("chart_kde", "平滑拓扑/热力 (2D KDE)"),
                   icon: Map,
                   color: "text-orange-500"
                },
                {
                   id: "weibull",
                   label: t("chart_weibull", "批次可靠性评估 (Weibull)"),
                   icon: ShieldAlert,
                   color: "text-cyan-500"
                },
                {
                   id: "wlf_tts",
                   label: t("chart_wlf", "时温等效主曲线 (WLF TTS)"),
                   icon: ThermometerSnowflake,
                   color: "text-blue-500"
                },
                {
                   id: "copula",
                   label: t("chart_copula", "双变量相依失效 (Copula)"),
                   icon: Combine,
                   color: "text-fuchsia-500"
                },
                {
                   id: "arrhenius",
                   label: t("chart_arrhenius", "热氧老化寿命预测 (Arrhenius)"),
                   icon: Flame,
                   color: "text-orange-600"
                },
                {
                   id: "sobol",
                   label: t("chart_sobol", "方差分解敏感度 (Sobol)"),
                   icon: BarChart3,
                   color: "text-indigo-500"
                },
                {
                   id: "spc",
                   label: t("chart_spc", "SPC 制程能力分析"),
                   icon: Factory,
                   color: "text-emerald-600"
                },
                {
                   id: "bayes",
                   label: t("chart_bayes", "Bayesian 逆向设计"),
                   icon: BrainCircuit,
                   color: "text-pink-500"
                },
                {
                   id: "moo",
                   label: t("chart_moo", "多目标帕累托优化 (Pareto MOO)"),
                   icon: GitMerge,
                   color: "text-orange-500"
                },
                {
                   id: "mahalanobis",
                   label: t("chart_mahalanobis", "马氏距离异常检测"),
                   icon: Target,
                   color: "text-rose-600"
                },
                {
                   id: "kinetics",
                   label: t("chart_kinetics", "Kissinger 固化动力学"),
                   icon: Zap,
                   color: "text-teal-500"
                },
                {
                   id: "prony",
                   label: t("chart_prony", "Prony 级数本构提取"),
                   icon: Activity,
                   color: "text-purple-500"
                }
              ].map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveChart(item.id as ViewChartType)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                    activeChart === item.id
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg"
                      : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 ${activeChart === item.id ? "bg-white/20 text-white" : item.color}`}
                  >
                    <item.icon size={18} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {item.label}
                  </span>
                  {activeChart === item.id && (
                    <motion.div
                      layoutId="active-chart-indicator"
                      className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500"
                    ></motion.div>
                  )}
                </motion.button>
              ))}
            </div>

            {/* --- Canvas Scatter Specific Settings --- */}
            {activeChart === "canvas_scatter" && (
              <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                  <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                    <Target size={16} className="text-purple-500" />
                    轴映射 (Axes)
                  </div>
                  <div className="space-y-4">
                    <button
                        onClick={() => {
                           setScatterXKey("PC1");
                           setScatterYKey("PC2");
                        }}
                        className="w-full py-2 bg-purple-500 text-white rounded font-bold text-xs hover:bg-purple-600 transition-colors"
                    >
                       🔮 Auto PCA Projection
                    </button>
                    <button
                        onClick={() => {
                           if (Object.keys(clusters).length > 0) {
                              computeKMeans([], []);
                           } else {
                              const keys = Array.from(new Set(data.flatMap(p => Object.keys(p.properties || {})))).filter(k => {
                                 const v = filteredData[0]?.properties?.[k]?.value;
                                 return v !== undefined && !isNaN(parseFloat(String(v)));
                              });
                              const dataPayload = filteredData.map(d => {
                                  const v: Record<string, number> = {};
                                  keys.forEach(k => v[k] = parseFloat(String(d.properties?.[k]?.value)) || 0);
                                  return { id: d.id, values: v };
                              });
                              computeKMeans(dataPayload, keys);
                           }
                        }}
                        className={`w-full py-2 rounded font-bold text-xs transition-colors flex items-center justify-center gap-2 ${
                           Object.keys(clusters).length > 0 
                             ? "bg-rose-100 text-rose-700 hover:bg-rose-200" 
                             : "bg-rose-500 text-white hover:bg-rose-600"
                        }`}
                    >
                       🤖 {isComputingKMeans ? "Computing..." : Object.keys(clusters).length > 0 ? "Clear Clusters" : "K-Means Auto Grouping"}
                    </button>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-2">X Axis</label>
                      <select 
                        value={scatterXKey} 
                        onChange={e => setScatterXKey(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                         <optgroup label="Properties">
                            {Array.from(new Set(data.flatMap(p => Object.keys(p.properties || {})))).map(key => (
                              <option key={key} value={key}>{key}</option>
                            ))}
                         </optgroup>
                         {formulas.length > 0 && (
                           <optgroup label="Formulas">
                              {formulas.map(f => <option key={f.id} value={`formula-${f.id}`}>{f.name}</option>)}
                           </optgroup>
                         )}
                         <optgroup label="PCA Projection">
                            <option value="PC1">Principal Component 1 (PC1)</option>
                            <option value="PC2">Principal Component 2 (PC2)</option>
                         </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-2">Y Axis</label>
                      <select 
                        value={scatterYKey} 
                        onChange={e => setScatterYKey(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      >
                         <optgroup label="Properties">
                            {Array.from(new Set(data.flatMap(p => Object.keys(p.properties || {})))).map(key => (
                              <option key={key} value={key}>{key}</option>
                            ))}
                         </optgroup>
                         {formulas.length > 0 && (
                           <optgroup label="Formulas">
                              {formulas.map(f => <option key={f.id} value={`formula-${f.id}`}>{f.name}</option>)}
                           </optgroup>
                         )}
                         <optgroup label="PCA Projection">
                            <option value="PC1">Principal Component 1 (PC1)</option>
                            <option value="PC2">Principal Component 2 (PC2)</option>
                         </optgroup>
                      </select>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                         <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">厂商品牌性能凸包分析</label>
                            <input 
                               type="checkbox" 
                               checked={enableConvexHull} 
                               onChange={e => setEnableConvexHull(e.target.checked)}
                               className="accent-purple-500 w-4 h-4 rounded"
                            />
                         </div>
                         <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">多目标帕累托寻优 (Pareto)</label>
                            <input 
                               type="checkbox" 
                               checked={enablePareto} 
                               onChange={e => setEnablePareto(e.target.checked)}
                               className="accent-amber-500 w-4 h-4 rounded"
                            />
                         </div>
                         {enablePareto && (
                             <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400">X轴寻优</span>
                                  <select 
                                      value={paretoXDir} 
                                      onChange={e => setParetoXDir(e.target.value as 'min' | 'max')}
                                      className="bg-white dark:bg-slate-800 text-xs px-2 py-1 rounded border border-amber-200 dark:border-amber-700 outline-none"
                                  >
                                      <option value="max">最大化</option>
                                      <option value="min">最小化</option>
                                  </select>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400">Y轴寻优</span>
                                  <select 
                                      value={paretoYDir} 
                                      onChange={e => setParetoYDir(e.target.value as 'min' | 'max')}
                                      className="bg-white dark:bg-slate-800 text-xs px-2 py-1 rounded border border-amber-200 dark:border-amber-700 outline-none"
                                  >
                                      <option value="max">最大化</option>
                                      <option value="min">最小化</option>
                                  </select>
                                </div>
                             </div>
                         )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Rheology Specific Settings --- */}
            {activeChart === "rheology" && filteredData.length === 1 && (
              <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                  <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                    <Thermometer size={16} className="text-amber-500" />
                    温度曲线 (Temps)
                  </div>
                  <div className="space-y-2">
                    {[190, 210, 230].map((temp) => (
                      <motion.button
                        key={temp}
                        whileHover={{
                          scale: 1.02,
                          backgroundColor: selectedRheologyTemps.includes(temp)
                            ? undefined
                            : "rgba(245, 158, 11, 0.05)",
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleRheologyTemp(temp)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                          selectedRheologyTemps.includes(temp)
                            ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-400 shadow-sm font-black"
                            : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-amber-200/50"
                        }`}
                      >
                        <span className="text-xs font-bold">{temp}°C</span>
                        {selectedRheologyTemps.includes(temp) && (
                          <Check size={14} />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- Similarity Graph Settings --- */}
            {activeChart === "similarity_graph" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                   <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest">
                           <Activity size={16} className="text-amber-500" />
                           Network Config
                        </div>
                        {isCalculatingSim && <Loader2 size={14} className="animate-spin text-amber-500" />}
                      </div>
                      <div className="space-y-3">
                         <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Similarity Threshold: {(similarityThreshold * 100).toFixed(0)}%</label>
                            <input 
                               type="range" min="0.5" max="0.99" step="0.01" value={similarityThreshold}
                               onChange={e => setSimilarityThreshold(parseFloat(e.target.value))}
                               className="w-full accent-amber-500"
                            />
                         </div>
                         <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">Dimensions ({similarityFeatures.length} selected)</label>
                            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar p-1 border border-slate-200 dark:border-slate-700 rounded-lg">
                                {numericProperties.map(prop => (
                                    <button 
                                       key={prop}
                                       onClick={() => setSimilarityFeatures(prev => prev.includes(prop) ? prev.filter(f => f !== prop) : [...prev, prop])}
                                       className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md transition-colors ${
                                           similarityFeatures.includes(prop) ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                       }`}
                                    >
                                       {tProp(prop)}
                                    </button>
                                ))}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
            )}

            {/* --- RSM Settings --- */}
            {activeChart === "rsm" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Calculator size={16} className="text-indigo-500" />
                            模型设置 (Parameters)
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">变量 X1 (如含量1)</label>
                                <select 
                                    value={rsmX1Key} 
                                    onChange={e => setRsmX1Key(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">变量 X2 (如含量2)</label>
                                <select 
                                    value={rsmX2Key} 
                                    onChange={e => setRsmX2Key(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">目标响应 Y (性能追求值)</label>
                                <select 
                                    value={rsmYKey} 
                                    onChange={e => setRsmYKey(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (rsmX1Key && rsmX2Key && rsmYKey && rsmX1Key !== rsmX2Key) {
                                        const rsmData = filteredData.map(p => ({
                                            x1: getVal(p, rsmX1Key),
                                            x2: getVal(p, rsmX2Key),
                                            y: getVal(p, rsmYKey)
                                        })).filter(p => !isNaN(p.x1) && !isNaN(p.x2) && !isNaN(p.y));
                                        if(rsmData.length >= 6) {
                                           calculateRSM(rsmData);
                                        } else {
                                           alert("需要至少6个有效数据点");
                                        }
                                    } else {
                                        alert("无效或重复的变量选择");
                                    }
                                }}
                                disabled={isCalculatingRsm}
                                className="w-full py-2 bg-indigo-500 text-white rounded font-bold text-xs hover:bg-indigo-600 transition-colors disabled:opacity-50"
                            >
                                {isCalculatingRsm ? '拟合中...' : '开始 RSM 拟合计算 🚀'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

             {/* --- Feature Importance Settings --- */}
            {activeChart === "feature_importance" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <BarChart3 size={16} className="text-rose-500" />
                            因果推断 (Inference)
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">目标变量 (Target)</label>
                                <select 
                                    value={fiTargetKey} 
                                    onChange={e => setFiTargetKey(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (fiTargetKey) {
                                        const featureNames = numericProperties.filter(k => k !== fiTargetKey);
                                        const fiData = filteredData.map(p => {
                                            const fVals = featureNames.map(k => getVal(p, k));
                                            fVals.push(getVal(p, fiTargetKey));
                                            return fVals;
                                        }).filter(row => row.every(v => !isNaN(v)));
                                        
                                        if (fiData.length > featureNames.length + 1) {
                                           calculateImportance(fiData, featureNames);
                                        } else {
                                           alert("数据点数量不足以支撑高维回归");
                                        }
                                    }
                                }}
                                disabled={isCalculatingFI}
                                className="w-full py-2 bg-rose-500 text-white rounded font-bold text-xs hover:bg-rose-600 transition-colors disabled:opacity-50"
                            >
                                {isCalculatingFI ? '计算中...' : '运行特征敏感度分析'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

             {/* --- KDE Specific Settings --- */}
            {activeChart === "kde_topology" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Map size={16} className="text-orange-500" />
                            二维核密度 (2D KDE)
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">X 坐标映射</label>
                                <select 
                                    value={kdeXKey} 
                                    onChange={e => setKdeXKey(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">Y 坐标映射</label>
                                <select 
                                    value={kdeYKey} 
                                    onChange={e => setKdeYKey(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (kdeXKey && kdeYKey) {
                                        const pts = filteredData.map(p => ({
                                            x: getVal(p, kdeXKey), 
                                            y: getVal(p, kdeYKey)
                                        })).filter(p => !isNaN(p.x) && !isNaN(p.y));
                                        
                                        if (pts.length > 5) {
                                           calculateKde(pts);
                                        } else {
                                           alert("点数量过少，无法进行概率密度映射。");
                                        }
                                    }
                                }}
                                disabled={isCalculatingKDE}
                                className="w-full py-2 bg-orange-500 text-white rounded font-bold text-xs hover:bg-orange-600 transition-colors disabled:opacity-50"
                            >
                                {isCalculatingKDE ? '核卷积计算中...' : '生成拓扑等高密度映射'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

             {/* --- Weibull Settings --- */}
            {activeChart === "weibull" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <ShieldAlert size={16} className="text-cyan-500" />
                            可靠性评估 (Weibull)
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">拉伸/冲击性能极值点分析</label>
                                <select 
                                    value={weibullKey} 
                                    onChange={e => setWeibullKey(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                                >
                                    <option value="">-- 选择分析属性 --</option>
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (weibullKey) {
                                        const values = filteredData.map(p => getVal(p, weibullKey)).filter(v => !isNaN(v) && v > 0);
                                        if (values.length >= 3) {
                                           calculateWeibull(values);
                                        } else {
                                           alert("计算 Weibull 模量至少需要 3 个有效的正值数据。");
                                        }
                                    }
                                }}
                                disabled={isCalculatingWeibull || !weibullKey}
                                className="w-full py-2 bg-cyan-500 text-white rounded font-bold text-xs hover:bg-cyan-600 transition-colors disabled:opacity-50"
                            >
                                {isCalculatingWeibull ? '经验分布函数拟合中...' : '生成 Weibull 双对数图'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- WLF TTS Settings --- */}
            {activeChart === "wlf_tts" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <ThermometerSnowflake size={16} className="text-blue-500" />
                            主曲线拟合 (Master Curve)
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">流变参考温度 T_ref (°C)</label>
                                <select 
                                    value={wlfRefTemp} 
                                    onChange={e => setWlfRefTemp(Number(e.target.value))}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {selectedRheologyTemps.length > 0 ? selectedRheologyTemps.map(t => (
                                       <option key={t} value={t}>{t} °C</option> 
                                    )) : <option value="210">210 °C</option>}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    // Make sure we have exactly 1 product to analyze
                                    if (filteredData.length !== 1) {
                                        alert("WLF 主曲线计算通常针对单一材料的不同温度数据进行全尺度叠合。请先筛选出一个产品。");
                                        return;
                                    }
                                    const product = filteredData[0];
                                    const curvesData: { temp: number; points: { rate: number; visc: number }[] }[] = [];
                                    
                                    for (const temp of selectedRheologyTemps) {
                                        const key = `流变曲线_${temp}℃`;
                                        const pts = product.properties[key]?.value;
                                        if (pts && typeof pts === 'string') {
                                           const parsed = materialEngine.parseRheologyData(pts);
                                           if (parsed.length > 0) {
                                               curvesData.push({ temp, points: parsed });
                                           }
                                        }
                                    }
                                    if (curvesData.length >= 2) {
                                        calculateWLF(curvesData, wlfRefTemp);
                                    } else {
                                        alert("计算 WLF 时温移动因子至少需要该材料包含 2 个不同温度的流变曲线数据。");
                                    }
                                }}
                                disabled={isCalculatingWLF || filteredData.length !== 1 || selectedRheologyTemps.length < 2}
                                className="w-full py-2 bg-blue-500 text-white rounded font-bold text-xs hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {isCalculatingWLF ? '平移因子叠合计算中...' : '叠合 TTS 全尺度主曲线'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Copula Settings --- */}
            {activeChart === "copula" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Combine size={16} className="text-fuchsia-500" />
                            联合概率相依性分析
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">变量 X</label>
                                <select 
                                    value={copulaXKey} 
                                    onChange={e => setCopulaXKey(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">变量 Y</label>
                                <select 
                                    value={copulaYKey} 
                                    onChange={e => setCopulaYKey(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none"
                                >
                                    {numericProperties.map(key => <option key={key} value={key}>{key}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    if (copulaXKey && copulaYKey) {
                                        const pts = filteredData.map(p => ({
                                            x: getVal(p, copulaXKey), 
                                            y: getVal(p, copulaYKey)
                                        })).filter(p => !isNaN(p.x) && !isNaN(p.y));
                                        
                                        if (pts.length > 5) {
                                           setCopulaThreshX("");
                                           setCopulaThreshY("");
                                           setJointFailureProb(null);
                                           calculateCopula(pts);
                                        } else {
                                           alert("数据点数量过少，无法估计 Gaussian Copula 联合分布。");
                                        }
                                    }
                                }}
                                disabled={isCalculatingCopula}
                                className="w-full py-2 bg-fuchsia-500 text-white rounded font-bold text-xs hover:bg-fuchsia-600 transition-colors disabled:opacity-50"
                            >
                                {isCalculatingCopula ? '似然估计中...' : '生成 Copula 概率密度'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Arrhenius Settings --- */}
            {activeChart === "arrhenius" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Flame size={16} className="text-orange-600" />
                            热氧老化数据输入
                        </div>
                        <div className="space-y-3">
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-2 rounded border border-orange-100 dark:border-orange-800/50">
                                <p className="text-[10px] text-orange-800 dark:text-orange-400 mb-2 font-bold leading-tight">可以点击“提取”从当前选中牌号的名字带温度的属性中自动提取，或手动输入。</p>
                                <button 
                                    onClick={() => {
                                        if(filteredData.length !== 1) return alert("请在左侧筛选面板中只保留1款牌号数据！");
                                        const p = filteredData[0];
                                        const newPts = [];
                                        for(const k of numericProperties) {
                                             const val = getVal(p, k);
                                             if(!isNaN(val) && val > 0) {
                                                 const match = k.match(/(\d+)\s*[℃C]/);
                                                 if(match) {
                                                     newPts.push({ id: Date.now()+Math.random(), temp: Number(match[1]), time: val });
                                                 }
                                             }
                                        }
                                        if(newPts.length >= 2) setArrheniusPoints(newPts); 
                                        else alert("提取失败：该材料缺乏带温度标记的失效时间属性（如: 氧化诱导期_150C），请手动输入。");
                                    }}
                                    className="w-full bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-[10px] py-1 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                                >从产品属性智能提取</button>
                            </div>

                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 text-center">
                                    <div className="col-span-4">温度(°C)</div>
                                    <div className="col-span-6">失效时间(h)</div>
                                    <div className="col-span-2"></div>
                                </div>
                                {arrheniusPoints.map((pt, idx) => (
                                    <div key={pt.id} className="grid grid-cols-12 gap-2 items-center">
                                        <input 
                                            type="number" 
                                            value={pt.temp} 
                                            onChange={e => {
                                                const newPts = [...arrheniusPoints];
                                                newPts[idx].temp = Number(e.target.value);
                                                setArrheniusPoints(newPts);
                                            }}
                                            className="col-span-4bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs px-1 py-1 rounded text-center outline-none" 
                                        />
                                        <input 
                                            type="number" 
                                            value={pt.time} 
                                            onChange={e => {
                                                const newPts = [...arrheniusPoints];
                                                newPts[idx].time = Number(e.target.value);
                                                setArrheniusPoints(newPts);
                                            }}
                                            className="col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs px-1 py-1 rounded text-center outline-none" 
                                        />
                                        <button 
                                            onClick={() => setArrheniusPoints(arrheniusPoints.filter(p => p.id !== pt.id))}
                                            className="col-span-2 text-slate-400 hover:text-rose-500"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                            
                            <button
                                onClick={() => setArrheniusPoints([...arrheniusPoints, {id: Date.now(), temp: 100, time: 1000}])}
                                className="w-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 text-xs py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                            >+ 添加测试点</button>

                            <button
                                onClick={() => {
                                    if(arrheniusPoints.length >= 2) calculateArrhenius(arrheniusPoints.map(p => ({tempC: p.temp, time: p.time})));
                                    else alert("阿伦尼乌斯需要至少 2 个实验数据点进行拟合运算。");
                                }}
                                disabled={isCalculatingArrhenius}
                                className="w-full py-2 bg-orange-600 text-white rounded font-bold text-xs hover:bg-orange-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingArrhenius ? '拟合中...' : '启动寿命衰退模型'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Sobol Settings --- */}
            {activeChart === "sobol" && formulas && formulas.length > 0 && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Activity size={16} className="text-indigo-500" />
                            Sobol 敏感度分析设定
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">目标公式</label>
                                <select 
                                    value={sobolTargetFormulaId}
                                    onChange={e => setSobolTargetFormulaId(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs outline-none"
                                >
                                    <option value="" disabled>选择分析目标...</option>
                                    {formulas.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {sobolTargetFormulaId && (
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">输入特征方差波动率 (%)</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                        {numericProperties.map(key => (
                                            <div key={key} className="flex items-center gap-2 text-xs">
                                                <span className="flex-1 truncate text-slate-600 dark:text-slate-400">{key}</span>
                                                <input 
                                                    type="number"
                                                    value={sobolVariances[key] || ""}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        setSobolVariances(prev => ({
                                                            ...prev,
                                                            [key]: isNaN(val) ? 0 : val
                                                        }));
                                                    }}
                                                    placeholder="0"
                                                    className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded px-1.5 py-1 outline-none text-right font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <span className="text-slate-400 font-bold">%</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-1 leading-tight">仅设置 &gt;0 的变量将作为敏感度分析的输入维度。</div>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">采样基数 (N)</label>
                                <input 
                                    type="number"
                                    value={sobolIterations}
                                    onChange={e => setSobolIterations(Number(e.target.value))}
                                    step={100}
                                    min={100}
                                    max={10000}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                />
                                <div className="text-[9px] text-slate-400 mt-1 leading-tight">总估算次数: <span className="font-bold">{sobolIterations * (Object.values(sobolVariances).filter(v => v > 0).length + 2)}</span></div>
                            </div>

                            <button
                                onClick={() => {
                                    if(!sobolTargetFormulaId) return alert("请选择目标公式");
                                    if(filteredData.length !== 1) return alert("请在右侧数据表中仅保留 1 款基准牌号进行方差扰动（可以通过搜索或筛选）！");
                                    if(!formulas) return;
                                    if(Object.values(sobolVariances).every(v => !v || v <= 0)) return alert("请至少设置一个变量的方差波动率 > 0");
                                    runSobol(sobolTargetFormulaId, formulas, filteredData[0], sobolVariances, sobolIterations);
                                }}
                                disabled={isCalculatingSobol}
                                className="w-full py-2 bg-indigo-600 text-white rounded font-bold text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingSobol ? '蒙特卡洛计算中...' : '运行方差分解'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SPC Settings --- */}
            {activeChart === "spc" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Factory size={16} className="text-emerald-500" />
                            SPC & 工序能力分析 (Capability)
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">监控检验特征 (Target Property)</label>
                                <select 
                                    value={spcTargetKey}
                                    onChange={e => setSpcTargetKey(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs outline-none"
                                >
                                    <option value="" disabled>选择需要做能力评估的特征...</option>
                                    {numericProperties.map(k => (
                                        <option key={k} value={k}>{k}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] items-center uppercase font-bold text-slate-500 flex justify-between mb-1">
                                        <span>公差下限 (LSL)</span>
                                    </label>
                                    <input 
                                        type="number"
                                        value={spcLSL}
                                        onChange={e => setSpcLSL(e.target.value === "" ? "" : Number(e.target.value))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                                        placeholder="Min limit"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] items-center uppercase font-bold text-slate-500 flex justify-between mb-1">
                                        <span>公差上限 (USL)</span>
                                    </label>
                                    <input 
                                        type="number"
                                        value={spcUSL}
                                        onChange={e => setSpcUSL(e.target.value === "" ? "" : Number(e.target.value))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs outline-none focus:border-red-500"
                                        placeholder="Max limit"
                                    />
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    if(!spcTargetKey) return alert("请指定监控特征");
                                    if(spcUSL === "" || spcLSL === "" || Number(spcUSL) <= Number(spcLSL)) {
                                          return alert("请正确设置 USL 和 LSL（USL 必须大于 LSL）");
                                    }
                                    const data = filteredData.map(p => getVal(p, spcTargetKey)).filter(v => !isNaN(v));
                                    if (data.length < 2) return alert("数据量不足，该特征带有效数字的样本至少需要 2 个。当前特征可用数据: " + data.length);
                                    calculateSpc(data, Number(spcUSL), Number(spcLSL));
                                }}
                                disabled={isCalculatingSpc}
                                className="w-full py-2 bg-emerald-600 text-white rounded font-bold text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingSpc ? '样本流处理中...' : '生成 SPC 统计报告'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Bayes Settings --- */}
            {activeChart === "bayes" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <BrainCircuit size={16} className="text-pink-500" />
                            Bayesian Optimization
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">设计自变量 (X Features)</label>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                    {numericProperties.map(key => (
                                        <label key={key} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={bayesFeatures.includes(key)}
                                                onChange={(e) => {
                                                    if(e.target.checked) setBayesFeatures(prev => [...prev, key]);
                                                    else setBayesFeatures(prev => prev.filter(k => k !== key));
                                                }}
                                                className="rounded border-slate-300 text-pink-500 focus:ring-pink-500"
                                            />
                                            <span className="truncate flex-1">{key}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-1">控制模型生成下阶段候选解的配方成分或工艺参数。</div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">优化目标 (y Target)</label>
                                <select 
                                    value={bayesTarget}
                                    onChange={e => setBayesTarget(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs outline-none"
                                >
                                    <option value="" disabled>选择期望优化的特征...</option>
                                    {numericProperties.map(k => (
                                        <option key={k} value={k}>{k}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-[10px] uppercase font-bold text-slate-500">优化方向</span>
                                <div className="flex gap-2 text-xs font-bold">
                                    <button 
                                        onClick={() => setBayesMaximize(true)}
                                        className={`px-3 py-1 rounded ${bayesMaximize ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >最大化</button>
                                    <button 
                                        onClick={() => setBayesMaximize(false)}
                                        className={`px-3 py-1 rounded ${!bayesMaximize ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >最小化</button>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    if(bayesFeatures.length === 0) return alert("请至少选择一个设计自变量(X)");
                                    if(!bayesTarget) return alert("请指定优化目标(y)");
                                    const dataRecord: Record<string, number>[] = [];
                                    for (const p of filteredData) {
                                        const r: Record<string, number> = {};
                                        let validRow = true;
                                        for (const f of bayesFeatures) {
                                            const v = getVal(p, f);
                                            if (isNaN(v)) { validRow = false; break; }
                                            r[f] = v;
                                        }
                                        const ty = getVal(p, bayesTarget);
                                        if (isNaN(ty)) validRow = false;
                                        r[bayesTarget] = ty;
                                        
                                        if (validRow) dataRecord.push(r);
                                    }

                                    if (dataRecord.length < 3) return alert("可用数据量不足。用于高斯过程回归的历史完整记录（特征和目标均无空值）必须≥3条，当前为: " + dataRecord.length);
                                    runBayesOpt(dataRecord, bayesFeatures, bayesTarget, bayesMaximize);
                                }}
                                disabled={isCalculatingBayes}
                                className="w-full py-2 bg-pink-600 text-white rounded font-bold text-xs hover:bg-pink-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingBayes ? '构建高斯过程并搜索中...' : '逆向推荐下一组材料配方'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Moo Settings --- */}
            {activeChart === "moo" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <GitMerge size={16} className="text-orange-500" />
                            Multi-Objective Pareto
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">设计自变量 (X Features)</label>
                                <div className="max-h-32 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                    {numericProperties.map(key => (
                                        <label key={key} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={mooFeatures.includes(key)}
                                                onChange={(e) => {
                                                    if(e.target.checked) setMooFeatures(prev => [...prev, key]);
                                                    else setMooFeatures(prev => prev.filter(k => k !== key));
                                                }}
                                                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="truncate flex-1">{key}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">多重优化目标 (Y Targets & Priorities)</label>
                                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 px-1 border-b border-slate-200 dark:border-slate-700 pb-1">
                                         <div className="flex-1">特征名称</div>
                                         <div className="w-20 text-center">方向</div>
                                         <div className="w-6"></div>
                                    </div>
                                    {mooTargets.map((t, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-1">
                                            <select 
                                                 value={t.name}
                                                 onChange={(e) => {
                                                     const nw = [...mooTargets];
                                                     nw[idx].name = e.target.value;
                                                     setMooTargets(nw);
                                                 }}
                                                 className="flex-1 w-full text-xs bg-transparent outline-none truncate"
                                            >
                                                <option value="" disabled>选择特征...</option>
                                                {numericProperties.map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                            <button 
                                                onClick={() => {
                                                    const nw = [...mooTargets];
                                                    nw[idx].maximize = !nw[idx].maximize;
                                                    setMooTargets(nw);
                                                }}
                                                className={`w-16 text-[10px] py-1 rounded font-bold ${t.maximize ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400'}`}
                                            >
                                                {t.maximize ? "最大化" : "最小化"}
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setMooTargets(mooTargets.filter((_, i) => i !== idx));
                                                }}
                                                className="text-slate-400 hover:text-red-500 w-4 pl-1"
                                            >×</button>
                                        </div>
                                    ))}
                                    {mooTargets.length < 2 && (
                                         <button 
                                            onClick={() => setMooTargets([...mooTargets, { name: "", maximize: true }])}
                                            className="w-full py-1 border border-dashed border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-xs rounded hover:bg-orange-50 dark:hover:bg-orange-900/30"
                                         >+ 添加子目标</button>
                                    )}
                                    {mooTargets.length === 2 && (
                                         <div className="text-[10px] text-slate-400 text-center py-1">目前最多支持双目标帕累托可视化展开。</div>
                                    )}
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    if(mooFeatures.length === 0) return alert("请至少选择一个设计自变量(X)");
                                    if(mooTargets.length < 2) return alert("MOO 帕累托优化至少需要 2 个目标成分！");
                                    for(const t of mooTargets) if(!t.name) return alert("目标不能为空！");
                                    
                                    const dataRecord: Record<string, number>[] = [];
                                    for (const p of filteredData) {
                                        const r: Record<string, number> = {};
                                        let validRow = true;
                                        for (const f of mooFeatures) {
                                            const v = getVal(p, f);
                                            if (isNaN(v)) { validRow = false; break; }
                                            r[f] = v;
                                        }
                                        for (const t of mooTargets) {
                                            const tv = getVal(p, t.name);
                                            if (isNaN(tv)) { validRow = false; break; }
                                            r[t.name] = tv;
                                        }
                                        
                                        if (validRow) dataRecord.push(r);
                                    }

                                    if (dataRecord.length < 3) return alert("可用数据量不足。用于高斯过程回归的历史完整记录（特征和目标均无空值）必须≥3条，当前为: " + dataRecord.length);
                                    runMooOpt(dataRecord, mooFeatures, mooTargets);
                                }}
                                disabled={isCalculatingMoo}
                                className="w-full py-2 bg-orange-600 text-white rounded font-bold text-xs hover:bg-orange-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingMoo ? '构建并行 GP 与寻找帕累托边界中...' : '生成多目标妥协前沿'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Mahalanobis Settings --- */}
            {activeChart === "mahalanobis" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Target size={16} className="text-rose-600" />
                            Mahalanobis Anomaly
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">监控特征变量群 (Features)</label>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                                    {numericProperties.map(key => (
                                        <label key={key} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={mahalanobisFeatures.includes(key)}
                                                onChange={(e) => {
                                                    if(e.target.checked) setMahalanobisFeatures(prev => [...prev, key]);
                                                    else setMahalanobisFeatures(prev => prev.filter(k => k !== key));
                                                }}
                                                className="rounded border-slate-300 text-rose-600 focus:ring-rose-600"
                                            />
                                            <span className="truncate flex-1">{key}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-1">推荐选择 3-5 个彼此可能存在相互关联的物理性能指标。</div>
                            </div>
                            
                            <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-[10px] uppercase font-bold text-slate-500">检测灵敏度 (α 水平)</span>
                                <div className="flex gap-2 text-xs font-bold">
                                    <button 
                                        onClick={() => setMahalanobisAlpha(0.05)}
                                        className={`px-2 py-1 rounded ${mahalanobisAlpha === 0.05 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >0.05</button>
                                    <button 
                                        onClick={() => setMahalanobisAlpha(0.01)}
                                        className={`px-2 py-1 rounded ${mahalanobisAlpha === 0.01 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >0.01</button>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    if(mahalanobisFeatures.length < 2) return alert("请至少选择两个监控特征");
                                    const dataRecord: (Record<string, number> & { _id: string, name: string })[] = [];
                                    for (const p of filteredData) {
                                        const r = { _id: p.id, name: p.gradeName } as Record<string, number> & { _id: string, name: string };
                                        let validRow = true;
                                        for (const f of mahalanobisFeatures) {
                                            const v = getVal(p, f);
                                            if (isNaN(v)) { validRow = false; break; }
                                            r[f] = v;
                                        }
                                        if (validRow) dataRecord.push(r);
                                    }

                                    if (dataRecord.length <= mahalanobisFeatures.length) {
                                        return alert(`可用完整数据量不足。特征数为 ${mahalanobisFeatures.length}，必须包含至少 ${mahalanobisFeatures.length + 1} 个完整样本，当前为: ${dataRecord.length}`);
                                    }
                                    runMahalanobis(dataRecord, mahalanobisFeatures, mahalanobisAlpha);
                                }}
                                disabled={isCalculatingMahalanobis}
                                className="w-full py-2 bg-rose-600 text-white rounded font-bold text-xs hover:bg-rose-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingMahalanobis ? '多维协方差阵算力接入中...' : '生成特征联合异常排查图谱'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Kinetics Settings --- */}
            {activeChart === "kinetics" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Zap size={16} className="text-teal-500" />
                            Kissinger Kinetics
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">DSC 升温数据集</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 px-1 border-b border-slate-200 dark:border-slate-700 pb-1">
                                        <div className="flex-1">速率 β (K/min)</div>
                                        <div className="flex-1">峰温 Tp (°C)</div>
                                        <div className="w-4"></div>
                                    </div>
                                    {kineticsData.map((row, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input 
                                                type="number"
                                                value={row.beta === 0 ? '' : row.beta}
                                                onChange={(e) => {
                                                    const newData = [...kineticsData];
                                                    newData[idx].beta = Number(e.target.value);
                                                    setKineticsData(newData);
                                                }}
                                                className="w-full text-xs font-mono px-1 py-1 tabular-nums border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900" 
                                            />
                                            <input 
                                                type="number"
                                                value={row.tp === 0 ? '' : row.tp}
                                                onChange={(e) => {
                                                    const newData = [...kineticsData];
                                                    newData[idx].tp = Number(e.target.value);
                                                    setKineticsData(newData);
                                                }}
                                                className="w-full text-xs font-mono px-1 py-1 tabular-nums border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900" 
                                            />
                                            <button 
                                                onClick={() => {
                                                    const newData = kineticsData.filter((_, i) => i !== idx);
                                                    setKineticsData(newData);
                                                }}
                                                className="text-slate-400 hover:text-red-500"
                                            ><X size={12}/></button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => setKineticsData([...kineticsData, { beta: 0, tp: 0 }])}
                                        className="w-full py-1 border border-dashed border-teal-300 dark:border-teal-800 text-teal-600 dark:text-teal-400 text-xs rounded hover:bg-teal-50 dark:hover:bg-teal-900/30"
                                    >+ 添加数据点</button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">工艺设定恒温预测点 (°C)</label>
                                <input 
                                    type="number"
                                    value={kineticsIsoTemp}
                                    onChange={(e) => setKineticsIsoTemp(Number(e.target.value))}
                                    className="w-full text-xs font-mono px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900" 
                                />
                            </div>

                            <button
                                onClick={() => {
                                    const validData = kineticsData.filter(d => d.beta > 0 && d.tp > 0);
                                    if(validData.length < 3) return alert("Kissinger 模型拟合至少需要 3 组完整有效数据点！");
                                    runKinetics(validData, kineticsIsoTemp);
                                }}
                                disabled={isCalculatingKinetics}
                                className="w-full py-2 bg-teal-600 text-white rounded font-bold text-xs hover:bg-teal-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingKinetics ? '动力学特征拟合中心计算中...' : 'OLS 拟合与生成固化预测'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Prony Settings --- */}
            {activeChart === "prony" && (
                <div className="px-4 pb-4 animate-in slide-in-from-left-2 fade-in duration-300">
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3">
                        <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest mb-3">
                            <Activity size={16} className="text-purple-500" />
                            Prony Series (gMM)
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">主曲线宽频数据集 (Master Curve)</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 px-1 border-b border-slate-200 dark:border-slate-700 pb-1">
                                        <div className="flex-1" title="Frequency (rad/s)">ω (rad/s)</div>
                                        <div className="flex-1" title="Storage Modulus (MPa)">E' (MPa)</div>
                                        <div className="flex-1" title="Loss Modulus (MPa)">E'' (MPa)</div>
                                        <div className="w-4"></div>
                                    </div>
                                    {pronyData.map((row, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input 
                                                type="number"
                                                value={row.omega === 0 ? '' : row.omega}
                                                onChange={(e) => {
                                                    const newData = [...pronyData];
                                                    newData[idx].omega = Number(e.target.value);
                                                    setPronyData(newData);
                                                }}
                                                className="w-full text-xs font-mono px-1 py-1 tabular-nums border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900" 
                                            />
                                            <input 
                                                type="number"
                                                value={row.storage === 0 ? '' : row.storage}
                                                onChange={(e) => {
                                                    const newData = [...pronyData];
                                                    newData[idx].storage = Number(e.target.value);
                                                    setPronyData(newData);
                                                }}
                                                className="w-full text-xs font-mono px-1 py-1 tabular-nums border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900" 
                                            />
                                            <input 
                                                type="number"
                                                value={row.loss === 0 ? '' : row.loss}
                                                onChange={(e) => {
                                                    const newData = [...pronyData];
                                                    newData[idx].loss = Number(e.target.value);
                                                    setPronyData(newData);
                                                }}
                                                className="w-full text-xs font-mono px-1 py-1 tabular-nums border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900" 
                                            />
                                            <button 
                                                onClick={() => {
                                                    const newData = pronyData.filter((_, i) => i !== idx);
                                                    setPronyData(newData);
                                                }}
                                                className="text-slate-400 hover:text-red-500"
                                            ><X size={12}/></button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => setPronyData([...pronyData, { omega: 0, storage: 0, loss: 0 }])}
                                        className="w-full py-1 border border-dashed border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400 text-xs rounded hover:bg-purple-50 dark:hover:bg-purple-900/30"
                                    >+ 添加观测点</button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">麦克斯韦模型阶数 (N Terms)</label>
                                <input 
                                    type="number"
                                    min="1" max="20"
                                    value={pronyTerms}
                                    onChange={(e) => setPronyTerms(Number(e.target.value))}
                                    className="w-full text-xs font-mono px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900" 
                                />
                                <div className="text-[9px] text-slate-400 mt-1">控制松弛时间谱的分辨率。</div>
                            </div>

                            <button
                                onClick={() => {
                                    const validData = pronyData.filter(d => d.omega > 0 && d.storage > 0 && d.loss > 0);
                                    if(validData.length < Math.max(3, pronyTerms)) return alert("数据点不足！有效观测点数量必须 ≥ 模型阶数及其基础要求。");
                                    runProny(validData, pronyTerms);
                                }}
                                disabled={isCalculatingProny}
                                className="w-full py-2 bg-purple-600 text-white rounded font-bold text-xs hover:bg-purple-700 transition-colors disabled:opacity-50 mt-2 block"
                            >
                                {isCalculatingProny ? '非负约束最小二乘法拟合中...' : '提取 Prony 级数参数'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Data Filters Section --- */}
            <div className="px-4 pb-4">
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-white uppercase tracking-widest">
                  <Filter size={16} className="text-blue-500" />
                  {t("dataFilters")}
                </div>

                <div className="relative" ref={filterDropdownRef}>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() =>
                      setIsFilterDropdownOpen(!isFilterDropdownOpen)
                    }
                    className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    title="Add Filter"
                  >
                    <Plus size={16} />
                  </motion.button>

                  {isFilterDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 max-h-60 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-1">
                      {numericProperties.length > 0 ? (
                        numericProperties.map((prop) => (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            key={prop}
                            onClick={() => handleAddFilter(prop)}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors truncate focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                            disabled={!!filters[prop]}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                {prop.startsWith("formula_") && (
                                  <Calculator
                                    size={10}
                                    className="text-primary-500 shrink-0"
                                  />
                                )}
                                <span className="truncate">
                                  {prop.startsWith("formula_")
                                    ? formulas.find(
                                        (f) =>
                                          f.id === prop.replace("formula_", ""),
                                      )?.name || prop
                                    : tProp(prop)}
                                </span>
                              </div>
                              {filters[prop] && (
                                <Check
                                  size={12}
                                  className="text-emerald-500 shrink-0"
                                />
                              )}
                            </div>
                          </motion.button>
                        ))
                      ) : (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          No numeric properties found in dataset
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {Object.keys(filters).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 border-dashed text-center">
                    <span className="text-xs text-slate-400">
                      {t("noFilters")}
                    </span>
                  </div>
                ) : (
                  (
                    Object.entries(filters) as [
                      string,
                      { min: string; max: string },
                    ][]
                  ).map(([key, { min, max }]) => (
                    <div
                      key={key}
                      className="bg-white dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in slide-in-from-right-2 fade-in duration-300"
                    >
                      <div className="flex justify-between items-center mb-2.5">
                        <div className="flex items-center gap-1.5 truncate">
                          {key.startsWith("formula_") && (
                            <Calculator
                              size={10}
                              className="text-primary-500"
                            />
                          )}
                          <span
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate"
                            title={
                              key.startsWith("formula_")
                                ? formulas.find(
                                    (f) => f.id === key.replace("formula_", ""),
                                  )?.name
                                : tProp(key)
                            }
                          >
                            {key.startsWith("formula_")
                              ? formulas.find(
                                  (f) => f.id === key.replace("formula_", ""),
                                )?.name || key
                              : tProp(key)}
                          </span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.2, rotate: 90 }}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => removeFilter(key)}
                          className="text-slate-400 hover:text-rose-500 transition-all p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 rounded-md"
                        >
                          <X size={12} />
                        </motion.button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Min"
                            value={min}
                            onChange={(e) =>
                              updateFilter(key, "min", e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all text-center"
                          />
                        </div>
                        <span className="text-slate-300 dark:text-slate-600 font-light">
                          —
                        </span>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Max"
                            value={max}
                            onChange={(e) =>
                              updateFilter(key, "max", e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all text-center"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mx-4 mt-2 mb-6 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2 text-slate-400 dark:text-slate-500">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {t("chartContext")}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {(chartDescriptions as Record<string, string>)[activeChart]}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-bold uppercase tracking-wider">
                  Active Dataset
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-black bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                  {filteredData.length} Items
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 bg-white dark:bg-slate-900 shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExport("json")}
              disabled={!hasValidData}
              className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
            >
              <FileJson size={14} /> {t("exportJson")}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExport("png")}
              disabled={isExporting || !hasValidData}
              className="flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              {isExporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImageIcon size={14} />
              )}{" "}
              {t("exportPng")}
            </motion.button>
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div className="flex-1 flex flex-col bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] relative min-h-[300px] shadow-2xl overflow-hidden group">
          <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
            {!showConfig && (
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowConfig(true)}
                className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 hover:text-emerald-500 shadow-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <Settings size={20} />
              </motion.button>
            )}
          </div>

          <div className="flex-1 w-full h-full p-4 relative">
            {/* Scientific Expert Overlay */}
            <div className="absolute top-6 left-6 z-30 max-w-xs md:max-w-md pointer-events-none">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={activeChart}
                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-l-4 border-emerald-500 p-4 rounded-r-2xl shadow-xl border-y border-r border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Scientific Data Insight
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white mb-1">
                  {activeInsight.title}
                </h4>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                  {activeInsight.content}
                </p>
              </motion.div>
            </div>

            {activeChart === "correlation" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">Spearman Rank Correlation Heatmap</h3>
                      <p className="text-sm text-slate-500">Discover hidden non-linear relationships across {filteredData.length} materials.</p>
                   </div>
                   <div className="flex-1 overflow-hidden">
                       <CorrelationMatrix 
                          data={filteredData} 
                          keys={Array.from(new Set(data.flatMap(p => Object.keys(p.properties || {})))).filter(k => {
                              const v = filteredData[0]?.properties?.[k]?.value;
                              return v !== undefined && !isNaN(parseFloat(String(v)));
                          })} 
                       />
                   </div>
                </div>
            ) : activeChart === "canvas_scatter" ? (() => {
               let xVals: number[] = [];
               let yVals: number[] = [];
               
               if (scatterXKey === "PC1" || scatterYKey === "PC2" || scatterXKey === "PC2" || scatterYKey === "PC1") {
                  // Run PCA
                  const pcaKeys = Array.from(new Set(data.flatMap(p => Object.keys(p.properties || {})))).filter(k => {
                      const v = filteredData[0]?.properties?.[k]?.value;
                      return v !== undefined && !isNaN(parseFloat(String(v)));
                  });
                  const mat = filteredData.map(d => pcaKeys.map(k => parseFloat(String(d.properties?.[k]?.value)) || 0));
                  const { projected } = PCA.getComponents(mat, 2);
                  if (projected.length === filteredData.length) {
                      xVals = projected.map(p => scatterXKey === "PC1" ? p[0] : scatterXKey === "PC2" ? p[1] : 0);
                      yVals = projected.map(p => scatterYKey === "PC1" ? p[0] : scatterYKey === "PC2" ? p[1] : 0);
                  }
               } else {
                  xVals = scatterXKey.startsWith('formula-') 
                     ? filteredData.map(p => formulaExecutor(p)[scatterXKey.replace('formula-', '')] || 0) 
                     : filteredData.map(p => parseFloat(String(p.properties?.[scatterXKey]?.value)) || 0);
                  yVals = scatterYKey.startsWith('formula-') 
                     ? filteredData.map(p => formulaExecutor(p)[scatterYKey.replace('formula-', '')] || 0) 
                     : filteredData.map(p => parseFloat(String(p.properties?.[scatterYKey]?.value)) || 0);
               }

               return (
                <div className="absolute inset-0 pt-32 pb-10 px-8">
                    <CanvasScatterGraph 
                        data={filteredData}
                        xKey={scatterXKey}
                        yKey={scatterYKey}
                        xLabel={scatterXKey.startsWith('formula-') ? formulas.find(f => f.id === scatterXKey.replace('formula-', ''))?.name || scatterXKey : scatterXKey}
                        yLabel={scatterYKey.startsWith('formula-') ? formulas.find(f => f.id === scatterYKey.replace('formula-', ''))?.name || scatterYKey : scatterYKey}
                        xValues={xVals}
                        yValues={yVals}
                        clusters={Object.keys(clusters).length > 0 ? clusters : undefined}
                        paretoFrontIds={enablePareto ? paretoFrontIds : undefined}
                        enableConvexHull={enableConvexHull}
                    />
                </div>
               );
            })() : activeChart === "similarity_graph" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">Material Similarity Network</h3>
                      <p className="text-sm text-slate-500">Cosine similarity representation highlighting identical performance topological regions based on selected dimensions.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {similarityFeatures.length < 2 ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-bold text-sm">
                               Please select at least 2 dimensions from the Network Config panel to calculate similarity.
                           </div>
                       ) : isCalculatingSim ? (
                           <div className="absolute inset-0 flex items-center justify-center text-amber-500 flex-col gap-2">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Calculating Z-Score Cosine Matrix ({filteredData.length}x{filteredData.length})...</span>
                           </div>
                       ) : (
                           <SimilarityGraph nodes={simNodes} edges={simEdges} theme={theme} />
                       )}
                   </div>
                </div>
            ) : activeChart === "rsm" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">响应面法 (RSM) 高通量配方优化</h3>
                      <p className="text-sm text-slate-500">Multivariant Quadratic Surface Regression predicting optimal stationary points based on empirical data.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {rsmError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-500 font-bold text-sm bg-rose-50/50 rounded-2xl">
                               无法计算: {rsmError}
                           </div>
                       ) : isCalculatingRsm ? (
                           <div className="absolute inset-0 flex items-center justify-center text-indigo-500 flex-col gap-2">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running RSM Regression Model ({filteredData.length} points)...</span>
                           </div>
                       ) : !rsmResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">
                               请在左侧面板选择变量并点击计算开始 RSM 分析。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 overflow-hidden">
                                    <RsmHeatmapChart 
                                        grid={rsmResult.grid}
                                        stationaryPoint={rsmResult.stationaryPoint}
                                        minX1={rsmResult.minX1}
                                        maxX1={rsmResult.maxX1}
                                        minX2={rsmResult.minX2}
                                        maxX2={rsmResult.maxX2}
                                        dataPoints={filteredData.map(p => ({
                                            x1: getVal(p, rsmX1Key),
                                            x2: getVal(p, rsmX2Key),
                                            y: getVal(p, rsmYKey)
                                        })).filter(p => !isNaN(p.x1) && !isNaN(p.x2) && !isNaN(p.y))}
                                        x1Label={rsmX1Key}
                                        x2Label={rsmX2Key}
                                        yLabel={rsmYKey}
                                        theme={theme}
                                    />
                               </div>
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2"><Calculator size={16}/> 最优配比 / 极值点预测</h4>
                                        {rsmResult.stationaryPoint ? (
                                            <div className="text-sm text-indigo-900 dark:text-indigo-200 space-y-2">
                                                <div className="flex justify-between border-b border-indigo-200/50 pb-1">
                                                    <span>{rsmX1Key}:</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{rsmResult.stationaryPoint.x1.toFixed(3)}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-indigo-200/50 pb-1">
                                                    <span>{rsmX2Key}:</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{rsmResult.stationaryPoint.x2.toFixed(3)}</span>
                                                </div>
                                                <div className="flex justify-between font-black text-indigo-600 dark:text-indigo-400 pt-1">
                                                    <span>Max/Min {rsmYKey}:</span> <span>{rsmResult.stationaryPoint.y.toFixed(3)}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-indigo-400">未能找到鞍点/极值，模型可能是平面的。</span>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">模型系数 (Beta)</h4>
                                        <div className="flex flex-col gap-1 text-xs font-mono">
                                            <span>b0 (截距): {rsmResult.beta[0].toFixed(4)}</span>
                                            <span>b1 ({rsmX1Key}): {rsmResult.beta[1].toFixed(4)}</span>
                                            <span>b2 ({rsmX2Key}): {rsmResult.beta[2].toFixed(4)}</span>
                                            <span>b11: {rsmResult.beta[3].toFixed(4)}</span>
                                            <span>b22: {rsmResult.beta[4].toFixed(4)}</span>
                                            <span>b12: {rsmResult.beta[5].toFixed(4)}</span>
                                        </div>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "feature_importance" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">特征敏感度归因 (Feature Importance)</h3>
                      <p className="text-sm text-slate-500">Multivariate regression analysis revealing the weight of each factor on the target property <strong>{fiTargetKey}</strong>.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {fiError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-500 font-bold text-sm bg-rose-50/50 rounded-2xl">
                               无法计算: {fiError}
                           </div>
                       ) : isCalculatingFI ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-500 flex-col gap-2">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Factor Attribution...</span>
                           </div>
                       ) : !importanceResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">
                               请在左侧面板选择目标变量并点击计算。
                           </div>
                       ) : (
                           <div className="w-full h-full p-4 bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-100 dark:border-slate-700">
                                <FeatureImportanceChart importances={importanceResult.importances} theme={theme} />
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "kde_topology" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">高斯拓扑等高密度热力谱 (2D KDE Contour)</h3>
                      <p className="text-sm text-slate-500">2D Kernel Density Estimation mapping inner congestion and competitive layout of material formulations globally.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {isCalculatingKDE ? (
                           <div className="absolute inset-0 flex items-center justify-center text-orange-500 flex-col gap-2">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running 2D Gaussian Kernel Convolution...</span>
                           </div>
                       ) : !kdeResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">
                               请在左侧面板选择X和Y映射变量并点击计算以生成等高线。
                           </div>
                       ) : (
                           <div className="w-full h-full p-2 bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-100 dark:border-slate-700">
                                <KdeTopologyChart 
                                    grid={kdeResult.grid} 
                                    theme={theme} 
                                    xLabel={kdeXKey} 
                                    yLabel={kdeYKey} 
                                    dataPoints={filteredData.map(p => ({
                                        x: getVal(p, kdeXKey), 
                                        y: getVal(p, kdeYKey)
                                    })).filter(p => !isNaN(p.x) && !isNaN(p.y))}
                                />
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "weibull" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">批次可靠性评估 (Weibull Reliability Analysis)</h3>
                      <p className="text-sm text-slate-500">2-Parameter Weibull distribution fit to predict material failure probability and characteristic life thresholds.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {weibullError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-cyan-500 font-bold text-sm bg-cyan-50/50 rounded-2xl">
                               无法计算: {weibullError}
                           </div>
                       ) : isCalculatingWeibull ? (
                           <div className="absolute inset-0 flex items-center justify-center text-cyan-500 flex-col gap-2">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Rank Sorting & Log-Log Linear Regression...</span>
                           </div>
                       ) : !weibullResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">
                               请在左侧面板选择需要评估的机械物理属性（如冲击强度、拉伸强度）并开始分析。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                    <WeibullChart 
                                        points={weibullResult.points} 
                                        m={weibullResult.m} 
                                        eta={weibullResult.eta} 
                                        rSquared={weibullResult.rSquared} 
                                        safeValue95={weibullResult.safeValue95} 
                                        targetKey={weibullKey} 
                                        theme={theme} 
                                    />
                               </div>
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-cyan-50 dark:bg-cyan-900/30 p-4 rounded-xl border border-cyan-200 dark:border-cyan-800">
                                        <h4 className="font-bold text-cyan-800 dark:text-cyan-300 mb-2 flex items-center gap-2"><ShieldAlert size={16}/> 威布尔拟合参数</h4>
                                        <div className="text-sm text-cyan-900 dark:text-cyan-200 space-y-2">
                                            <div className="flex justify-between border-b border-cyan-200/50 pb-1">
                                                <span>Weibull Modulus (m):</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{weibullResult.m.toFixed(3)}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-cyan-200/50 pb-1">
                                                <span>Scale Parameter (η):</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{weibullResult.eta.toFixed(3)}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-cyan-200/50 pb-1">
                                                <span>R² (拟合优度):</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{weibullResult.rSquared.toFixed(4)}</span>
                                            </div>
                                            <div className="flex justify-between font-black text-cyan-600 dark:text-cyan-400 pt-1">
                                                <span>95% 可靠性底线极限:</span> <span>{weibullResult.safeValue95.toFixed(3)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                                        <p className="mb-2"><strong>m值 (Modulus)</strong> 代表材料批次性能的均一性。m值越高，数据的分散度越小，代表生产一致性极极强。通常金属等匀质材料该值较高，而陶瓷、复合材料等脆性材料较低。</p>
                                        <p><strong>η (Eta)</strong> 特征寿命缩放参数，代表会有 63.2% 的材料样条在该应力阈值以下发生失效/断裂的情况。</p>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "wlf_tts" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">高分子时温等效 (WLF TTS Master Curve)</h3>
                      <p className="text-sm text-slate-500">Constructs a broad-frequency Master Curve from multi-temperature dynamic rheology using Williams-Landel-Ferry (WLF) shift factors.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {wlfError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-bold text-sm bg-blue-50/50 rounded-2xl">
                               无法计算: {wlfError}
                           </div>
                       ) : isCalculatingWLF ? (
                           <div className="absolute inset-0 flex items-center justify-center text-blue-500 flex-col gap-2">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Non-linear Optimization for Horizontal Shift Factors...</span>
                           </div>
                       ) : !wlfResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">
                               请在左侧面板选择参考温度 并在筛选只保留1个产品后 点击叠合 TTS。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
                                    <WlfTtsChart 
                                        c1={wlfResult.c1} 
                                        c2={wlfResult.c2} 
                                        refTemp={wlfResult.refTemp} 
                                        shiftFactors={wlfResult.shiftFactors} 
                                        masterCurve={wlfResult.masterCurve} 
                                        theme={theme} 
                                    />
                               </div>
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2"><ThermometerSnowflake size={16}/> WLF 函数</h4>
                                        <div className="text-xs text-blue-900 dark:text-blue-200 font-mono text-center mb-3 bg-white/40 dark:bg-slate-900/50 p-2 rounded">
                                            log(a_T) = - C1(T - T_r) / (C2 + T - T_r)
                                        </div>
                                        <div className="text-sm text-blue-900 dark:text-blue-200 space-y-2">
                                            <div className="flex justify-between border-b border-blue-200/50 pb-1">
                                                <span>C1 Constant:</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{wlfResult.c1.toFixed(3)}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-blue-200/50 pb-1">
                                                <span>C2 Constant:</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{wlfResult.c2.toFixed(3)}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-blue-200/50 pb-1">
                                                <span>Reference Temp (T_r):</span> <span className="font-mono font-bold bg-white/50 px-1 rounded">{wlfResult.refTemp.toFixed(1)} °C</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">计算得到的位移因子 a_T</h4>
                                        <div className="flex flex-col gap-1 text-xs font-mono">
                                            <div className="grid grid-cols-2 text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">
                                                <span>Temp (°C)</span>
                                                <span className="text-right">a_T Factor</span>
                                            </div>
                                            {wlfResult.shiftFactors.map(sf => (
                                                <div key={sf.temp} className="grid grid-cols-2 text-slate-700 dark:text-slate-300">
                                                    <span>{sf.temp}</span>
                                                    <span className="text-right">{sf.aT.toExponential(3)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "copula" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white">高斯关联 Copula 联合失效概率分析 (Bivariate Gaussian Copula)</h3>
                      <p className="text-sm text-slate-500">Transforming marginal distributions to uncouple dual-variable dependencies to compute <strong>joint probability of failure</strong>.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {copulaError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-fuchsia-500 font-bold text-sm bg-fuchsia-50/50 rounded-2xl">
                               无法计算: {copulaError}
                           </div>
                       ) : isCalculatingCopula ? (
                           <div className="absolute inset-0 flex items-center justify-center text-fuchsia-500 flex-col gap-2">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running MLE for Multivariate Dependence (Pearson ρ on transformed pseudo-observations)...</span>
                           </div>
                       ) : !copulaResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">
                               请在左侧选择需要分析交叉失效的双变量。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
                                    <CopulaChart 
                                        grid={copulaResult.grid} 
                                        theme={theme} 
                                    />
                               </div>
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-fuchsia-50 dark:bg-fuchsia-900/30 p-4 rounded-xl border border-fuchsia-200 dark:border-fuchsia-800">
                                        <h4 className="font-bold text-fuchsia-800 dark:text-fuchsia-300 mb-2 flex items-center gap-2"><Combine size={16}/> 联合失效判定</h4>
                                        <div className="text-sm text-fuchsia-900 dark:text-fuchsia-200 space-y-3 mb-4">
                                            <p className="text-xs">评估当 {copulaXKey} 和 {copulaYKey} <strong>同时跌破</strong> 临界值时的风险总概率。</p>
                                            
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-fuchsia-700 dark:text-fuchsia-400 block mb-1">阈值 {copulaXKey}</label>
                                                <input 
                                                    type="number"
                                                    value={copulaThreshX}
                                                    onChange={e => setCopulaThreshX(e.target.value === "" ? "" : Number(e.target.value))}
                                                    placeholder={`Min: ${copulaResult.minX.toFixed(1)}`}
                                                    className="w-full bg-white dark:bg-slate-800 border border-fuchsia-200 dark:border-fuchsia-700/50 rounded px-2 py-1 text-xs outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-fuchsia-700 dark:text-fuchsia-400 block mb-1">阈值 {copulaYKey}</label>
                                                <input 
                                                    type="number"
                                                    value={copulaThreshY}
                                                    onChange={e => setCopulaThreshY(e.target.value === "" ? "" : Number(e.target.value))}
                                                    placeholder={`Min: ${copulaResult.minY.toFixed(1)}`}
                                                    className="w-full bg-white dark:bg-slate-800 border border-fuchsia-200 dark:border-fuchsia-700/50 rounded px-2 py-1 text-xs outline-none"
                                                />
                                            </div>
                                            
                                            <button 
                                                onClick={() => {
                                                    if (copulaThreshX !== "" && copulaThreshY !== "") {
                                                        const p = getJointFailureProb(Number(copulaThreshX), Number(copulaThreshY));
                                                        setJointFailureProb(p);
                                                    }
                                                }}
                                                className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 rounded transition shadow-sm"
                                            >
                                                计算联合概率积分 ∫∫
                                            </button>
                                        </div>
                                        
                                        {jointFailureProb !== null && (
                                            <div className="pt-3 border-t border-fuchsia-200 dark:border-fuchsia-800/50">
                                                <div className="text-[10px] font-bold uppercase text-fuchsia-600 dark:text-fuchsia-400 mb-1">P(X &lt; 限值 ∩ Y &lt; 限值)</div>
                                                <div className="text-2xl font-black text-fuchsia-600 dark:text-fuchsia-400">
                                                    {(jointFailureProb * 100).toFixed(2)}%
                                                </div>
                                                <div className="text-xs mt-1 text-fuchsia-800 dark:text-fuchsia-300">
                                                    (独立事件累乘预期约为 {
                                                          (() => {
                                                              const ux = copulaResult.sortedX.findIndex(v => v >= Number(copulaThreshX)) / copulaResult.sortedX.length;
                                                              const uy = copulaResult.sortedY.findIndex(v => v >= Number(copulaThreshY)) / copulaResult.sortedY.length;
                                                              return (ux * uy * 100).toFixed(2);
                                                          })()
                                                    }%)
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">相依性参数 (Dependence)</h4>
                                        <div className="flex flex-col gap-1 text-xs font-mono">
                                            <span>Gaussian Copula ρ: </span>
                                            <span className="text-base font-bold text-slate-700 dark:text-slate-300">
                                                {copulaResult.rho.toFixed(4)}
                                            </span>
                                            <span className="text-slate-400 text-[10px] leading-tight mt-1">
                                                该相依系数剥离了边缘分布的影响，纯粹反映高分子材料这双重性能底层耦合的强度关系。
                                            </span>
                                        </div>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "arrhenius" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Flame className="text-orange-500"/> 热氧老化寿命预测 (Arrhenius Plot)</h3>
                      <p className="text-sm text-slate-500">Estimating Activation Energy from high-temperature accelerated aging, extrapolating lifespan at ambient conditions.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {arrheniusError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-orange-600 font-bold text-sm bg-orange-50/50 rounded-2xl border border-orange-200">
                               无法计算: {arrheniusError}
                           </div>
                       ) : isCalculatingArrhenius ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-orange-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Arrhenius Linear Regression...</span>
                           </div>
                       ) : !arrheniusResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                               请在左侧面板输入不同高温下的材料失效时间(或智能提取)，并点击【启动寿命衰退模型】以求解活化能和拟合直线。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 relative">
                                    <ArrheniusChart 
                                        points={arrheniusResult.points} 
                                        equation={arrheniusResult.equation} 
                                        rSquared={arrheniusResult.rSquared} 
                                        theme={theme} 
                                    />
                               </div>
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                                        <h4 className="font-bold text-orange-800 dark:text-orange-400 mb-2 flex items-center gap-2"><Settings size={16}/> 动力学常数</h4>
                                        <div className="text-sm text-orange-900 dark:text-orange-200 space-y-2 mb-4">
                                            <div className="flex justify-between border-b border-orange-200/50 dark:border-orange-800/50 pb-2">
                                                <span>表观活化能 Ea:</span> <span className="font-mono font-bold bg-white/50 dark:bg-black/20 px-1 rounded">{arrheniusResult.ea.toFixed(2)} kJ/mol</span>
                                            </div>
                                            <div className="flex justify-between border-b border-orange-200/50 dark:border-orange-800/50 pb-2">
                                                <span>R² (拟合优度):</span> <span className="font-mono font-bold bg-white/50 dark:bg-black/20 px-1 rounded">{arrheniusResult.rSquared.toFixed(4)}</span>
                                            </div>
                                            <div className="flex justify-between pb-1">
                                                <span>指前因子 (ln A):</span> <span className="font-mono font-bold">{arrheniusResult.equation.b.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">服役期推算 (Extrapolation)</h4>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">目标服役环境温度 (°C)</label>
                                            <div className="flex gap-2 mb-4">
                                                <input 
                                                    type="number"
                                                    value={predTemp}
                                                    onChange={e => setPredTemp(Number(e.target.value))}
                                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded px-2 py-1.5 text-sm outline-none font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                />
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <div className="bg-orange-100 dark:bg-orange-900/40 p-3 rounded-lg flex flex-col items-center justify-center text-center border border-orange-200 dark:border-orange-800/50">
                                                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">预期寿命预测值</span>
                                                    <div className="text-2xl font-black text-orange-700 dark:text-orange-300 mt-1">
                                                        {(() => {
                                                            const lifeHrs = getPredictedLife(predTemp);
                                                            if (!lifeHrs) return "-";
                                                            const lifeYrs = lifeHrs / 24 / 365.25;
                                                            if (lifeYrs >= 1) return `${lifeYrs.toFixed(2)} 年`;
                                                            const lifeDays = lifeHrs / 24;
                                                            return `${lifeDays.toFixed(1)} 天`;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "sobol" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Activity className="text-indigo-500"/> Sobol 方差分解敏感度分析</h3>
                      <p className="text-sm text-slate-500">Global Sensitivity Analysis evaluating main effects and interaction variance contributions using Quasi-Monte Carlo.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {sobolError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-sm bg-rose-50/50 rounded-2xl border border-rose-200">
                               分析失败: {sobolError}
                           </div>
                       ) : isCalculatingSobol ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Sobol Variance Decomposition...</span>
                           </div>
                       ) : !sobolResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center max-w-md mx-auto">
                               请在左侧面板选择目标公式、输入基准牌号，并设置自变量的方差波动率，然后点击【运行方差分解】。
                           </div>
                       ) : (
                           <div className="w-full h-full rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 relative">
                                <SobolChart 
                                    firstOrder={sobolResult.firstOrder}
                                    totalEffect={sobolResult.totalEffect}
                                    interactions={sobolResult.interactions}
                                    theme={theme}
                                />
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "spc" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Factory className="text-emerald-500"/> SPC 制程控制与工序能力分析</h3>
                      <p className="text-sm text-slate-500">Statistical Process Control. Computing capability indices (Cp, Cpk) and evaluating process potential using 3-Sigma limits against specified tolerances.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {spcError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-sm bg-rose-50/50 rounded-2xl border border-rose-200 p-4 font-mono">
                               处理失败: {spcError}
                           </div>
                       ) : isCalculatingSpc ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running capability analysis...</span>
                           </div>
                       ) : !spcResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center max-w-md mx-auto p-4">
                               请在左侧面板选择需要监控的检验特征（Target Property），设定工厂允收公差范围 (USL / LSL) 进行统计分析。请确保数据表中拥有同一牌号/材料的多批次实测数据记录。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               {/* Main Chart */}
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 relative">
                                    <SpcChart 
                                        histogram={spcResult.histogram}
                                        normalCurve={spcResult.normalCurve}
                                        histogramBins={spcResult.histogramBins}
                                        mean={spcResult.mean}
                                        sigma={spcResult.sigma}
                                        usl={Number(spcUSL)}
                                        lsl={Number(spcLSL)}
                                        theme={theme}
                                    />
                               </div>

                               {/* Right Panel: Metrics */}
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className={`p-4 rounded-xl border ${
                                       spcResult.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' :
                                       spcResult.status === 'warning' ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' :
                                       'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800'
                                    }`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className={`font-black text-sm uppercase ${
                                               spcResult.status === 'success' ? 'text-emerald-800 dark:text-emerald-400' :
                                               spcResult.status === 'warning' ? 'text-amber-800 dark:text-amber-400' :
                                               'text-rose-800 dark:text-rose-400'
                                            }`}>品控制程评级</h4>
                                            <div className="flex items-center gap-1.5">
                                               {spcResult.status === 'success' && <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
                                               {spcResult.status === 'warning' && <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                                               {spcResult.status === 'danger' && <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                                            <div className="bg-white/60 dark:bg-black/20 p-2 rounded">
                                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Cpk (实际能力)</div>
                                                <div className={`font-black text-xl font-mono ${spcResult.cpk < 1.33 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>
                                                    {spcResult.cpk.toFixed(3)}
                                                </div>
                                            </div>
                                            <div className="bg-white/60 dark:bg-black/20 p-2 rounded">
                                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Cp (过程潜力)</div>
                                                <div className="font-black text-xl font-mono text-slate-800 dark:text-white">
                                                    {spcResult.cp.toFixed(3)}
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 font-medium">
                                            {spcResult.status === 'success' && '制程能力卓越 (Cpk ≥ 1.33)，过程控制良好，无需采取特别措施。'}
                                            {spcResult.status === 'warning' && '制程能力合格 (1 ≤ Cpk < 1.33)，处于正常但勉强控制范围内，建议检查并控制波动。'}
                                            {spcResult.status === 'danger' && '制程能力不足 (Cpk < 1)！工序产出脱离规格控制，有极高的质量客诉风险！'}
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">基础分布式统计 (Base Stats)</h4>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">中心均值 (μ):</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-white">{spcResult.mean.toFixed(3)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">样本标准差 (σ):</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-white">{spcResult.sigma.toFixed(3)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">UCL (+3σ 控制线):</span>
                                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{(spcResult.mean + 3 * spcResult.sigma).toFixed(3)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">LCL (-3σ 控制线):</span>
                                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{(spcResult.mean - 3 * spcResult.sigma).toFixed(3)}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">理论不良预估 (PPM Estimation)</h4>
                                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono flex items-baseline gap-1 mt-2">
                                            {Math.round(spcResult.ppm).toLocaleString()} <span className="text-xs">PPM out</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">通过正态累积分布推算，当前波动的过程理论上每百万件产出约产生上述个超差不良品。</p>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "bayes" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><BrainCircuit className="text-pink-500"/> 基于高斯过程的贝叶斯逆向设计 (Bayesian Optimization)</h3>
                      <p className="text-sm text-slate-500">Constructing Gaussian Process to infer posterior mean and variance, and querying Expected Improvement for optimal next exploration point.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {bayesError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-sm bg-rose-50/50 rounded-2xl border border-rose-200 p-4 font-mono">
                               建模失败: {bayesError}
                           </div>
                       ) : isCalculatingBayes ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-pink-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Kriging & Expected Improvement Search...</span>
                           </div>
                       ) : !bayesResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center max-w-md mx-auto p-4">
                               请在左侧面板选择作为建模特征的独立变量 (自变量 X) 和期望优化的目标特征 (因变量 Y)，然后点击【逆向推荐下一组材料配方】。该算法将从历史数据中建立高斯过程代理模型并推荐全局最优搜索点。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               {/* Main Chart */}
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 relative">
                                    <BayesChart 
                                        historical={bayesResult.historical}
                                        suggestions={bayesResult.suggestions}
                                        targetName={bayesResult.targetName}
                                        maximize={bayesResult.maximize}
                                        theme={theme}
                                    />
                               </div>

                               {/* Right Panel: Recommendations */}
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-pink-50 dark:bg-pink-900/30 p-4 rounded-xl border border-pink-200 dark:border-pink-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BrainCircuit size={18} className="text-pink-600 dark:text-pink-400" />
                                            <h4 className="font-black text-sm uppercase text-pink-800 dark:text-pink-400">最优采集推荐点 (Top EI)</h4>
                                        </div>
                                        
                                        <div className="bg-white/60 dark:bg-black/20 p-3 rounded-lg mb-4">
                                            <div className="text-[10px] text-pink-500 uppercase font-bold mb-1">预期指标极值 {bayesResult.maximize ? '(Max)' : '(Min)'}</div>
                                            <div className="font-black text-2xl font-mono text-slate-800 dark:text-white">
                                                {bayesResult.suggestions[0].mean.toFixed(3)}
                                                <span className="text-xs text-slate-400 ml-1">± {bayesResult.suggestions[0].std.toFixed(3)}</span>
                                            </div>
                                            <div className="text-[9px] text-pink-600/80 mt-1">Expected Improvement: {bayesResult.suggestions[0].ei.toExponential(2)}</div>
                                        </div>

                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-pink-500 mb-2">配方/参数逆向指引:</h4>
                                        <div className="space-y-1">
                                            {Object.entries(bayesResult.suggestions[0].params).map(([k, v]) => (
                                                <div key={k} className="flex justify-between items-center bg-white/40 dark:bg-black/10 px-2 py-1.5 rounded">
                                                    <span className="text-[10px] text-pink-900 dark:text-pink-200 truncate pr-2" title={k}>{k}</span>
                                                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-white shrink-0">{Number(v).toFixed(3)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "moo" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><GitMerge className="text-orange-500"/> 多目标帕累托前沿探索 (Multi-Objective Pareto)</h3>
                      <p className="text-sm text-slate-500">Constructs parallel independent GP surrogates for selected properties and resolves non-dominated Pareto Front using scalarized candidate ranking.</p>
                   </div>
                   <div className="flex-1 min-h-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-slate-200 dark:border-slate-800 p-4 pb-8 relative shadow-lg shadow-slate-200/50 dark:shadow-none">
                       {mooError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-sm bg-rose-50/50 rounded-2xl border border-rose-200 p-4 font-mono">
                               执行失败: {mooError}
                           </div>
                       ) : isCalculatingMoo ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-orange-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Surrogate Models & Generating Non-dominated Front...</span>
                           </div>
                       ) : !mooResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center max-w-md mx-auto p-4">
                               准备就绪。请在左侧面板选择自变量与至少2个约束目标，将自动求解妥协议。
                           </div>
                       ) : (
                           <MooChart
                               evaluatedCandidates={mooResult.evaluatedCandidates}
                               paretoFront={mooResult.paretoFront}
                               historical={mooResult.historical}
                               targets={mooResult.targets}
                               theme={theme}
                           />
                       )}
                   </div>
                </div>
            ) : activeChart === "mahalanobis" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Target className="text-rose-600"/> 多元马氏距离异常检测 (Mahalanobis Anomaly)</h3>
                      <p className="text-sm text-slate-500">Based on multivariate normal distribution assumption. Uses inverted covariance matrix to find Mahalanobis distance ($D^2$) and evaluate against Chi-Square thresholds.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {mahalanobisError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-sm bg-rose-50/50 rounded-2xl border border-rose-200 p-4 font-mono">
                               执行失败: {mahalanobisError}
                           </div>
                       ) : isCalculatingMahalanobis ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Mahalanobis Distances...</span>
                           </div>
                       ) : !mahalanobisResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center max-w-md mx-auto p-4">
                               请在左侧面板选择 3-5 个数值特征并在底端点击【生成特征联合异常排查图谱】。系统将求解协方差逆矩阵，寻找在单一维度看起来正常，但在多维联合分布中显著背离群体特性的异常批次。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 relative">
                                    <MahalanobisChart 
                                        distances={mahalanobisResult.distances}
                                        threshold={mahalanobisResult.threshold}
                                        theme={theme}
                                    />
                               </div>
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-rose-50 dark:bg-rose-900/30 p-4 rounded-xl border border-rose-200 dark:border-rose-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400" />
                                            <h4 className="font-black text-sm uppercase text-rose-800 dark:text-rose-400">发现离群点 (Outliers)</h4>
                                        </div>
                                        {(() => {
                                            const outliers = mahalanobisResult.distances.filter(d => d.isOutlier).sort((a,b) => b.distance - a.distance);
                                            if (outliers.length === 0) {
                                                return <div className="text-sm text-emerald-600 font-bold">目前所有样本均处于当前特征联合置信区间内。</div>;
                                            }
                                            return (
                                                <div className="space-y-2">
                                                    <div className="text-xs text-rose-600 mb-2">找到 {outliers.length} 个异常批次：</div>
                                                    {outliers.map(o => (
                                                        <div key={o.id} className="bg-white/60 dark:bg-black/20 p-2 rounded">
                                                            <div className="font-bold text-xs truncate" title={o.name}>{o.name}</div>
                                                            <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                                                                <span>T² = {o.distance.toFixed(2)}</span>
                                                                <span className="text-rose-500 font-mono">超出限界</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl">
                                        <h4 className="font-black text-[10px] uppercase text-slate-500 mb-2">多元变量族群形心 (Centroid)</h4>
                                        <div className="space-y-1">
                                            {Object.entries(mahalanobisResult.mean).map(([k, v]) => (
                                                <div key={k} className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-600 dark:text-slate-400 truncate pr-2 max-w-[120px]">{k}</span>
                                                    <span className="font-mono font-bold">{v.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "kinetics" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Zap className="text-teal-500"/> 非等温固化动力学 (Kissinger/Friedman Model)</h3>
                      <p className="text-sm text-slate-500">Deriving curing activation energy and pre-exponential factor via OLS Linear Regression from DSC thermal profiles.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {kineticsError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-sm bg-rose-50/50 rounded-2xl border border-rose-200 p-4 font-mono">
                               执行失败: {kineticsError}
                           </div>
                       ) : isCalculatingKinetics ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-teal-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Fitting Kissinger Plot...</span>
                           </div>
                       ) : !kineticsResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center max-w-md mx-auto p-4">
                               请在左侧面板输入不同升温速率条件下的 DSC 峰温数据，并设定期望预测的成型恒温条件。系统将通过偏最小二乘拟合求解活化能并推荐工艺时间。
                           </div>
                       ) : (
                           <div className="w-full h-full flex gap-4">
                               <div className="flex-1 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 relative">
                                    <KineticsChart 
                                        points={kineticsResult.points}
                                        line={kineticsResult.line}
                                        isoCurve={kineticsResult.isoCurve}
                                        isoTemp={kineticsIsoTemp}
                                        theme={theme}
                                    />
                               </div>
                               <div className="w-80 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-4">
                                    <div className="bg-teal-50 dark:bg-teal-900/30 p-4 rounded-xl border border-teal-200 dark:border-teal-800">
                                        <div className="flex items-center gap-2 mb-3 border-b border-teal-200 dark:border-teal-800 pb-2">
                                            <Activity size={18} className="text-teal-600 dark:text-teal-400" />
                                            <h4 className="font-black text-sm uppercase text-teal-800 dark:text-teal-400">动力学参数求解</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">表观活化能 (Ea)</div>
                                                <div className="text-2xl font-black font-mono text-slate-800 dark:text-white flex items-baseline gap-1">
                                                    {kineticsResult.E.toFixed(2)} <span className="text-xs text-slate-500">kJ/mol</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">指前因子 (A)</div>
                                                <div className="text-2xl font-black font-mono text-slate-800 dark:text-white flex items-baseline gap-1">
                                                    {kineticsResult.A.toExponential(2)} <span className="text-xs text-slate-500">min⁻¹</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">线性拟合相关系数 (R²)</div>
                                                <div className="text-xl font-black font-mono text-slate-800 dark:text-white flex items-baseline gap-1">
                                                    {kineticsResult.r2.toFixed(4)}
                                                </div>
                                                <div className="text-[9px] text-teal-600 dark:text-teal-400 font-bold mt-1">Kissinger Eq: {kineticsResult.equation}</div>
                                            </div>
                                        </div>
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "prony" ? (
                <div className="absolute inset-0 pt-32 pb-10 px-8 flex flex-col">
                   <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2"><Activity className="text-purple-500"/> 广义麦克斯韦/Prony级数提取 (Prony Series)</h3>
                      <p className="text-sm text-slate-500">Extracts viscoelastic material constants E_inf, E_i, tau_i from master curves using Non-Negative Projected Gradient Descent.</p>
                   </div>
                   <div className="flex-1 overflow-hidden relative">
                       {pronyError ? (
                           <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-sm bg-rose-50/50 rounded-2xl border border-rose-200 p-4 font-mono">
                               执行失败: {pronyError}
                           </div>
                       ) : isCalculatingProny ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-600 gap-2 bg-white/50 dark:bg-slate-900/50 rounded-2xl backdrop-blur-sm z-10">
                               <Loader2 className="animate-spin" size={32} />
                               <span className="text-sm font-bold animate-pulse">Running Non-negative Least Squares Constraint Optimization...</span>
                           </div>
                       ) : !pronyResult ? (
                           <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-center max-w-md mx-auto p-4">
                               请在左侧面板输入包含角频率、储能模量、损耗模量的主曲线散点数据，设定目标解析精度(阶数)，系统将输出拟合后的本构参数及 Abaqus 格式卡片。
                           </div>
                       ) : (
                           <div className="w-full h-full flex flex-col gap-4">
                               <div className="h-2/3 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 relative">
                                    <PronyChart 
                                        points={pronyResult.points}
                                        theme={theme}
                                    />
                               </div>
                               <div className="flex-1 flex gap-4 overflow-hidden">
                                    <div className="w-1/3 bg-purple-50 dark:bg-purple-900/30 p-4 rounded-xl border border-purple-200 dark:border-purple-800 flex flex-col">
                                        <div className="flex items-center gap-2 mb-3 border-b border-purple-200 dark:border-purple-800 pb-2">
                                            <Activity size={18} className="text-purple-600 dark:text-purple-400" />
                                            <h4 className="font-black text-sm uppercase text-purple-800 dark:text-purple-400">本构参数解算池</h4>
                                        </div>
                                        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                                            <div className="flex justify-between items-center bg-white/50 dark:bg-black/20 px-2 py-1.5 rounded">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">长时模量 (E_∞)</span>
                                                <span className="font-mono text-sm font-black text-slate-800 dark:text-white">{pronyResult.E_inf.toExponential(3)}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-white/50 dark:bg-black/20 px-2 py-1.5 rounded">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">RMSE 拟合误差</span>
                                                <span className="font-mono text-sm font-black text-rose-500">{pronyResult.error_metric.toExponential(3)}</span>
                                            </div>
                                            <div className="mt-4">
                                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">松弛谱系数 (Relaxation Spectrum)</div>
                                                <div className="space-y-1">
                                                    {pronyResult.terms.map((t, i) => (
                                                        <div key={i} className="flex justify-between text-xs font-mono bg-white/40 dark:bg-black/10 px-2 py-1 rounded">
                                                            <span className="text-purple-600 dark:text-purple-400 text-left w-1/3">τ: {t.tau.toExponential(2)}</span>
                                                            <span className="text-slate-700 dark:text-slate-300 text-right">E: {t.E.toExponential(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-slate-900 rounded-xl p-4 flex flex-col border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-black text-xs uppercase text-slate-400 tracking-wider">Abaqus / Ansys Material Card</h4>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(pronyResult.abaqusCard);
                                                    alert("已复制到剪贴板");
                                                }}
                                                className="text-white hover:text-teal-400 text-xs px-3 py-1 bg-slate-800 rounded shadow border border-slate-600"
                                            >
                                                复制卡片 / Copy Data
                                            </button>
                                        </div>
                                        <textarea 
                                            readOnly 
                                            className="w-full flex-1 bg-black/50 text-green-400 font-mono text-xs p-3 rounded custom-scrollbar focus:outline-none resize-none"
                                            value={pronyResult.abaqusCard}
                                        />
                                    </div>
                               </div>
                           </div>
                       )}
                   </div>
                </div>
            ) : activeChart === "rheology" ? (
                <RheologyGraph 
                   products={(currentChartData as { products: Product[], temps: number[] }).products} 
                   temps={(currentChartData as { products: Product[], temps: number[] }).temps} 
                />
            ) : (
              <ScientificChart
                type={activeChart as SCChartType}
                data={currentChartData}
                onChartReady={setChartInstance}
                loading={false}
              />
            )}

            {/* Watermark */}
            <div className="absolute bottom-6 right-6 pointer-events-none opacity-10 flex flex-col items-end z-0">
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                ResinDB
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Arch. by Sun Haojun (PRI)
              </span>
            </div>

            {/* Empty State Overlay */}
            {!hasValidData && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl text-center border border-slate-100 dark:border-slate-700 max-w-sm">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="text-amber-500" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    Insufficient Data
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Please select products containing valid numeric properties
                    for {tProp(activeChart)} analysis.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
