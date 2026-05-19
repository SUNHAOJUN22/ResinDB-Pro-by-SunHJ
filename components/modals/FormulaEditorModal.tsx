import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as echarts from "echarts";
import {
  X,
  Calculator,
  Plus,
  Trash2,
  Info,
  Check,
  Play,
  Settings,
  Layers,
  Activity,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { FormulaConfig, Product } from "../../types";
import { formulaEngine } from "../../lib/formulaParser";
import { useLanguage } from "../../contexts/LanguageContext";
import { useMonteCarlo } from "../../hooks/useMonteCarlo";

interface FormulaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulas: FormulaConfig[];
  onAdd: (f: Omit<FormulaConfig, "id">) => void;
  onUpdate: (id: string, f: Partial<FormulaConfig>) => void;
  onRemove: (id: string) => void;
  allProducts: Product[];
}

export const FormulaEditorModal: React.FC<FormulaEditorModalProps> = ({
  isOpen,
  onClose,
  formulas,
  onAdd,
  onUpdate,
  onRemove,
  allProducts,
}) => {
  const { t: _t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [testResult, setTestResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);
  const [variances, setVariances] = useState<Record<string, number>>({});
  const { simulationStats, isSimulating, error: mcError, runSimulation, resetSimulation } = useMonteCarlo();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Extract variables used in the formula
  const usedVariables = useMemo(() => {
     const matches: string[] = expression.match(/props\['([^']+)'\]/g) || [];
     const vars = new Set<string>();
     matches.forEach(m => vars.add(m.replace(/^props\['/, '').replace(/'\]$/, '')));
     return Array.from(vars);
  }, [expression]);

  // Sync variance state when used variables change
  useEffect(() => {
     setVariances(prev => {
         const next = { ...prev };
         for (const v of usedVariables) {
             if (!(v in next)) next[v] = 5; // Default 5% variance
         }
         return next;
     });
     resetSimulation();
  }, [usedVariables, resetSimulation]);
  
  // Render KDE chart when stats update
  useEffect(() => {
     if (showMonteCarlo && simulationStats && chartRef.current) {
         if (!chartInstance.current) {
             chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
         }
         
         const data = simulationStats.kde.map(d => [d.x, d.y]);
         
         chartInstance.current.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                
                 
                formatter: (params: any) => {
                    const x = params[0].value[0].toFixed(2);
                    return `Value: ${x}`;
                }
            },
            grid: { top: 20, right: 20, bottom: 20, left: 20 },
            xAxis: { 
                type: 'value', 
                scale: true,
                axisLabel: { fontSize: 10, color: '#94a3b8' },
                splitLine: { show: false }
            },
            yAxis: { 
                type: 'value', 
                show: false 
            },
            series: [{
                name: 'KDE',
                type: 'line',
                data: data,
                smooth: true,
                symbol: 'none',
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(99, 102, 241, 0.4)' },
                        { offset: 1, color: 'rgba(99, 102, 241, 0.05)' }
                    ])
                },
                lineStyle: { color: '#6366f1', width: 2 },
                markLine: {
                    symbol: 'none',
                    data: [
                        { xAxis: simulationStats.p5, lineStyle: { color: '#f43f5e', type: 'dashed' }, label: { formatter: 'P5', position: 'insideStartTop' } },
                        { xAxis: simulationStats.p95, lineStyle: { color: '#f43f5e', type: 'dashed' }, label: { formatter: 'P95', position: 'insideEndTop' } }
                    ]
                }
            }]
         });
     }
  }, [simulationStats, showMonteCarlo]);

  // Handle Resize
  useEffect(() => {
      const ro = new ResizeObserver(() => { if (chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  // Available properties for variables
  const availableProps = useMemo(() => {
    const keys = new Set<string>();
    allProducts.slice(0, 100).forEach((p) => {
      Object.keys(p.properties).forEach((k) => keys.add(k));
    });
    return Array.from(keys).sort();
  }, [allProducts]);

  const currentFormula = formulas.find((f) => f.id === editingId);

  useEffect(() => {
    if (currentFormula) {
      setName(currentFormula.name);
      setExpression(currentFormula.expression);
      setDescription(currentFormula.description || "");
      setUnit(currentFormula.unit || "");
    } else {
      setName("");
      setExpression("");
      setDescription("");
      setUnit("");
    }
    setError(null);
    setTestResult(null);
  }, [currentFormula, editingId]);

  const handleTest = () => {
    if (!expression.trim()) return;
    try {
      const tempConfig: FormulaConfig = { id: "temp_test_id", name: name || "TestFormula", expression, unit: "" };
      const tempFormulas = [...formulas.filter(f => f.name !== tempConfig.name), tempConfig];
      const evaluator = formulaEngine.compileGraph(tempFormulas);
      
      const firstProduct = allProducts[0];
      if (firstProduct) {
        const result = evaluator(firstProduct)[tempConfig.id];
        setTestResult(result);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid formula or cyclic dependency detected");
    }
  };

  const handleSave = () => {
    if (!name || !expression) return;
    const validationError = formulaEngine.validate(expression, name, formulas);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (editingId) {
      onUpdate(editingId, { name, expression, description, unit });
    } else {
      onAdd({ name, expression, description, unit });
    }
    setEditingId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl max-h-[80vh] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-2xl text-primary-600">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                Performance Index Engine
              </h2>
              <p className="text-xs text-slate-500 font-medium tracking-wide flex items-center gap-1.5 uppercase">
                <Settings size={12} /> Custom Material Computation Formulas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar: Formula List */}
          <div className="w-64 border-r border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-950/20">
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <button
                onClick={() => setEditingId(null)}
                className={`w-full flex items-center gap-2 p-3 rounded-2xl text-sm font-bold transition-all border ${editingId === null ? "bg-primary-600 text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"}`}
              >
                <Plus size={16} /> New Formula
              </button>

              <div className="space-y-1">
                {formulas.map((f) => (
                  <div key={f.id} className="group relative">
                    <button
                      onClick={() => setEditingId(f.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${editingId === f.id ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                    >
                      {f.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(f.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Index Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Stiffness-to-Weight"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Unit
                  </label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. MPa, g/cm³"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Formula (JS Syntax)
                  </label>
                  <div className="relative">
                    <textarea
                      value={expression}
                      onChange={(e) => setExpression(e.target.value)}
                      placeholder="props['Density'] * 0.1"
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-primary-500/20 outline-none transition-all resize-none"
                    />
                    <div className="absolute right-3 bottom-3 flex gap-2">
                      <button
                        onClick={handleTest}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all shadow-sm flex items-center gap-1.5 text-[10px] font-black"
                      >
                        <Play size={10} /> TEST
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p className="text-[10px] text-rose-500 font-bold px-1">
                      {error}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed explanation of this computation..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl space-y-3">
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 uppercase tracking-tight">
                    <Layers size={14} /> Available Properties
                  </h3>
                  <div className="flex flex-wrap gap-1.5 h-40 lg:h-48 overflow-y-auto custom-scrollbar p-1">
                    {availableProps.map((prop) => (
                      <button
                        key={prop}
                        onClick={() =>
                          setExpression((prev) => prev.endsWith("props['") ? prev + `${prop}']` : prev + `props['${prop}']`)
                        }
                        className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-500 hover:border-primary-500 hover:text-primary-600 rounded-lg transition-all"
                      >
                        {prop}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3 text-[10px] text-indigo-500/60 font-bold italic">
                    <Info size={12} /> Click to insert into formula
                  </div>
                </div>

                {testResult !== null && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            Test Output
                          </p>
                          <p className="text-2xl font-mono font-black text-emerald-700 dark:text-emerald-400">
                            {testResult.toFixed(4)}
                          </p>
                        </div>
                        <div className="p-3 bg-emerald-500 rounded-2xl text-white">
                          <Check size={20} />
                        </div>
                    </div>
                    
                    {/* Monte Carlo Simulator Toggle */}
                    <div className="border-t border-emerald-200/50 dark:border-emerald-800/50 pt-3">
                       <button 
                         onClick={() => setShowMonteCarlo(!showMonteCarlo)}
                         className="flex items-center justify-between w-full text-xs font-bold text-emerald-700 dark:text-emerald-500 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 p-2 rounded-lg transition-colors"
                       >
                           <span className="flex items-center gap-1.5"><Activity size={14}/> Monte Carlo Uncertainty Simulator</span>
                           {showMonteCarlo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                       </button>
                    </div>
                    
                    <AnimatePresence>
                        {showMonteCarlo && (
                           <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                           >
                              <div className="pt-2 pb-2 space-y-3">
                                  <div>
                                     <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Input Variability (+/- %)</p>
                                     <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                        {usedVariables.length === 0 ? (
                                           <div className="text-xs text-slate-400 italic">No variables detected yet. Add a property to the formula to simulate uncertainty.</div>
                                        ) : usedVariables.map(v => (
                                            <div key={v} className="flex items-center justify-between">
                                                <span className="text-[10px] font-mono text-slate-600 truncate max-w-[120px]" title={v}>{v}</span>
                                                <div className="flex items-center gap-2">
                                                   <span className="text-[10px] text-slate-400 font-bold">{variances[v]}%</span>
                                                   <input 
                                                      type="range" min="0" max="25" step="1" 
                                                      value={variances[v] || 0}
                                                      onChange={e => setVariances(prev => ({...prev, [v]: parseInt(e.target.value)}))}
                                                      className="w-20 accent-emerald-500"
                                                   />
                                                </div>
                                            </div>
                                        ))}
                                     </div>
                                  </div>
                                  
                                  <button
                                     onClick={() => {
                                        if (allProducts[0] && expression) {
                                            const tempConfig = { id: name || "temp", name, expression, unit };
                                            const testFormulas = [...formulas.filter(f => f.id !== tempConfig.id), tempConfig];
                                            runSimulation(tempConfig.id, testFormulas, allProducts[0], variances, 5000);
                                        }
                                     }}
                                     disabled={usedVariables.length === 0 || isSimulating || !expression}
                                     className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                                  >
                                      {isSimulating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 
                                      {isSimulating ? "Simulating..." : "Run 5000 Permutations"}
                                  </button>
                                  
                                  {mcError && <p className="text-[10px] text-rose-500 font-bold">{mcError}</p>}
                                  
                                  {/* Result Chart */}
                                  {simulationStats && (
                                     <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                                         <div className="flex justify-between items-center mb-1">
                                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Distribution (KDE)</span>
                                             <span className="text-[10px] font-mono text-emerald-600 font-bold border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                μ = {simulationStats.mean.toFixed(2)}, σ = {simulationStats.stdDev.toFixed(2)}
                                             </span>
                                         </div>
                                         <div ref={chartRef} className="w-full h-32" />
                                         <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-slate-400">
                                             <span>P5: {simulationStats.p5.toFixed(2)}</span>
                                             <span>90% CI</span>
                                             <span>P95: {simulationStats.p95.toFixed(2)}</span>
                                         </div>
                                     </div>
                                  )}
                              </div>
                           </motion.div>
                        )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 gap-4">
          <p className="text-[10px] text-slate-400 font-bold italic flex items-center gap-1.5 text-center sm:text-left">
            <Info size={12} className="shrink-0" /> Computed columns are
            automatically added to the Data Grid and Analytics charts.
          </p>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name || !expression}
              className="flex-1 sm:flex-none px-8 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl text-sm font-black shadow-lg shadow-primary-500/20 transition-all active:scale-95"
            >
              Save Formula
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
