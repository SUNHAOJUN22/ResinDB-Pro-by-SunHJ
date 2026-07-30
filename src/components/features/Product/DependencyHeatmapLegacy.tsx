import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Beaker, 
  Info,
  ChevronsUpDown,
  Sliders
} from 'lucide-react';
import { Product, FormulaConfig } from '@/types/index';
import { formulaEngine } from '@/lib/formulaParser';
import { useLanguage } from '@/contexts/LanguageContext';

interface DependencyHeatmapProps {
  expression: string;
  name: string;
  formulas: FormulaConfig[];
  allProducts: Product[];
}

interface FeatureInfo {
  key: string;
  labelZh: string;
  labelEn: string;
  unit: string;
  descriptionZh: string;
  descriptionEn: string;
}

interface PropertyInfo {
  key: string;
  labelZh: string;
  labelEn: string;
  unit: string;
  descriptionZh: string;
  descriptionEn: string;
}

// Evaluate single property based on perturbed variables as a pure static helper
const evaluatePhysicalModel = (
  colKey: string,
  tempProduct: Product,
  exprStr: string,
  formulas: FormulaConfig[]
): number => {
  const getValue = (k: string): number => {
    const getValFromKeys = (keys: string[]): number | null => {
      for (const key of keys) {
        const raw = tempProduct.properties?.[key]?.value;
        if (raw !== undefined && raw !== null) {
          const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
          if (!isNaN(num)) return num;
        }
      }
      return null;
    };

    let val: number | null;
    if (k === 'density') {
      val = getValFromKeys(['密度', 'density', 'Density']);
    } else if (k === 'mfr') {
      val = getValFromKeys(['熔体质量流动速率', 'mfr', 'MFR']);
    } else if (k === 'tensileYield') {
      val = getValFromKeys(['拉伸屈服应力', '拉伸断裂应力', 'tensileYield', 'tensile', 'Tensile Strength']);
    } else if (k === 'flexuralModulus') {
      val = getValFromKeys(['弯曲模量', 'flexuralModulus', '弯曲弹性模量', 'Flexural Modulus']);
    } else if (k === 'izodImpact') {
      val = getValFromKeys(['简支梁缺口冲击强度', '悬臂梁缺口冲击强度', 'izodImpact', '冲击强度', 'Izod Impact']);
    } else {
      val = getValFromKeys([k]);
    }
    
    return val !== null ? val : 0;
  };

  const dens = Math.max(0, getValue('density') || 0.95);
  const mfrVal = getValue('mfr') || 2.0;
  const tensileVal = getValue('tensileYield') || 25.0;
  const flexVal = getValue('flexuralModulus') || 1200.0;
  const izodVal = getValue('izodImpact') || 8.0;

  switch (colKey) {
    case 'formula': {
      if (!exprStr.trim()) return 0;
      try {
        const tempConfig: FormulaConfig = { id: 'temp_hm_id', name: 'HeatmapTemp', expression: exprStr, unit: '' };
        const tempFormulas = [...formulas.filter(f => f.id !== tempConfig.id), tempConfig];
        const evaluator = formulaEngine.compileGraph(tempFormulas);
        const evalResult = evaluator(tempProduct);
        const score = evalResult['temp_hm_id'];
        return isNaN(score) || !isFinite(score) ? 0 : score;
      } catch {
        return 0;
      }
    }
    case 'viscosity':
      // Viscosity is inversely proportional to Melt Flow Rate
      return mfrVal > 0 ? 3500 / mfrVal : 0;
    case 'tensile':
      // Coupled tensile strength index
      return tensileVal * Math.pow(dens / 0.95, 1.8);
    case 'stiffness':
      // Stiffness depends on Flexural Modulus and Density
      return flexVal * Math.pow(dens / 0.95, 2.5);
    case 'toughness': {
      // Toughness is directly related to impact, but decreases modestly as modulus increases
      const modulusFactor = flexVal > 0 ? Math.sqrt(1200 / flexVal) : 1;
      return izodVal * modulusFactor;
    }
    default:
      return 0;
  }
};

