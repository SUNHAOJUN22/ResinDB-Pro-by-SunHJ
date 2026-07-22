import React, { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { Product } from '@/types/index';
import { SimilarityResult } from '@/services/mathUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface SimilarProductsRadarProps {
  targetProduct: Product;
  similarProducts: SimilarityResult[]; // Top 3
}

export const SimilarProductsRadar: React.FC<SimilarProductsRadarProps> = ({
  targetProduct,
  similarProducts,
}) => {
  const { tProp } = useLanguage();

  const data = useMemo(() => {
    // 1. Identify the top 6 numerical properties from the target product to display
    const propsWithValues = Object.entries(targetProduct.properties)
      .filter(([_, val]) => {
        const num = typeof val.value === 'number' ? val.value : parseFloat(String(val.value));
        return !isNaN(num);
      });

    // Just take the first 6 for visual clarity on a radar chart
    const radarKeys = propsWithValues.slice(0, 6).map(([key]) => key);

    return radarKeys.map((key) => {
      const dataPoint: Record<string, string | number> = {
        subject: tProp(key).slice(0, 10), // Truncate for display
        fullKey: key,
      };

      // Add target product value
      const tVal = targetProduct.properties[key]?.value;
      dataPoint[targetProduct.gradeName] = typeof tVal === 'number' ? tVal : parseFloat(String(tVal)) || 0;

      // Add similar products values
      similarProducts.forEach((sim) => {
        const sVal = sim.product.properties[key]?.value;
        dataPoint[sim.product.gradeName] = typeof sVal === 'number' ? sVal : parseFloat(String(sVal)) || 0;
      });

      return dataPoint;
    });
  }, [targetProduct, similarProducts, tProp]);

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400 font-mono text-xs">
        Not enough numerical data for radar chart.
      </div>
    );
  }

  return (
    <div className="w-full h-80 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-inner relative mt-4">
       <h4 className="absolute top-4 left-4 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 z-10">
         Multi-Dimensional Overlap
       </h4>
       <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="55%" outerRadius="65%" data={data}>
          <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
          />
          <PolarRadiusAxis angle={30} domain={['auto', 'auto']} tick={false} axisLine={false} />
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.9)', 
              borderColor: 'rgba(51, 65, 85, 0.5)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#fff',
              fontFamily: 'monospace'
            }} 
          />
          
          <Radar
            name={targetProduct.gradeName}
            dataKey={targetProduct.gradeName}
            stroke={colors[0]}
            fill={colors[0]}
            fillOpacity={0.4}
            strokeWidth={2}
          />

          {similarProducts.map((sim, idx) => (
            <Radar
              key={sim.product.id}
              name={sim.product.gradeName}
              dataKey={sim.product.gradeName}
              stroke={colors[idx + 1]}
              fill={colors[idx + 1]}
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          ))}

          <Legend 
             wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}
             iconType="circle"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
