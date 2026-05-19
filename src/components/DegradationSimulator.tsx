import React, { useState, useMemo } from 'react';
import { Product } from '@/types';
import ReactECharts from "echarts-for-react";

interface DegradationSimulatorProps {
  product: Product;
}

export const DegradationSimulator: React.FC<DegradationSimulatorProps> = ({ product }) => {
  const [temperature, setTemperature] = useState(80); // Default 80C
  const [years, setYears] = useState(10); // Default 10 years

  // Simple Mock Arrhenius Model
  // P(t) = P_0 * exp(-k * t)
  // k(T) = A * exp(-E_a / (R * T))
  // T in Kelvin
  
  const options = useMemo(() => {
    // Generate data points
    const timePoints = [];
    const meanValues = [];
    const upperConfidence = [];
    const lowerConfidence = [];

    // Heuristics based on material
    const baseP0 = parseFloat(String(product.properties["拉伸强度"]?.value)) || 50; // default 50 MPa
    const RTi = parseFloat(String(product.properties["热变形温度"]?.value)) || 100; // default 100 C

    // Pseudo activation energy and pre-exponential factor based on thermal resistance
    const Ea = 80000 + (RTi * 100); // J/mol
    const R = 8.314;
    const A = 1e12; 
    
    // T = Temp + 273.15
    const T = temperature + 273.15;
    const k = A * Math.exp(-Ea / (R * T));

    for (let i = 0; i <= years * 12; i++) {
        const t = i / 12; // years
        timePoints.push(t.toFixed(1));
        
        // base degradation
        const degraded = baseP0 * Math.exp(-k * t * 8760); // approx hours
        meanValues.push(degraded);
        
        // mock 95% confidence bounds (gaussian process regression vibe)
        const uncertainty = degraded * (0.05 * t);
        upperConfidence.push(degraded + uncertainty);
        lowerConfidence.push(Math.max(0, degraded - uncertainty));
    }

    return {
      title: {
        text: 'Arrhenius Degradation (Strength MPa)',
        textStyle: { fontSize: 12, color: '#64748b', fontWeight: 'normal' },
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      grid: { left: 40, right: 20, bottom: 30, top: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timePoints,
        name: 'Years',
        nameLocation: 'middle',
        nameGap: 20
      },
      yAxis: {
        type: 'value',
        name: 'Retention',
        min: 0,
      },
      series: [
        {
            name: 'Upper 95% CI',
            type: 'line',
            data: upperConfidence,
            lineStyle: { opacity: 0 },
            symbol: 'none'
        },
        {
            name: 'Lower 95% CI',
            type: 'line',
            data: lowerConfidence,
            lineStyle: { opacity: 0 },
            areaStyle: {
                color: 'rgba(56, 189, 248, 0.2)', // light blue
            },
            stack: 'confidence',
            symbol: 'none'
        },
        {
            name: 'Expected Retention',
            type: 'line',
            data: meanValues,
            smooth: true,
            lineStyle: { color: '#0284c7', width: 3 }, // sky-600
            itemStyle: { color: '#0284c7' },
            symbol: 'none'
        }
      ]
    };
  }, [product, temperature, years]);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
         <h3 className="font-bold text-sm flex items-center gap-2">
            🧪 Temporal Degradation (Arrhenius)
         </h3>
      </div>
      <div className="flex items-center gap-4 mb-4 text-xs font-mono">
         <div className="flex flex-col gap-1">
            <span className="text-slate-500">Working Temp (°C)</span>
            <input 
              type="number" 
              value={temperature} 
              onChange={e => setTemperature(Number(e.target.value))} 
              className="w-20 bg-white dark:bg-slate-900 border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
            />
         </div>
         <div className="flex flex-col gap-1">
            <span className="text-slate-500">Timeline (Years)</span>
            <input 
              type="number" 
              value={years} 
              onChange={e => setYears(Number(e.target.value))} 
              className="w-20 bg-white dark:bg-slate-900 border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-sky-500"
            />
         </div>
      </div>
      <div className="h-64 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-lg">
         <ReactECharts option={options} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
};