export const DependencyHeatmap: React.FC<DependencyHeatmapProps> = ({
  expression,
  formulas,
  allProducts
}) => {
  const { language } = useLanguage();
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [perturbationPct, setPerturbationPct] = useState(15); // Default +/- 15% perturbation
  const [selectedCell, setSelectedCell] = useState<{ rowKey: string; colKey: string } | null>(null);

  const referenceProduct = useMemo(() => {
    return allProducts[selectedProductIndex] || allProducts[0] || null;
  }, [allProducts, selectedProductIndex]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return allProducts.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return allProducts.filter(p => 
      p.gradeName.toLowerCase().includes(q) || 
      p.manufacturer.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [allProducts, searchQuery]);

  // Translate utility
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);

  // Rows of heatmap: Chemical Variables (Inputs)
  const rows: FeatureInfo[] = useMemo(() => {
    const list: FeatureInfo[] = [
      {
        key: 'density',
        labelZh: '材料密度',
        labelEn: 'Material Density',
        unit: 'g/cm³',
        descriptionZh: '树脂配方的整体物理密度，影响拉伸性能与体积比重。',
        descriptionEn: 'Overall physical density of the formula, impacting tensile properties and volume fraction.'
      },
      {
        key: 'mfr',
        labelZh: '熔体流动速率 MFR',
        labelEn: 'Melt Flow Rate MFR',
        unit: 'g/10min',
        descriptionZh: '溶体状态流动阻力，较高的 MFR 意味着较低的粘度和较易的流动性。',
        descriptionEn: 'Melt flow viscosity indicator. Higher MFR represents lower viscosity and better processability.'
      },
      {
        key: 'tensileYield',
        labelZh: '拉伸屈服强度',
        labelEn: 'Tensile Yield Strength',
        unit: 'MPa',
        descriptionZh: '断裂前发生永久形变所允许的最大拉伸载荷能力。',
        descriptionEn: 'Maximum tensile loading limits allowable before plastic deformation.'
      },
      {
        key: 'flexuralModulus',
        labelZh: '弯曲弯折弹性模量',
        labelEn: 'Flexural Modulus',
        unit: 'MPa',
        descriptionZh: '树脂刚度与弯曲抗变形模量系数。',
        descriptionEn: 'Representative of polymer rigid cross-bending stiffness.'
      },
      {
        key: 'izodImpact',
        labelZh: '悬臂梁冲击性 (韧性)',
        labelEn: 'Izod Impact Strength',
        unit: 'kJ/m²',
        descriptionZh: '高速摆锤打击下的能量吸收指标，体现材料韧度抵抗碎裂能力。',
        descriptionEn: 'Impact loading metrics. Represents material toughness against stress fracture.'
      }
    ];

    // Extract dynamic variables inside the current formula expression
    const matches: string[] = expression.match(/props\['([^']+)'\]/g) || [];
    const varsInFormula = new Set<string>();
    matches.forEach(m => varsInFormula.add(m.replace(/^props\['/, '').replace(/'\]$/, '')));

    varsInFormula.forEach(v => {
      // If not already in standard list, add it dynamically
      if (!list.some(item => item.key === v)) {
        list.push({
          key: v,
          labelZh: `${v} (公式变量)`,
          labelEn: `${v} (Formula Var)`,
          unit: referenceProduct?.properties?.[v]?.unit || '',
          descriptionZh: `当前公式中引用的自定义输入配方量度 "${v}"。`,
          descriptionEn: `Custom chemical input descriptor "${v}" declared inside reactive expression.`
        });
      }
    });

    return list;
  }, [expression, referenceProduct]);

  // Columns of heatmap: Material Performance Properties (Outputs)
  const cols: PropertyInfo[] = useMemo(() => [
    {
      key: 'formula',
      labelZh: '本项配方计算值',
      labelEn: 'Current Formula Unit',
      unit: referenceProduct ? (language === 'zh' ? '自定义' : 'Formula Unit') : '',
      descriptionZh: '当前在上方编辑器里配置或选择的自定义指标函数实时评估值。',
      descriptionEn: 'Real-time computed value derived from the custom user formula.'
    },
    {
      key: 'viscosity',
      labelZh: '动态熔融粘度',
      labelEn: 'Dynamic Melt Viscosity',
      unit: 'Pa·s',
      descriptionZh: '根据 Melt Flow Rate 的物理互反关系估算而来的熔融流变剪切粘度。',
      descriptionEn: 'Melt shear viscosity estimated through standard semi-empirical reciprocal relation of formulation flow MFR.'
    },
    {
      key: 'tensile',
      labelZh: '拉伸载荷特性',
      labelEn: 'Tensile Strength Index',
      unit: 'MPa',
      descriptionZh: '拉伸屈服破坏应力强度与密度基底质量耦合预测性能指数。',
      descriptionEn: 'Coupled polymer tensile resistance index predicted based on density-weight factor.'
    },
    {
      key: 'stiffness',
      labelZh: '刚挺度应力响应',
      labelEn: 'Flexural Elastic Index',
      unit: 'MPa',
      descriptionZh: '结合高维基底密度多孔网格拟合所作的抗弯曲变形模量阻尼。',
      descriptionEn: 'Composite structural bending module calibrated via density factor.'
    },
    {
      key: 'toughness',
      labelZh: '韧性冲击阻力',
      labelEn: 'Mechanical Toughness',
      unit: 'kJ/m²',
      descriptionZh: '交联剪切刚度与梁臂缺口冲击吸收极限的非线性反比能量耗散关系。',
      descriptionEn: 'Dynamic impact energy storage and dissipation rating.'
    }
  ], [referenceProduct, language]);

  // Build full grid sensitivities
  const heatmapData = useMemo(() => {
    if (!referenceProduct) return [];

    const matrix: { rowKey: string; colKey: string; score: number }[] = [];

    rows.forEach(r => {
      // Get base value for current row variable X
      const rawVal = referenceProduct.properties?.[r.key]?.value;
      const baseVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));

      if (isNaN(baseVal) || baseVal === 0) {
        // Fallback or skip if variable is absent in reference product
        cols.forEach(c => {
          matrix.push({ rowKey: r.key, colKey: c.key, score: 0 });
        });
        return;
      }

      cols.forEach(c => {
        // 1. Base value of column Y
        const yBase = evaluatePhysicalModel(c.key, referenceProduct, expression, formulas);

        if (yBase === 0 || isNaN(yBase)) {
          matrix.push({ rowKey: r.key, colKey: c.key, score: 0 });
          return;
        }

        // 2. Perturb X positively (+ perturbationPct %)
        const pPlusVal = baseVal * (1 + perturbationPct / 100);
        const productPlus: Product = {
          ...referenceProduct,
          properties: {
            ...referenceProduct.properties,
            [r.key]: {
              ...referenceProduct.properties[r.key],
              value: pPlusVal
            }
          }
        };
        const yPlus = evaluatePhysicalModel(c.key, productPlus, expression, formulas);

        // 3. Perturb X negatively (- perturbationPct %)
        const pMinusVal = baseVal * (1 - perturbationPct / 100);
        const productMinus: Product = {
          ...referenceProduct,
          properties: {
            ...referenceProduct.properties,
            [r.key]: {
              ...referenceProduct.properties[r.key],
              value: pMinusVal
            }
          }
        };
        const yMinus = evaluatePhysicalModel(c.key, productMinus, expression, formulas);

        // 4. Calculate dimensionless sensitivity index (partial derivative proxy)
        // dY/dX * (X/Y)
        const dX = pPlusVal - pMinusVal;
        const dY = yPlus - yMinus;
        let sensitivity = 0;

        if (dX !== 0 && yBase !== 0) {
          sensitivity = (dY / yBase) / (dX / baseVal);
        }

        matrix.push({
          rowKey: r.key,
          colKey: c.key,
          score: isNaN(sensitivity) || !isFinite(sensitivity) ? 0 : Math.round(sensitivity * 100) / 100
        });
      });
    });

    return matrix;
  }, [referenceProduct, rows, cols, expression, formulas, perturbationPct]);

  // Compute sensitivity curve for the selected cell
  const detailCurveData = useMemo(() => {
    if (!selectedCell || !referenceProduct) return [];

    const rowVar = rows.find(r => r.key === selectedCell.rowKey);
    const colProp = cols.find(c => c.key === selectedCell.colKey);

    if (!rowVar || !colProp) return [];

    const rawVal = referenceProduct.properties?.[rowVar.key]?.value;
    const baseVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));

    if (isNaN(baseVal) || baseVal === 0) return [];

    const dataPoints: { percent: string; value: number; percentNum: number }[] = [];

    // Evaluate at steps from -40% to +40%
    const steps = [-40, -30, -20, -10, 0, 10, 20, 30, 40];

    steps.forEach(step => {
      const perturbedVal = baseVal * (1 + step / 100);
      const tempProd: Product = {
        ...referenceProduct,
        properties: {
          ...referenceProduct.properties,
          [rowVar.key]: {
            ...referenceProduct.properties[rowVar.key],
            value: perturbedVal
          }
        }
      };

      const yVal = evaluatePhysicalModel(colProp.key, tempProd, expression, formulas);
      dataPoints.push({
        percent: `${step > 0 ? '+' : ''}${step}%`,
        percentNum: step,
        value: Math.round(yVal * 1000) / 1000
      });
    });

    return dataPoints;
  }, [selectedCell, referenceProduct, rows, cols, expression, formulas]);

  const selectedCellScore = useMemo(() => {
    if (!selectedCell) return null;
    return heatmapData.find(d => d.rowKey === selectedCell.rowKey && d.colKey === selectedCell.colKey) || null;
  }, [selectedCell, heatmapData]);

  // Get color scale based on sensitivity coefficient
  const getCellBgColor = (score: number) => {
    if (score === 0) return 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400';
    
    // Positive sensitivity (red-orange gradient)
    if (score > 0) {
      if (score >= 2.0) return 'bg-rose-600/90 dark:bg-rose-800/90 text-white font-black hover:ring-2 hover:ring-rose-400';
      if (score >= 1.0) return 'bg-rose-500/70 dark:bg-rose-700/70 text-white font-black hover:ring-2 hover:ring-rose-450';
      if (score >= 0.5) return 'bg-orange-400/50 dark:bg-orange-600/50 text-slate-800 dark:text-slate-100 hover:ring-2 hover:ring-orange-300';
      return 'bg-orange-200/40 dark:bg-orange-850/30 text-orange-700 dark:text-orange-450 hover:ring-2 hover:ring-orange-200';
    }
    
    // Negative sensitivity (indigo gradient)
    const absScore = Math.abs(score);
    if (absScore >= 2.0) return 'bg-indigo-600/90 dark:bg-indigo-800/90 text-white font-black hover:ring-2 hover:ring-indigo-400';
    if (absScore >= 1.0) return 'bg-indigo-500/70 dark:bg-indigo-700/70 text-white font-black hover:ring-2 hover:ring-indigo-450';
    if (absScore >= 0.5) return 'bg-sky-400/50 dark:bg-sky-600/50 text-slate-850 dark:text-sky-100 hover:ring-2 hover:ring-sky-300';
    return 'bg-sky-200/40 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 hover:ring-2 hover:ring-sky-200';
  };

  return (
    <div className="flex-1 flex flex-col space-y-4 overflow-y-auto custom-scrollbar p-1">
      {/* Simulation Controls Banner */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="space-y-1">
          <h4 className="text-xs font-black text-primary-600 dark:text-primary-450 flex items-center gap-1.5 uppercase tracking-tight">
            <Sliders size={13} className="text-secondary-500" />
            {t('高维偏微系数敏感性分析仪', 'Sensitivity Dependency Engine')}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t('通过给原料添加微弱扰动评判该因子对最终材料表现的导数贡献百分比（dY/dX）。', 'Evaluates structural slope and contribution percentage (dY/dX) of chemical constituents via perturbation.')}
          </p>
        </div>

        {/* Reference product selection & perturbation factor settings */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Reference Product Dropdown */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowProductDropdown(!showProductDropdown)}
              className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 h-9 outline-none focus:ring-2 focus:ring-primary-500/20 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <Beaker size={12} className="text-indigo-500" />
              <span className="max-w-[120px] truncate">
                {referenceProduct ? `${referenceProduct.gradeName}` : t('未选产品', 'No reference')}
              </span>
              <ChevronsUpDown size={12} className="text-slate-400" />
            </motion.button>

            <AnimatePresence>
              {showProductDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProductDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 mt-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 w-72 overflow-hidden flex flex-col"
                  >
                    <div className="p-2 border-b border-slate-100 dark:border-slate-850">
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('搜索树脂品级...', 'Search resin...')}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold outline-none"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredProducts.map((p) => {
                        const idx = allProducts.findIndex(ap => ap.id === p.id);
                        return (
                          <motion.button
                            whileHover={{ x: 3, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                            whileTap={{ scale: 0.99 }}
                            key={p.id}
                            onClick={() => {
                              setSelectedProductIndex(idx);
                              setShowProductDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 text-[11px] font-bold border-b border-slate-50 dark:border-slate-900/10 transition-colors cursor-pointer ${
                              idx === selectedProductIndex ? 'bg-primary-50/30 text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="truncate max-w-[140px]">{p.gradeName}</span>
                              <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-850 px-1 rounded">
                                {p.manufacturer}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Perturbation Pct Slider */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 border border-slate-200 dark:border-slate-800 rounded-xl h-9 shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase">{t('扰动率', 'PERTURB')}</span>
            <input 
              type="range"
              min="5"
              max="30"
              step="5"
              value={perturbationPct}
              onChange={(e) => setPerturbationPct(parseInt(e.target.value))}
              className="w-20 cursor-pointer accent-primary-500 h-1 bg-slate-100 dark:bg-slate-800 rounded" 
            />
            <span className="text-xs font-black font-mono text-slate-700 dark:text-slate-300">
              ±{perturbationPct}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 flex-1 min-h-[360px]">
        {/* Heatmap Grid Map (Left 7 Columns) */}
        <div className="xl:col-span-7 flex flex-col border border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-950/20 rounded-3xl p-4 md:p-5 shadow-sm overflow-x-auto">
          <div className="min-w-[580px] flex flex-col space-y-4 h-full">
            {/* Legend / Information */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                {t('因子偏微响应矩阵', 'Dimonsionless Elasticity Heatmap')}
              </span>
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-rose-500/80 rounded-md inline-block" /> {t('正向增效', 'Pos Impact')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-slate-100 dark:bg-slate-850 border border-slate-200 rounded-md inline-block" /> {t('零无相关', 'No Impact')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-indigo-500/80 rounded-md inline-block" /> {t('阻尼负相关', 'Neg Impact')}
                </span>
              </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 grid grid-cols-12 gap-2 select-none">
              {/* Corner Empty cell */}
              <div className="col-span-3 flex items-center justify-end pr-2 text-right">
                <span className="text-[9px] font-black text-slate-350 uppercase dark:text-slate-600 block">
                  {t('自变量 ▽ / 因变量 ▷', 'Factors Y ▷ / Inputs X ▽')}
                </span>
              </div>

              {/* Columns Header */}
              <div className="col-span-9 grid grid-cols-5 gap-1.5">
                {cols.map(c => (
                  <div 
                    key={c.key} 
                    title={t(c.descriptionZh, c.descriptionEn)}
                    className={`p-2 bg-slate-50 dark:bg-slate-900 border border-slate-150/45 dark:border-slate-850 rounded-xl text-center flex flex-col justify-center items-center min-h-[60px] cursor-help transition-all hover:bg-slate-100 dark:hover:bg-slate-850 ${
                      c.key === 'formula' ? 'ring-1 ring-primary-500/30' : ''
                    }`}
                  >
                    <span className="text-[10px] font-extrabold text-slate-800 dark:text-white leading-none text-center px-0.5 max-h-8 line-clamp-2 truncate whitespace-pre-wrap">
                      {t(c.labelZh, c.labelEn)}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 mt-1 block">
                      {c.unit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Matrix Rows */}
              <div className="col-span-12 space-y-1.5">
                {rows.map(r => {
                  const xVal = referenceProduct?.properties?.[r.key]?.value ?? '-';
                  return (
                    <div key={r.key} className="grid grid-cols-12 gap-2 items-center">
                      {/* Row Label (Left Columns) */}
                      <div 
                        className="col-span-3 text-right pr-2 group cursor-help truncate flex flex-col justify-end"
                        title={t(r.descriptionZh, r.descriptionEn)}
                      >
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate tracking-tight">
                          {t(r.labelZh, r.labelEn)}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-400/90 tracking-tight block">
                          Base: {xVal} {r.unit}
                        </span>
                      </div>

                      {/* Row Cells */}
                      <div className="col-span-9 grid grid-cols-5 gap-1.5">
                        {cols.map(c => {
                          const cell = heatmapData.find(d => d.rowKey === r.key && d.colKey === c.key);
                          const score = cell ? cell.score : 0;
                          const formatted = score === 0 ? '0.00' : `${score > 0 ? '+' : ''}${score.toFixed(2)}`;
                          const isSelected = selectedCell?.rowKey === r.key && selectedCell?.colKey === c.key;

                          return (
                            <div
                              key={c.key}
                              onClick={() => setSelectedCell({ rowKey: r.key, colKey: c.key })}
                              className={`p-3 rounded-2xl border text-center h-[54px] flex flex-col justify-center items-center cursor-pointer transition-all duration-150 ${getCellBgColor(score)} ${
                                isSelected ? 'ring-4 ring-primary-500 ring-offset-2 dark:ring-offset-slate-950 scale-[1.03] z-10' : ''
                              }`}
                            >
                              <span className="text-xs font-black font-mono tracking-tight">{formatted}</span>
                              <span className="text-[8px] opacity-75 font-bold uppercase tracking-wider block mt-0.5">
                                {score > 0 ? t('正相关', 'POS') : score < 0 ? t('负负相关的', 'NEG') : t('无相关', 'NULL')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-850 text-[11px] text-slate-450 dark:text-slate-400 flex items-center gap-2">
              <Info size={14} className="text-primary-500 shrink-0" />
              <span>
                {t(
                  '单元格数值是无纲偏微分敏感度：+1.50 表示因变量跟随原料增加 1.5 倍幅度共振上涨；负号代表阻尼抑制效应。点击对应单元格即可绘制完整耦合趋势分析曲线！',
                  'Cells plot dimensionless sensitivities: +1.50 means Y grows 1.5x as fast as X. Negative scores signify resistive damping. Click any cell to plot a non-linear relationship curve.'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Detail Panel with Sparkline (Right 5 Columns) */}
        <div className="xl:col-span-5 flex flex-col border border-slate-150 dark:border-slate-850 bg-slate-50/30 dark:bg-slate-900/10 rounded-3xl p-5 shadow-sm min-h-[300px]">
          <AnimatePresence mode="wait">
            {selectedCell ? (
              <motion.div
                key={`${selectedCell.rowKey}-${selectedCell.colKey}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="h-full flex flex-col justify-between space-y-4"
              >
                {/* Cell Header Details */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-950/40 border border-primary-200 text-primary-700 dark:text-primary-400 rounded-md text-[9px] font-black uppercase tracking-wide">
                      {t('材料机理分析', 'SPECTRUM ANALYSIS')}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05, color: '#4f46e5' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedCell(null)}
                      className="text-[10px] text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 uppercase font-black tracking-tight cursor-pointer"
                    >
                      Reset
                    </motion.button>
                  </div>

                  {/* Relationship definition banner */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('输入化学扰动变量', 'PERTURBATION ELEMENT')}</span>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white mt-0.5 leading-tight">
                        {t(rows.find(r => r.key === selectedCell.rowKey)?.labelZh || '', rows.find(r => r.key === selectedCell.rowKey)?.labelEn || '')}
                      </h4>
                      <p className="text-[9px] text-slate-400 mt-1 leading-snug truncate">
                        {t(rows.find(r => r.key === selectedCell.rowKey)?.descriptionZh || '', rows.find(r => r.key === selectedCell.rowKey)?.descriptionEn || '')}
                      </p>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('预测物理响应物性', 'MATERIAL PROPERTY Y')}</span>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white mt-0.5 leading-tight">
                        {t(cols.find(c => c.key === selectedCell.colKey)?.labelZh || '', cols.find(c => c.key === selectedCell.colKey)?.labelEn || '')}
                      </h4>
                      <p className="text-[9px] text-slate-400 mt-1 leading-snug truncate">
                        {t(cols.find(c => c.key === selectedCell.colKey)?.descriptionZh || '', cols.find(c => c.key === selectedCell.colKey)?.descriptionEn || '')}
                      </p>
                    </div>
                  </div>

                  {/* Sensitivity stat details */}
                  <div className="p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('瞬时贡献导数 (Slope dY/dX)', 'Dimensionless Sensitivity Coefficient')}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-lg font-black font-mono">
                          {selectedCellScore ? (selectedCellScore.score > 0 ? '+' : '') : ''}
                          {selectedCellScore?.score.toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          (selectedCellScore?.score || 0) > 0 
                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' 
                            : (selectedCellScore?.score || 0) < 0 
                              ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20' 
                              : 'text-slate-400 bg-slate-100 dark:bg-slate-900'
                        }`}>
                          {(selectedCellScore?.score || 0) > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {(selectedCellScore?.score || 0) > 0 ? t('协同正向', 'Pos Synergy') : (selectedCellScore?.score || 0) < 0 ? t('反相阻尼', 'Resistive Neg') : t('不相关', 'Neutral')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">{t('当前配方基准 Y', 'Base Reference Y')}</span>
                      <span className="text-sm font-black font-mono text-slate-700 dark:text-slate-350 mt-0.5 block">
                        {detailCurveData.find(d => d.percentNum === 0)?.value || 'N/A'}{' '}
                        <span className="text-[10px] font-normal">{cols.find(c => c.key === selectedCell.colKey)?.unit}</span>
                      </span>
                    </div>
                  </div>

                  {/* Prediction curve chart (Recharts) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      {t('配方变比投射非线性趋势线', 'Perturbation Non-Linear Curve Projection')}
                    </span>
                    <div className="w-full h-44 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 p-2.5 shadow-inner">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detailCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis 
                            dataKey="percent" 
                            tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} 
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="p-3.5 bg-slate-950 text-white rounded-2xl border border-slate-800 text-[11px] font-bold shadow-xl space-y-1">
                                    <p className="text-slate-400 uppercase tracking-wider text-[9px]">{t('扰动设定', 'INPUT PERTURB')}: {payload[0].payload.percent}</p>
                                    <p className="text-emerald-400 text-xs font-black">
                                      {t('预测物性', 'PROP PREDICT')}: {payload[0].value} {cols.find(c => c.key === selectedCell.colKey)?.unit}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <ReferenceLine x="0%" stroke="#f43f5e" strokeDasharray="3 3" />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#6366f1" 
                            strokeWidth={3} 
                            dot={{ stroke: '#6366f1', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Footnote explanations */}
                <p className="text-[10px] text-slate-450 dark:text-slate-400 italic bg-white dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-850 leading-relaxed shrink-0">
                  {selectedCellScore && selectedCellScore.score > 0 ? (
                    t(
                      '★ 机制阐述：在该特定高维工作区间，配方在增加该自变量输入时，会进一步激活并增强由于微观网架受拉与能量吸收极限引起的物理特性。',
                      '★ Polymer Physics: Within this composition envelope, increasing the constituent positive-biases molecular linkage density, actively elevating tensile network performance.'
                    )
                  ) : selectedCellScore && selectedCellScore.score < 0 ? (
                    t(
                      '★ 机制阐述：负向阻尼效能。增加该材料参数输入，会提高高分子链段的热容积或稀释溶胀度，从而反向消减或剪切破坏最终粘滞与聚物刚性指标。',
                      '★ Polymer Physics: Negative resistive damping. Elevating this variable creates a swelling dilution or molecular softening, suppressing total shear viscosity.'
                    )
                  ) : (
                    t(
                      '★ 机制阐述：微弱正交不耦合。两类配方物性的微分投影没有重叠相互独立，调整其配比将维持对应宏观性质不发生任何相变位移。',
                      '★ Polymer Physics: Uncoupled orthogonal properties. Perturbing this variable yields zero translation offsets, demonstrating decoupled stability.'
                    )
                  )}
                </p>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl text-primary-500 border border-slate-150/40 shadow-sm animate-bounce">
                  <TrendingUp size={28} />
                </div>
                <div className="max-w-[200px]">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    {t('无偏振特征详情', 'No element selected')}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {t('在左侧交互矩阵中选择任意彩色交叉偏导单元格，即可解锁高维偏导曲线及非线性预测模型分析。', 'Click any cell on the left matrix to chart non-linear derivative curves and polymer physics profiles.')}
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
