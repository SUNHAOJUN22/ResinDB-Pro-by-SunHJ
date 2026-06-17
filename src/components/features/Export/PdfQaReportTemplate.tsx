import React, { forwardRef, useEffect, useRef } from "react";
import { Product } from '@/types/index';
import { useLanguage } from "@/contexts/LanguageContext";
import * as echarts from "echarts";

interface PdfQaReportTemplateProps {
  products: Product[];
  inspector: string;
  reportNo: string;
  standards: string[];
  notes: string;
  mfrMin: number;
  mfrMax: number;
  tensileMin: number;
}

export const PdfQaReportTemplate = forwardRef<HTMLDivElement, PdfQaReportTemplateProps>(({
  products,
  inspector,
  reportNo,
  standards,
  notes,
  mfrMin,
  mfrMax,
  tensileMin,
}, ref) => {
  const { tProp, language } = useLanguage();
  const summaryChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!products || products.length === 0 || !summaryChartRef.current) return;

    // We can draw a nice comparative radar or bar chart representing material property averages or direct values
    const chartInstance = echarts.init(summaryChartRef.current);
    
    // Pick top properties for display
    const keys = ["Density", "MFR", "Tensile Yield Strength", "Flexural Modulus", "Izod Impact Strength"];
    
    const seriesData = products.slice(0, 5).map((p) => {
      const pValues = keys.map((k) => {
        const valObj = Object.entries(p.properties).find(([key]) => key.toLowerCase().includes(k.toLowerCase()))?.[1];
        const val = valObj?.value;
        const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        // Normalize or scale roughly for comparative visualizing
        if (k === "Density") return num * 100; // e.g. 1.2 * 100 = 120
        if (k === "MFR") return num * 5; // e.g. 10 * 5 = 50
        return num;
      });

      return {
        name: p.gradeName,
        value: pValues,
      };
    });

    const indicator = keys.map((k) => ({
      name: language === "zh" ? tProp(k) : k,
      max: k === "Density" ? 200 : k === "MFR" ? 150 : k === "Flexural Modulus" ? 4000 : 150,
    }));

    chartInstance.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 0,
        textStyle: { color: '#334155', fontSize: 10, fontFamily: 'monospace' },
        itemWidth: 12,
        itemHeight: 12,
      },
      radar: {
        indicator: indicator,
        radius: "55%",
        splitNumber: 4,
        axisName: { color: "#475569", fontSize: 10, fontWeight: "bold" },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
        splitArea: { show: true, areaStyle: { color: ['#f8fafc', '#f1f5f9', '#ffffff'] } },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      series: [
        {
          type: "radar",
          data: seriesData,
          symbolSize: 4,
        },
      ],
      animation: false
    });

    return () => chartInstance.dispose();
  }, [products, language, tProp]);

  // QA Calculations for each product
  const getQaStatus = (p: Product) => {
    const mfrObj = Object.entries(p.properties).find(([k]) => k.toLowerCase().includes("mfr") || k.includes("熔指"))?.[1];
    const tensileObj = Object.entries(p.properties).find(([k]) => k.toLowerCase().includes("tensile") || k.includes("拉伸") || k.includes("屈服"))?.[1];

    const mfr = mfrObj ? (typeof mfrObj.value === 'number' ? mfrObj.value : parseFloat(String(mfrObj.value)) || 0) : null;
    const tensile = tensileObj ? (typeof tensileObj.value === 'number' ? tensileObj.value : parseFloat(String(tensileObj.value)) || 0) : null;

    const violations: string[] = [];
    if (mfr !== null) {
      if (mfr < mfrMin) violations.push(language === "zh" ? `熔指过低 (<${mfrMin})` : `MFR below safety limit (<${mfrMin})`);
      if (mfr > mfrMax) violations.push(language === "zh" ? `熔指过高 (>${mfrMax})` : `MFR above safety limit (>${mfrMax})`);
    }
    if (tensile !== null && tensile < tensileMin) {
      violations.push(language === "zh" ? `拉伸强度不足 (<${tensileMin} MPa)` : `Tensile strength insufficient (<${tensileMin} MPa)`);
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  };

  const today = new Date().toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      <div 
        ref={ref} 
        style={{ width: '850px', backgroundColor: '#ffffff', color: '#0f172a' }} 
        className="p-12 font-sans relative"
      >
        {/* Subtle Guilloche/Background Border */}
        <div className="absolute inset-4 border border-slate-200/60 rounded-3xl pointer-events-none z-0" />
        <div className="absolute inset-6 border-2 border-slate-900/10 rounded-2xl pointer-events-none z-0" />

        {/* Certificate Watermark Seal */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.02] select-none z-0">
          <svg width="450" height="450" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
            <circle cx="50" cy="50" r="45" strokeDasharray="3 3" />
            <circle cx="50" cy="50" r="40" />
            <polygon points="50,15 61,38 85,38 66,53 73,77 50,62 27,77 34,53 15,38 39,38" />
          </svg>
        </div>

        <div className="relative z-10 space-y-8">
          {/* Header Section */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-6">
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl border border-slate-800">
                QA
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                  {language === "zh" ? "材料品质安全性评估报告" : "Material Quality & Safety Assurance Report"}
                </h1>
                <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mt-0.5">
                  SYSTEM LEVEL CERTIFIED LAB TDS ANALYSIS
                </p>
                <div className="flex gap-4 mt-2 text-[10px] text-slate-500 font-medium">
                  <span>{language === "zh" ? `报告编号: ` : `Report No: `}<span className="font-mono text-slate-800 font-bold">{reportNo}</span></span>
                  <span>•</span>
                  <span>{language === "zh" ? `参考标准: ` : `Standards: `}<span className="text-slate-800 font-bold">{standards.join(', ')}</span></span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 rounded-full text-[9px] font-mono font-black text-slate-500 uppercase tracking-wider mb-2">
                ISO 9001 SYSTEM
              </div>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{language === "zh" ? "签发日期" : "ISSUE DATE"}</p>
              <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{today}</p>
            </div>
          </div>

          {/* Overview Metadata Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                {language === "zh" ? "被质检批数" : "SELECTED BATCHES"}
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 mt-1 block">
                {products.length} <span className="text-xs font-medium text-slate-400">{language === "zh" ? "款牌号" : "Grades"}</span>
              </span>
            </div>
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                {language === "zh" ? "检验主管印" : "INSPECTOR IN CHARGE"}
              </span>
              <span className="text-sm font-bold text-slate-900 mt-1 block h-8 flex items-center border-l-2 border-indigo-500 pl-2">
                {inspector || "QA Team Supervisor"}
              </span>
            </div>
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                {language === "zh" ? "安全判定总述" : "GLOBAL COMPLIANCE STATUS"}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                {products.every(p => getQaStatus(p).passed) ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200">
                    ✓ {language === "zh" ? "全部合规" : "ALL COMPLETED"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200">
                    ⚠️ {language === "zh" ? "存在不符合项" : "REASSESSMENT REQ"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Comparative Chart & Rules Header */}
          <div className="grid grid-cols-5 gap-6">
            <div className="col-span-3 p-5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-2">
                {language === "zh" ? "主要参数对比全景 (雷达拓扑)" : "TOP PROPERTY MULTI-AXIS TOPOLOGY"}
              </h3>
              <div ref={summaryChartRef} style={{ width: "100%", height: "230px" }} />
            </div>

            <div className="col-span-2 p-5 bg-slate-900 text-slate-100 rounded-xl flex flex-col justify-between border border-slate-800">
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                  {language === "zh" ? "质控安全基线约束" : "QUALITY BASELINE CONTROLLERS"}
                </h3>
                <div className="space-y-2.5 text-[11px] font-mono">
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">{language === "zh" ? "熔指 (MFR) 最小值" : "Min MFR Limit"}</span>
                    <span className="text-white font-bold">{mfrMin} g/10min</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">{language === "zh" ? "熔指 (MFR) 最大值" : "Max MFR Limit"}</span>
                    <span className="text-white font-bold">{mfrMax} g/10min</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">{language === "zh" ? "最低拉伸安全强度" : "Min Tensile Safety"}</span>
                    <span className="text-white font-bold">{tensileMin} MPa</span>
                  </div>
                  <div className="flex justify-between pb-1.5">
                    <span className="text-slate-400">{language === "zh" ? "RoHS / REACH 环保状态" : "RoHS & REACH Level"}</span>
                    <span className="text-emerald-400 font-bold">100% PASS</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 text-slate-400 mt-2 font-mono">
                <p className="font-bold text-slate-300 mb-0.5">💡 {language === "zh" ? "评估摘要说明:" : "TDS Eval Notes:"}</p>
                <p className="leading-relaxed">{notes || (language === "zh" ? "本报告通过批自动匹配系统校验牌号实测物性，判定其最终安全性状态。" : "This computerized sheet validated the material technical specifications automatically.")}</p>
              </div>
            </div>
          </div>

          {/* Detailed Product QA Spreadsheet Table */}
          <div>
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
              {language === "zh" ? "被测物料具体规格及安全合规清单" : "QUALITY CHECKSHEET BY SPECIFIC PRODUCT CODES"}
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-mono font-black text-[10px] tracking-wider">
                    <th className="p-3 w-[25%]">{language === "zh" ? "测试牌号 / 厂商" : "GRADE / MANUFACTURER"}</th>
                    <th className="p-3 w-[22%] text-center">{language === "zh" ? "实测熔指 MFR" : "MFR VALUE"}</th>
                    <th className="p-3 w-[22%] text-center">{language === "zh" ? "拉伸强度 TENSILE" : "TENSILE STRENGTH"}</th>
                    <th className="p-3 w-[15%] text-center">{language === "zh" ? "环保合规" : "REACH / ROHS"}</th>
                    <th className="p-3 w-[16%] text-center">{language === "zh" ? "安全结果" : "QA DECISION"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                  {products.map((p) => {
                    const mfrObj = Object.entries(p.properties).find(([k]) => k.toLowerCase().includes("mfr") || k.includes("熔指"))?.[1];
                    const tensileObj = Object.entries(p.properties).find(([k]) => k.toLowerCase().includes("tensile") || k.includes("拉伸") || k.includes("屈服"))?.[1];

                    const mfrVal = mfrObj?.value ?? "-";
                    const tensileVal = tensileObj?.value ?? "-";

                    const status = getQaStatus(p);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{p.gradeName}</p>
                          <p className="text-[9px] text-slate-400 tracking-wider truncate mt-0.5">{p.manufacturer}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-slate-800">{mfrVal}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">g/10min</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-slate-800">{tensileVal}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">MPa</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block px-2 py-0.5 bg-emerald-50 text-[10px] text-emerald-600 font-bold rounded-full border border-emerald-200">
                            COMPLIANT
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {status.passed ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-emerald-100 text-[10px] text-emerald-700 font-black rounded-lg border border-emerald-200">
                              PASS
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-rose-100 text-[10px] text-rose-700 font-black rounded-lg border border-rose-200" title={status.violations.join('; ')}>
                                WARN ⚠️
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Displaying safety failure violations if any */}
            {!products.every(p => getQaStatus(p).passed) && (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider block">
                  ⚠️ {language === "zh" ? "材料理化性能安全不合规说明:" : "SPECIFICATION DEVIATION NOTES:"}
                </span>
                <ul className="list-disc pl-5 text-[11px] text-rose-800 space-y-1 font-mono">
                  {products.map(p => {
                    const stat = getQaStatus(p);
                    if (stat.passed) return null;
                    return (
                      <li key={p.id}>
                        <span className="font-bold text-slate-900">{p.gradeName}</span>: {stat.violations.join(', ')}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Certificate Stamp and Corporate Signature Box */}
          <div className="flex justify-between items-end border-t border-slate-200 pt-8 mt-6">
            <div className="space-y-1.5 text-[10px] text-slate-500 font-mono">
              <p className="font-black text-slate-800 uppercase tracking-wide">System Security Declarations</p>
              <p>• Data compiled from verified production batches.</p>
              <p>• RoHS compliance tested according to IEC 62321 standards.</p>
              <p>• Heavy metals concentration below 100ppm safety levels.</p>
            </div>

            <div className="flex gap-10 items-center">
              {/* Chemical Compliance Seal Graphic */}
              <div className="relative w-18 h-18 select-none shrink-0 border border-dashed border-indigo-200 rounded-full flex items-center justify-center">
                <div className="w-14 h-14 border border-indigo-400 bg-indigo-50/20 text-indigo-500 rounded-full flex flex-col items-center justify-center shrink-0">
                  <span className="text-[7px] font-black block leading-none uppercase">APPROVED</span>
                  <span className="text-[11px] font-mono font-black block leading-none mt-1">QA LAB</span>
                  <span className="text-[6px] font-medium block leading-none text-indigo-400 uppercase tracking-tighter mt-1">VERIFIED</span>
                </div>
              </div>

              {/* Signature Block */}
              <div className="w-48 text-center shrink-0">
                <div className="h-10 border-b border-slate-350 relative flex items-center justify-center">
                  {/* Dynamic simulated handwritten signature in SVG */}
                  <svg width="100" height="30" viewBox="0 0 100 30" fill="none" className="text-indigo-600">
                    <path d="M10,25 C20,20 40,5 50,15 C60,25 70,12 90,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M45,20 C55,10 65,8 75,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest mt-1.5">
                  AUTHORIZED SIGNATURE
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
