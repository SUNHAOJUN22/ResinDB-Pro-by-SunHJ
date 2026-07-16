import { motion } from 'motion/react';
import React, { useEffect, useState, useMemo } from 'react';
import { useForecastingWorker } from '@/hooks/workers/useForecastingWorker';
import { Product } from '@/types/index';
import { 
  TrendingUp, Sparkles, Cpu, Activity,
  AlertTriangle, CheckCircle2, ShieldAlert, Loader2, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip,
  Line, Area, ReferenceLine, CartesianGrid
} from 'recharts';

interface MaterialTrendForecasterProps {
  products: Product[];
  selectedProducts?: Product[];
}

export const MaterialTrendForecaster: React.FC<MaterialTrendForecasterProps> = ({ 
  products,
  selectedProducts = []
}) => {
  const { isProjecting, forecastResult, forecastError, runCalculatedForecast } = useForecastingWorker();

  // Pick active products cluster (selected, otherwise fall back to all)
  const activeProducts = useMemo(() => {
    return selectedProducts.length > 0 ? selectedProducts : products;
  }, [products, selectedProducts]);

  // Extract all available numeric property fields dynamically
  const numericProperties = useMemo(() => {
    const keys = new Set<string>();
    activeProducts.forEach(p => {
      if (p.properties) {
        Object.entries(p.properties).forEach(([key, val]) => {
          if (val && val.value !== undefined && val.value !== null) {
            const num = parseFloat(String(val.value).trim());
            if (!isNaN(num)) {
              keys.add(key);
            }
          }
        });
      }
    });
    return Array.from(keys).sort();
  }, [activeProducts]);

  // Default selection or fallback
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [algorithm, setAlgorithm] = useState<'linear' | 'exponential' | 'holt-winters'>('exponential');
  const [condition, setCondition] = useState<'thermal' | 'uv' | 'hydrolysis' | 'cyclic'>('thermal');
  
  // Custom slider values depending on the stress factor selected
  const [stressFactor, setStressFactor] = useState<number>(85); // 85°C default thermal oven
  const [alpha, setAlpha] = useState<number>(0.4);
  const [beta, setBeta] = useState<number>(0.3);

  // Sync selectedProperty once keys load
  useEffect(() => {
    if (numericProperties.length > 0 && !selectedProperty) {
      // Prioritize some key polymer metrics if available
      const bestDefault = numericProperties.find(k => 
        k.toLowerCase() === 'tensile strength' || 
        k.toLowerCase() === '拉伸强度' || 
        k.toLowerCase() === 'impact strength' || 
        k.toLowerCase() === '缺口冲击强度'
      ) || numericProperties[0];
      setSelectedProperty(bestDefault);
    }
  }, [numericProperties, selectedProperty]);

  // Adjust stress slider defaults when stress condition shifts
  useEffect(() => {
    if (condition === 'thermal') {
      setStressFactor(85); // Oven baking temperature in °C
    } else if (condition === 'uv') {
      setStressFactor(12); // Average direct UV irradiation hours/day
    } else if (condition === 'hydrolysis') {
      setStressFactor(90); // Hot high humidity water bath RH%
    } else if (condition === 'cyclic') {
      setStressFactor(15); // Stress repeating peak load MPa
    }
  }, [condition]);

  // Trigger analytical simulation block
  const triggerFreshForecast = () => {
    if (activeProducts.length > 0 && selectedProperty) {
      runCalculatedForecast(
        activeProducts,
        selectedProperty,
        algorithm,
        condition,
        stressFactor,
        alpha,
        beta
      );
    }
  };

  // Re-trigger forecasting automatically when core parameters change
  useEffect(() => {
    if (activeProducts.length > 0 && selectedProperty) {
      runCalculatedForecast(
        activeProducts,
        selectedProperty,
        algorithm,
        condition,
        stressFactor,
        alpha,
        beta
      );
    }
  }, [activeProducts, selectedProperty, algorithm, condition, stressFactor, alpha, beta, runCalculatedForecast]);

  const getConditionLabel = (cond: typeof condition) => {
    switch (cond) {
      case 'thermal': return 'Arrhenius Thermo-Oxidative Oven (°C)';
      case 'uv': return 'Xenon-Arc weathering UV cycles (hrs/day)';
      case 'hydrolysis': return 'Hot Water Hydrolysis Chamber (% RH)';
      case 'cyclic': return 'Cyclic Tension Repetitive Load (MPa)';
    }
  };

  // Status helper colors
  const getStatusBadge = (status: 'safe' | 'warning' | 'danger') => {
    switch (status) {
      case 'safe':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40';
      case 'danger':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header description */}
      <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/40 rounded-3xl space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={20} />
          <h3 className="text-sm font-black text-indigo-950 dark:text-white uppercase tracking-tight">
            Advanced Material Aging & Drift Forecaster
          </h3>
          <span className="text-[10px] bg-indigo-600 text-white font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-widest pl-2">
            12-Month Projections
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
          Simulate chemical and physical performance drifts of resin selections using background multi-model fittings (Linear, Exp Decay, Holt-Winters). Adjust environmental accelerators and stress parameters to forecast retention rates and estimate T50 material half-lives.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Controls and Parameter selectors */}
        <div className="space-y-4 lg:col-span-1">
          
          <div className="p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-3xl space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
              Simulation Inputs
            </h4>

            {/* Target Property */}
            <div className="space-y-1.5">
              <label htmlFor="propertySelector" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Material Property to Analyze
              </label>
              {numericProperties.length === 0 ? (
                <div className="text-xs text-amber-500 font-semibold p-2">
                  No compatible numeric properties detected in scope.
                </div>
              ) : (
                <select
                  id="propertySelector"
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                >
                  {numericProperties.map(prop => (
                    <option key={prop} value={prop}>{prop}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Forecasting Stress Condition */}
            <div className="space-y-1.5">
              <label htmlFor="conditionSelector" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Aging Stress Mode
              </label>
              <select
                id="conditionSelector"
                value={condition}
                onChange={(e: any) => setCondition(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
              >
                <option value="thermal">🔥 Thermal Oven Degradation (Arrhenius)</option>
                <option value="uv">☀️ Photo-Oxidative UV Weathering (Ozone)</option>
                <option value="hydrolysis">💧 Hot Humidity Chamber (Hydrolysis)</option>
                <option value="cyclic">🔄 Cyclic Stress Fatigue Endurance</option>
              </select>
            </div>

            {/* Dynamic Slider for Stress Accelerator Factor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Climate Stress Intensity
                </span>
                <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                  {stressFactor.toFixed(0)} {condition === 'thermal' ? '°C' : condition === 'uv' ? 'hrs/day' : condition === 'hydrolysis' ? '% RH' : 'MPa'}
                </span>
              </div>
              <input
                aria-label="Climate Stress Intensity Selector"
                type="range"
                min={condition === 'thermal' ? '30' : condition === 'uv' ? '1' : condition === 'hydrolysis' ? '10' : '2'}
                max={condition === 'thermal' ? '180' : condition === 'uv' ? '24' : condition === 'hydrolysis' ? '100' : '100'}
                step="1"
                value={stressFactor}
                onChange={(e) => setStressFactor(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-indigo-600 animate-none"
              />
              <p className="text-[9px] text-slate-400 leading-relaxed italic font-semibold">
                * {getConditionLabel(condition)}
              </p>
            </div>

            {/* Forecasting Algorithm */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-850">
              <label htmlFor="algorithmSelector" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Mathematical Model Kernel
              </label>
              <select
                id="algorithmSelector"
                value={algorithm}
                onChange={(e: any) => setAlgorithm(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
              >
                <option value="linear">Linear Least-Squares Regression</option>
                <option value="exponential">First-Order Chemical Decay (Exponential)</option>
                <option value="holt-winters">Holt-Winters Double Smoothing (Trend-Adjusted)</option>
              </select>
            </div>

            {algorithm === 'holt-winters' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-850">
                <div className="space-y-1.5">
                  <label htmlFor="alphaVal" className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Alpha (α) Level</label>
                  <input 
                    id="alphaVal"
                    type="number"
                    min="0.01" max="0.99" step="0.05"
                    value={alpha}
                    onChange={(e) => setAlpha(parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="betaVal" className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Beta (β) Trend</label>
                  <input 
                    id="betaVal"
                    type="number"
                    min="0.01" max="0.99" step="0.05"
                    value={beta}
                    onChange={(e) => setBeta(parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold outline-none"
                  />
                </div>
              </div>
            )}

            {/* Quick action button just to manual trigger if they need */}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={triggerFreshForecast}
              disabled={isProjecting || !selectedProperty}
              className="w-full py-2.5 px-4 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/35 text-indigo-600 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={12} className={`${isProjecting ? 'animate-spin' : ''}`} />
              <span>Force Re-Simulate</span>
            </motion.button>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-2xl flex items-center gap-3">
              <Cpu className="text-indigo-500 shrink-0" size={16} />
              <div className="text-[10px] text-slate-500 font-semibold leading-normal">
                Analysis targets: <strong className="text-slate-800 dark:text-white font-bold">{activeProducts.length}</strong> grades. 
                {selectedProducts.length > 0 ? (
                  <span className="text-indigo-600 dark:text-indigo-400 block mt-0.5">Focusing on active checkboxes selections.</span>
                ) : (
                  <span className="block mt-0.5">Averaging across entire dataset baseline.</span>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Right column: Chart output & Metrics breakdown */}
        <div className="lg:col-span-2 space-y-4">
          
          {forecastError ? (
            <div className="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/30 rounded-3xl flex items-start gap-3">
              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="text-xs font-black text-rose-800 dark:text-rose-400 uppercase tracking-wider">Prediction Engine Fault</h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{forecastError}</p>
              </div>
            </div>
          ) : isProjecting && !forecastResult ? (
            <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-800 border-dashed rounded-3xl p-12 min-h-[400px] flex flex-col items-center justify-center space-y-6 text-center">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
              <div className="max-w-xs space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Calculating Drift Slopes</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Running decay regressions along sequential material structures under the background process...
                </p>
              </div>
            </div>
          ) : forecastResult ? (
            <div className="space-y-4">

              {/* 1. Scientific Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Original Index</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono">
                    {forecastResult.metrics.currentValue.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">12-Month Proj</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono">
                    {forecastResult.metrics.projectedValue12m.toFixed(2)}
                  </span>
                </div>
                <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Specification Retention</span>
                  <span className={`text-lg font-black mt-2 font-mono ${
                    forecastResult.metrics.retentionPercent >= 85 ? 'text-emerald-500' : forecastResult.metrics.retentionPercent >= 65 ? 'text-amber-500' : 'text-rose-500'
                  }`}>
                    {forecastResult.metrics.retentionPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Expected T50 Half-Life</span>
                  <span className="text-lg font-black text-indigo-500 mt-2 font-mono truncate">
                    {forecastResult.metrics.halfLifeMonths}
                  </span>
                </div>
              </div>

              {/* 2. Interactive Charts Rendering */}
              <div className="p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                    <Activity size={12} className="text-indigo-500 animate-pulse" />
                    Property Kinetic Path vs Future Forecast Horizon
                  </h5>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide font-black">
                    <span className="flex items-center gap-1 text-slate-400 font-mono">
                      <span className="w-2.5 h-2 bg-slate-400 dark:bg-slate-500 inline-block rounded-md" /> Historical (Month -12 to 0)
                    </span>
                    <span className="flex items-center gap-1 text-indigo-500 font-mono">
                      <span className="w-2.5 h-0.5 border-t-2 border-dashed border-indigo-500 inline-block" /> 12m Projection
                    </span>
                  </div>
                </div>

                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={forecastResult.trendPoints}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:hidden opacity-40" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block opacity-40" />
                      <XAxis 
                        dataKey="monthLabel" 
                        tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          border: 'none', 
                          borderRadius: '12px', 
                          fontSize: '11px',
                          color: '#fff',
                          fontWeight: '600'
                        }}
                      />
                      
                      {/* Safety region reference threshold */}
                      <ReferenceLine 
                        y={forecastResult.metrics.currentValue * 0.7} 
                        stroke="#f43f5e" 
                        strokeDasharray="4 4"
                        label={{ value: 'Critical Safety Cap (70%)', position: 'insideBottomRight', fill: '#f43f5e', fontSize: 8, fontWeight: 800 }}
                      />

                      {/* shadow CI bands */}
                      <Area 
                        name="95% confidence interval"
                        type="monotone" 
                        dataKey="lowerBound" 
                        stroke="none" 
                        fill="#6366f1" 
                        fillOpacity={0.06} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="upperBound" 
                        stroke="none" 
                        fill="#6366f1" 
                        fillOpacity={0.06} 
                      />

                      {/* Historical Solid Plot */}
                      <Line 
                        name="Observed Baseline History"
                        type="monotone" 
                        dataKey="observed" 
                        stroke="#64748b" 
                        strokeWidth={2.5} 
                        dot={{ r: 3, strokeWidth: 1 }} 
                        activeDot={{ r: 5 }} 
                      />

                      {/* Forecast Dashed Plot */}
                      <Line 
                        name="Forecasted Trendline"
                        type="monotone" 
                        dataKey="predicted" 
                        stroke="#6366f1" 
                        strokeWidth={2.5} 
                        strokeDasharray="5 5" 
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3. Safety Advice Banner depending on retention status */}
              <div className={`p-5 border rounded-3xl flex items-start gap-3.5 ${getStatusBadge(forecastResult.metrics.safetyStatus)}`}>
                {forecastResult.metrics.safetyStatus === 'safe' ? (
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : forecastResult.metrics.safetyStatus === 'warning' ? (
                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert size={18} className="text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h5 className="text-xs font-black uppercase tracking-tight">
                    {forecastResult.metrics.safetyStatus === 'safe' && 'STABILITY CLASSIFICATION: SECURE'}
                    {forecastResult.metrics.safetyStatus === 'warning' && 'STABILITY CLASSIFICATION: MODERATE RISK WARNING'}
                    {forecastResult.metrics.safetyStatus === 'danger' && 'STABILITY CLASSIFICATION: UNSTABLE DECAY THRESHOLD'}
                  </h5>
                  <p className="text-xs mt-1 font-semibold leading-relaxed opacity-90">
                    {forecastResult.metrics.safetyMessage}
                  </p>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-slate-150 dark:border-slate-850 rounded-3xl p-12 min-h-[400px] flex flex-col items-center justify-center space-y-3 text-center border-dashed">
              <Sparkles className="text-indigo-500/80 animate-pulse" size={32} />
              <div className="max-w-xs space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Awaiting Input Parameters</h4>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Select a target polymeric property from the inputs and trigger forecast models to calculate predicted degradation.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

// v3.1.0-sync

// v3.1.0-sync-fixed
