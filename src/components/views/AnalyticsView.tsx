import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useFormulas } from '@/hooks/math/useFormulas';
import { DataVisualizer } from '@/components/charts/DataVisualizer';
import { DataQualityMonitor } from '@/components/features/Analytics/DataQualityMonitor';
import { MaterialTrendForecaster } from '@/components/features/Analytics/MaterialTrendForecaster';
import { PredictiveTrends } from '@/components/features/Analytics/PredictiveTrends';
import { ResinCapacityForecast } from '@/components/features/Analytics/ResinCapacityForecast';
import { ShieldAlert, BarChart3, TrendingUp, LineChart, Factory } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/contexts/LanguageContext';

export const AnalyticsView: React.FC = () => {
    const { allProducts, selectedIds } = useData();
    const { formulas } = useFormulas();
    const { t } = useLanguage();
    const [subTab, setSubTab] = useState<'charts' | 'quality' | 'forecasting' | 'predictive-trends' | 'capacity-forecast'>('charts');

    const selectedProducts = useMemo(() => {
        return allProducts.filter(p => selectedIds.has(p.id));
    }, [allProducts, selectedIds]);

    return (
        <div className="h-full w-full flex flex-col space-y-4">
            {/* View Tab Selector */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0 select-none overflow-x-auto">
                <button
                    onClick={() => setSubTab('charts')}
                    className={`px-4 sm:px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        subTab === 'charts' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <BarChart3 size={14} />
                    <span>{t("scientificCharts")}</span>
                </button>
                <button
                    onClick={() => setSubTab('quality')}
                    className={`px-4 sm:px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        subTab === 'quality' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <ShieldAlert size={14} />
                    <span>{t("dataQualityDiagnostics")}</span>
                </button>
                <button
                    onClick={() => setSubTab('forecasting')}
                    className={`px-4 sm:px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        subTab === 'forecasting' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <TrendingUp size={14} />
                    <span>{t("materialDurabilityForecast")}</span>
                </button>
                <button
                    onClick={() => setSubTab('predictive-trends')}
                    className={`px-4 sm:px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        subTab === 'predictive-trends' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <LineChart size={14} />
                    <span>{t("predictiveTrends")}</span>
                </button>
                <button
                    onClick={() => setSubTab('capacity-forecast')}
                    className={`px-4 sm:px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        subTab === 'capacity-forecast' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <Factory size={14} />
                    <span>{t("resinCapacityForecast")}</span>
                </button>
            </div>

            {/* Render Views Dynamically */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {subTab === 'charts' && (
                        <motion.div
                            key="charts"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="h-full w-full"
                        >
                            <DataVisualizer 
                                data={allProducts} 
                                selectedProducts={selectedProducts} 
                                formulas={formulas} 
                            />
                        </motion.div>
                    )}
                    {subTab === 'quality' && (
                        <motion.div
                            key="quality"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                        >
                            <DataQualityMonitor products={allProducts} />
                        </motion.div>
                    )}
                    {subTab === 'forecasting' && (
                        <motion.div
                            key="forecasting"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                        >
                            <MaterialTrendForecaster 
                                products={allProducts} 
                                selectedProducts={selectedProducts} 
                              />
                        </motion.div>
                    )}
                    {subTab === 'predictive-trends' && (
                        <motion.div
                            key="predictive-trends"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="h-full w-full"
                        >
                            <PredictiveTrends />
                        </motion.div>
                    )}
                    {subTab === 'capacity-forecast' && (
                        <motion.div
                            key="capacity-forecast"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="h-full w-full"
                        >
                            <ResinCapacityForecast />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};


