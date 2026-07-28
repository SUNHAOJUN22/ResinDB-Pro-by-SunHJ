import React, { forwardRef, useEffect, useRef } from "react";
import { Product, PropertyValue } from '@/types/index';
import { useLanguage } from "@/contexts/LanguageContext";
import { PROPERTY_GROUPS } from '@/config/constants';
import * as echarts from "@/lib/echarts";
import { RADAR_KEYS, RADAR_DEFAULT_MAX } from '@/utils/productUtils';
import { useFormulas } from '@/hooks/math/useFormulas';
import { formulaEngine } from '@/lib/formulaParser';
import { Calculator } from 'lucide-react';

interface PdfReportTemplateProps {
  product: Product;
}

export const PdfReportTemplate = forwardRef<HTMLDivElement, PdfReportTemplateProps>(({ product }, ref) => {
  const { tProp, language } = useLanguage();
  const chartRef = useRef<HTMLDivElement>(null);
  const { formulas } = useFormulas();

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
        radius: "65%",
        splitNumber: 5,
        axisName: { color: "#334155", fontSize: 11, fontWeight: "bold" },
        splitLine: { lineStyle: { color: "#cbd5e1" } },
        splitArea: { show: true, areaStyle: { color: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1'] } },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: values,
              areaStyle: { color: "rgba(14, 165, 233, 0.2)" }, // Sky blue
              lineStyle: { color: "#0ea5e9", width: 2 },
              symbol: "circle",
              symbolSize: 6,
              itemStyle: { color: "#0ea5e9" }
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

  // Calculate advanced formulas
  const computedValues = formulas.length > 0 ? formulaEngine.compileGraph(formulas)(product) : {};

  return (
    <div className="absolute top-[-9999px] left-[-9999px]">
      <div 
        ref={ref} 
        style={{ width: '800px', backgroundColor: 'white', color: 'black' }} 
        className="relative p-10 font-sans overflow-hidden"
      >
        {/* Watermark */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] rotate-[-45deg] select-none z-0 text-[120px] font-black lowercase tracking-tighter">
          resindb pro
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex justify-between items-center border-b-4 border-slate-900 pb-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-3xl shadow-md">
                R
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">ResinDB Pro</h1>
                <p className="text-slate-500 font-mono text-sm tracking-widest uppercase mt-1">{language === "en" ? "Technical Data Sheet" : "标准物性表 (TDS)"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase font-bold text-slate-400 mb-1">{language === "en" ? "Report Date" : "生成日期"}</p>
              <p className="font-mono font-bold text-slate-800 text-lg">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Product Info */}
          <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-4xl font-black text-slate-900 mb-2">{product.gradeName}</h2>
            <div className="flex items-center gap-6 text-slate-700 font-mono text-base border-t border-slate-200 pt-3 mt-3">
              <span className="font-bold flex items-center gap-2">
                <span className="text-slate-400">{language === "en" ? "Manufacturer:" : "生产厂商:"}</span> <span className="text-slate-900">{product.manufacturer}</span>
              </span>
              <span className="font-bold flex items-center gap-2">
                <span className="text-slate-400">{language === "en" ? "Data ID:" : "数据编号:"}</span> <span className="text-slate-900">{product.id.slice(0,8)}</span>
              </span>
            </div>
          </div>

          {/* Grid Layout for Chart & Computed Formulas */}
          <div className="grid grid-cols-5 gap-6 mb-8">
            <div className="col-span-3 p-6 bg-white rounded-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                {language === "en" ? "Radar Analysis" : "多维性能全景"}
              </h3>
              <div ref={chartRef} style={{ width: '100%', height: '280px' }} />
            </div>

            <div className="col-span-2 p-6 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col">
              <h3 className="text-base font-bold text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calculator size={18} className="text-indigo-600" />
                {language === "en" ? "Computed Metrics" : "算法衍生指标"}
              </h3>
              <div className="flex-1 space-y-4">
                {formulas.length > 0 ? formulas.slice(0, 4).map(f => {
                  const val = computedValues[f.id];
                  const displayVal = typeof val === 'number' && !isNaN(val) ? val.toFixed(2) : '-';
                  return (
                    <div key={f.id} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                      <div className="text-xs font-bold text-slate-500 uppercase truncate mb-1" title={f.name}>{f.name}</div>
                      <div className="flex items-end gap-2">
                        <div className="font-mono text-xl font-bold text-indigo-700">{displayVal}</div>
                        {f.unit && <div className="text-xs text-slate-400 font-mono mb-1">{f.unit}</div>}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-sm text-slate-400 text-center mt-10">
                    {language === "en" ? "No computed formulas configured." : "暂无已配置的衍生算法公式。"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Properties Table in 2-Column Grid */}
          <div>
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-widest mb-4 border-b-2 border-slate-800 pb-2">
              {language === "en" ? "Tested Properties" : "实测理化性能参数"}
            </h3>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {Object.entries(groups).map(([groupName, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={groupName} className="break-inside-avoid">
                    <h4 className="font-bold text-slate-700 bg-slate-100 py-1.5 px-3 rounded-md mb-3 text-sm uppercase tracking-wider border-l-4 border-slate-400">
                      {language === "en" ? `${groupName} Properties` : `${tProp(groupName)} 性能组`}
                    </h4>
                    <table className="w-full text-xs font-mono text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-300 text-slate-500">
                          <th className="py-2 px-2 w-[55%] font-medium">{language === "en" ? "Property" : "测试项目"}</th>
                          <th className="py-2 px-2 w-[25%] font-medium">{language === "en" ? "Value" : "测试值"}</th>
                          <th className="py-2 px-2 w-[20%] font-medium">{language === "en" ? "Unit" : "单位"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(([key, prop]) => (
                          <tr key={key} className="hover:bg-slate-50">
                            <td className="py-2.5 px-2 font-bold text-slate-700">{tProp(key)}</td>
                            <td className="py-2.5 px-2 text-slate-900">{prop.value}</td>
                            <td className="py-2.5 px-2 text-slate-400">{prop.unit || '-'}</td>
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
          <div className="mt-12 pt-6 border-t font-medium border-slate-200 flex justify-between text-slate-400 text-[10px] font-mono uppercase tracking-widest">
            <p>ResinDB Pro Data Intelligence System</p>
            <p>Confidential Document • {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </div>
  );
});
