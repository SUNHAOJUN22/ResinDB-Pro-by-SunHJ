import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '../../contexts/ThemeContext';
import { Product } from '../../types';
import { useCarreauWorker } from '../../hooks/useCarreau';
import { Loader2, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface RheologyGraphProps {
  products: Product[];
  temps: number[];
}

const simulateRawPoints = (mfr: number, tempOffset: number) => {
   const eta0 = (80000 / Math.pow(Math.max(0.1, mfr), 0.8)) * Math.exp(tempOffset * -0.025);
   const lambda = 0.5 * Math.pow(Math.max(0.1, mfr), 0.4); 
   const n = 0.32; 
   const a = 2.0;

   const data: [number, number][] = [];
   for (let i = -2; i <= 6; i += 0.5) {
       const rate = Math.pow(10, i);
       // Add some noise to make it realistic for fitting
       const noise = 1 + (Math.random() - 0.5) * 0.15; // 15% noise max
       const viscosity = eta0 * Math.pow(1 + Math.pow(lambda * rate, a), (n - 1) / a) * noise;
       data.push([rate, viscosity]);
   }
   return data;
};

export const RheologyGraph: React.FC<RheologyGraphProps> = React.memo(({ products, temps }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();
  
  const { fittedParams, isFitting, fitCarreau, error } = useCarreauWorker();
  
  // For UI, just fit the first product at the first temp 
  // (In reality, we'd iterate, but showing one physical card is best)
  const mainProduct = products[0];
  const targetTemp = temps[0] || 190;
  
  const rawDataPoints = useMemo(() => {
      if (!mainProduct) return [];
      const flowVal = mainProduct.properties['熔体质量流动速率']?.value || mainProduct.properties['MFR']?.value || 5;
      const mfr = parseFloat(String(flowVal));
      return simulateRawPoints(isNaN(mfr) ? 5 : mfr, targetTemp - 190);
  }, [mainProduct, targetTemp]);

  useEffect(() => {
     if (rawDataPoints.length > 0) {
         fitCarreau(rawDataPoints.map(d => d[0]), rawDataPoints.map(d => d[1]));
     }
  }, [rawDataPoints, fitCarreau]);

  useEffect(() => {
    if (!chartRef.current || rawDataPoints.length === 0) return;

    if (!chartInstance.current) {
        chartInstance.current = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current, theme === 'dark' ? 'dark' : undefined);
    }
    
    const isDark = theme === 'dark';
    const axisColor = isDark ? "#94a3b8" : "#475569";
    
    const seriesData: echarts.SeriesOption[] = [
       {
           name: 'Raw Data Points',
           type: 'scatter',
           data: rawDataPoints,
           symbolSize: 8,
           itemStyle: { color: '#3b82f6', opacity: 0.7 }
       }
    ];
    
    if (fittedParams) {
        seriesData.push({
            name: 'Carreau-Yasuda Fit',
            type: 'line',
            data: fittedParams.fittedData,
            smooth: true,
            showSymbol: false,
            lineStyle: { color: '#f43f5e', width: 3, type: 'dashed' },
        });
    }

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: {
         left: "8%", right: "5%", bottom: "15%", top: "15%", containLabel: true
      },
      tooltip: {
         trigger: 'axis'
      },
      legend: {
         bottom: 0,
         textStyle: { color: axisColor }
      },
      xAxis: {
         type: 'log',
         name: 'Shear Rate (1/s)',
         nameLocation: 'middle',
         nameGap: 30,
         logBase: 10,
         splitLine: { show: false }
      },
      yAxis: {
         type: 'log',
         name: 'Viscosity (Pa·s)',
         nameLocation: 'middle',
         nameGap: 45,
         logBase: 10,
         splitLine: {
            lineStyle: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
         }
      },
      series: seriesData
    };

    chartInstance.current.setOption(option, true);
  }, [rawDataPoints, fittedParams, theme]);

  useEffect(() => {
     const ro = new ResizeObserver(() => { if (chartInstance.current) chartInstance.current.resize(); });
    if (chartRef.current) ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="absolute inset-0 pt-20 pb-10 px-8 flex flex-col">
       <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 z-10 w-full relative">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
               <Zap className="text-rose-500" size={20} />
               Carreau-Yasuda Rheology Model
            </h3>
            <p className="text-sm text-slate-500">Non-Linear Least Squares Fitting for Zero-Shear Viscosity (η₀) and Power-Law Index (n).</p>
          </div>
          
          {/* Dynamic Card */}
          <motion.div 
             initial={{ opacity: 0, y: -10 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-4 min-w-[280px]"
          >
             {isFitting ? (
               <div className="flex flex-col items-center justify-center gap-2 h-full py-4 text-rose-500">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-widest">Iterative Regression...</span>
               </div>
             ) : fittedParams ? (
               <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fitted Parameters</span>
                     <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                         R² = {fittedParams.rSquared.toFixed(3)}
                     </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                         <span className="block text-[10px] uppercase font-bold text-slate-400">Zero Shear (η₀)</span>
                         <span className="block text-lg font-black font-mono text-slate-800 dark:text-white">{fittedParams.eta0.toExponential(2)}</span>
                      </div>
                      <div>
                         <span className="block text-[10px] uppercase font-bold text-slate-400">Relaxation Time (λ)</span>
                         <span className="block text-lg font-black font-mono text-slate-800 dark:text-white">{fittedParams.lambda.toExponential(2)}</span>
                      </div>
                      <div>
                         <span className="block text-[10px] uppercase font-bold text-slate-400">Power Law (n)</span>
                         <span className="block text-lg font-black font-mono text-amber-500">{fittedParams.n.toFixed(3)}</span>
                      </div>
                      <div>
                         <span className="block text-[10px] uppercase font-bold text-slate-400">Transition (a)</span>
                         <span className="block text-lg font-black font-mono text-slate-800 dark:text-white">{fittedParams.a.toFixed(2)}</span>
                      </div>
                  </div>
               </div>
             ) : error ? (
               <div className="text-xs text-rose-500 font-bold">{error}</div>
             ) : null}
          </motion.div>
       </div>
       
       <div className="flex-1 w-full relative">
           <div ref={chartRef} className="absolute inset-0 w-full h-full" />
       </div>
    </div>
  );
});
