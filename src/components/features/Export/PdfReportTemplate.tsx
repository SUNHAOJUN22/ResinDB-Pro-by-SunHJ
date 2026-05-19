import React, { forwardRef, useEffect, useRef } from "react";
import { Product, PropertyValue } from '@/types/index';
import { useLanguage } from "@/contexts/LanguageContext";
import { PROPERTY_GROUPS } from '@/config/constants';
import * as echarts from "echarts";
import { RADAR_KEYS, RADAR_DEFAULT_MAX } from '@/utils/productUtils';

interface PdfReportTemplateProps {
  product: Product;
}

export const PdfReportTemplate = forwardRef<HTMLDivElement, PdfReportTemplateProps>(({ product }, ref) => {
  const { tProp } = useLanguage();
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!product || !chartRef.current) return;

    const chartInstance = echarts.init(chartRef.current);
    let availableProps = RADAR_KEYS.filter((p) => product.properties?.[p] !== undefined);
    
    if (availableProps.length < 3) {
      const numericProps = Object.keys(product.properties).filter((k) => {
        const val = product.properties?.[k]?.value;
        return typeof val === "number" || !isNaN(parseFloat(String(val)));
      });
      availableProps = numericProps.slice(0, 5);
    }
    const props = availableProps.length >= 3 ? availableProps : RADAR_KEYS;

    const values = props.map((p) => {
      const v = product.properties?.[p]?.value;
      return typeof v === "number" ? v : parseFloat(String(v)) || 0;
    });

    const indicator = props.map((p, i) => {
      const defaultMax = RADAR_DEFAULT_MAX[p] || 100;
      return {
        name: tProp(p).slice(0, 15),
        max: Math.max(values[i] * 1.1, defaultMax),
      };
    });

    chartInstance.setOption({
      backgroundColor: 'transparent',
      radar: {
        indicator: indicator,
        radius: "60%",
        splitNumber: 4,
        axisName: { color: "#334155", fontSize: 12, fontWeight: "bold" },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: values,
              areaStyle: { color: "rgba(16, 185, 129, 0.2)" },
              lineStyle: { color: "#10b981", width: 2 },
              symbol: "circle",
              symbolSize: 6,
              itemStyle: { color: "#10b981" }
            },
          ],
        },
      ],
      animation: false // No animation for PDF
    });

    return () => chartInstance.dispose();
  }, [product, tProp]);

  const groups: Record<string, [string, PropertyValue][]> = {
    "General": [], "Mechanical": [], "Thermal": [], "Optical/Electrical": [], "Chemical": [], "Other": []
  };

  Object.entries(product.properties).forEach(([key, val]) => {
    let found = false;
    for (const groupName in PROPERTY_GROUPS) {
      if (PROPERTY_GROUPS[groupName].some((k) => key.includes(k) || k === key)) {
        groups[groupName].push([key, val as PropertyValue]);
        found = true;
        break;
      }
    }
    if (!found) groups["Other"].push([key, val as PropertyValue]);
  });

  return (
    <div className="absolute top-[-9999px] left-[-9999px]">
      <div 
        ref={ref} 
        style={{ width: '800px', backgroundColor: 'white', color: 'black' }} 
        className="p-10 font-sans"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center text-white font-black text-2xl">
              R
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">ResinDB Pro</h1>
              <p className="text-slate-500 font-mono text-sm tracking-widest uppercase mt-1">Technical Data Sheet</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Date Generated</p>
            <p className="font-mono font-bold text-slate-800">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Product Info */}
        <div className="mb-8">
          <h2 className="text-4xl font-black text-slate-900 mb-2">{product.gradeName}</h2>
          <div className="flex items-center gap-4 text-slate-700 font-mono text-base">
            <span className="font-bold flex items-center gap-2">
              Manufacturer: <span className="text-slate-900">{product.manufacturer}</span>
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Property Radar Analysis</h3>
          <div ref={chartRef} style={{ width: '100%', height: '350px' }} />
        </div>

        {/* Properties Table */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Physical & Chemical Properties</h3>
          
          <div className="space-y-6">
            {Object.entries(groups).map(([groupName, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupName} className="break-inside-avoid">
                  <h4 className="font-bold text-primary-700 bg-primary-50 py-1 px-3 rounded-md mb-2">{groupName} Properties</h4>
                  <table className="w-full text-sm font-mono text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-slate-500">
                        <th className="py-2 px-2 w-1/2">Property</th>
                        <th className="py-2 px-2 w-1/4">Value</th>
                        <th className="py-2 px-2 w-1/4">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(([key, prop]) => (
                        <tr key={key} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-medium text-slate-800">{tProp(key)}</td>
                          <td className="py-2 px-2 text-slate-900">{prop.value}</td>
                          <td className="py-2 px-2 text-slate-500">{prop.unit || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs font-mono">
          <p>Generated by ResinDB Pro System • Highly Confidential • {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
});
