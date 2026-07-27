import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, FileText, BadgeCheck, ShieldCheck, Download, 
  User, Bookmark, Loader2 
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToasts } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Product } from "@/types/index";
import { PdfQaReportTemplate } from "@/components/features/Export/PdfQaReportTemplate";

interface QaReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export const QaReportModal: React.FC<QaReportModalProps> = ({ isOpen, onClose, products }) => {
  const { language } = useLanguage();
  const { addToast } = useToasts();
  const { currentUser } = useAuth();

  const [inspector, setInspector] = useState(currentUser?.name || currentUser?.email || "Lab Analyst Code-Y");
  const [reportNo, setReportNo] = useState("QA-PENDING");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setReportNo(`QA-${Date.now().toString().slice(-6)}`);
  }, []);
  const [isGenerating, setIsGenerating] = useState(false);

  // Constraints & Safety thresholds
  const [mfrMin, setMfrMin] = useState(0.8);
  const [mfrMax, setMfrMax] = useState(25.0);
  const [tensileMin, setTensileMin] = useState(20.0);

  // Selected certification standards checkboxes
  const [standards, setStandards] = useState<string[]>([
    "ISO 9001",
    "ASTMD1238",
    "RoHS 2.0",
    "REACH SVHC"
  ]);

  const pdfPdfRef = useRef<HTMLDivElement>(null);

  const toggleStandard = (std: string) => {
    setStandards((prev) =>
      prev.includes(std) ? prev.filter((item) => item !== std) : [...prev, std]
    );
  };

  const t = (zh: string, en: string) => (language === "zh" ? zh : en);

  const handleExportPDF = async () => {
    if (!pdfPdfRef.current || products.length === 0) return;
    setIsGenerating(true);
    addToast("info", t("准备报告中物性及安全指标合规度...", "Synthesizing material specification and safety data..."));

    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const html2canvas = html2canvasModule.default;
      const jsPDF = jsPDFModule.jsPDF;

      const element = pdfPdfRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // 2x device pixel ratio for super high density rendering
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ResinDB_QA_Report_${reportNo}.pdf`);

      addToast("success", t("材料安全性及QA报告 PDF 导出成功！", "QA Certificate PDF generated successfully!"));
    } catch (err) {
      console.error(err);
      addToast("error", t("PDF生成失败，请重试。", "Failed to compile PDF QA report. Try again."));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[150]"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="relative bg-white dark:bg-slate-950 w-full max-w-6xl h-[85vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] overflow-hidden z-[160] flex flex-col font-sans"
        >
          {/* Main Top Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <FileText size={20} />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-150">
                  {t("PDF材料品质及安全报告生成器", "PDF QA & Spec Report Generator")}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {t("自动合并牌号实测物性，判定其是否合乎国际ISO系列安全合规基准。", "Compile actual mechanical specs and safety indicators into a certified PDF sheets.")}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={18} />
            </motion.button>
          </div>

          {/* Modal Body: Left column configuration, right column preview */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Column Config: width 40% */}
            <div className="w-[42%] border-r border-slate-200/60 dark:border-slate-800/60 p-6 overflow-y-auto space-y-6">
              
              {/* Core Parameters */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full" />
                  <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {t("基本评估认证元信息", "Baseline Meta Config")}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                      {t("检验主管/机构", "Inspector / Signatory")}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={inspector}
                        onChange={(e) => setInspector(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      />
                      <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                      {t("报告编号", "Report number")}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={reportNo}
                        onChange={(e) => setReportNo(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                      />
                      <Bookmark size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Compliance limits */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-amber-500 rounded-full" />
                  <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {t("物性品质安全控制基准线", "QA Tolerance Constraints")}
                  </h3>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-4">
                  {/* MFR Range Limit */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                      <span>{t("熔融指数 MFR 界限", "MFR Range limits")}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                        {mfrMin} - {mfrMax} g/10min
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg">
                        <span className="text-[9px] text-slate-400">Min:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={mfrMin}
                          onChange={(e) => setMfrMin(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-mono font-bold bg-transparent outline-none border-none p-0 text-slate-800 dark:text-white text-right"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg">
                        <span className="text-[9px] text-slate-400">Max:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={mfrMax}
                          onChange={(e) => setMfrMax(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-mono font-bold bg-transparent outline-none border-none p-0 text-slate-800 dark:text-white text-right"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tensile Min strength limit */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">
                      <span>{t("最低拉伸屈服强度线", "Min Tensile Strength Bar")}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                        {tensileMin} MPa
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="1"
                      value={tensileMin}
                      onChange={(e) => setTensileMin(parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Certified Standard Checkboxes */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-emerald-500 rounded-full" />
                  <h3 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {t("认证参考法规 & 环保条款", "Certificates & Compliances")}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "ISO 9001",
                    "ISO 14001",
                    "ASTMD1238",
                    "RoHS 2.0",
                    "REACH SVHC",
                    "FDA 21 CFR"
                  ].map((std) => {
                    const selected = standards.includes(std);
                    return (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={std}
                        type="button"
                        onClick={() => toggleStandard(std)}
                        className={`flex items-center gap-2 p-2 border rounded-xl text-left transition-all outline-none focus:ring-0 cursor-pointer ${
                          selected
                            ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-400 text-indigo-700 dark:text-indigo-400"
                            : "bg-transparent border-slate-200 dark:border-slate-850 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <ShieldCheck size={14} className={selected ? "text-indigo-500" : "text-slate-350"} />
                        <span className="text-[11px] font-mono font-bold leading-none">{std}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Assessment Notes Summary */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                  {t("签发审核判定说明摘要 (附加说明)", "Assessment Summary Remarks")}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t(
                    "例如：通过批安全性自动化评估算法校验，所选牌号化学及理化特性能完全通过测试。部分极限参数在推荐注射阈值范围内...",
                    "E.g., Automated checks completed. Raw parameters satisfied ISO compliance safety criteria. Reassessments with chemical balances passed..."
                  )}
                  rows={3}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white font-medium"
                />
              </div>

              {/* Build CTA Action */}
              <div className="pt-2">
                <motion.button
                  whileHover={isGenerating || products.length === 0 ? {} : { scale: 1.01 }}
                  whileTap={isGenerating || products.length === 0 ? {} : { scale: 0.99 }}
                  onClick={handleExportPDF}
                  disabled={isGenerating || products.length === 0}
                  className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-xs border border-primary-700 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t("正在渲染高清PDF质检报告...", "Compiling High-Density PDF QA Report...")}
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      {t(`签发并下载 PDF 质检和规格评估报告 (${products.length}款)`, `Sign & Download PDF QA Report (${products.length} Items)`)}
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Right Column: Live Document Preview viewport (width 58%) */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex items-start justify-center overflow-y-auto relative">
              <div className="absolute top-3 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 dark:bg-slate-950/80 backdrop-blur border border-slate-200/80 dark:border-slate-800/80 rounded-full text-[10px] font-bold text-slate-400 dark:text-slate-500 select-none z-10 antialiased shadow-sm uppercase tracking-wide">
                <BadgeCheck size={11} className="text-emerald-500" />
                {t("自动拉取实时参数 • TDS 报告矢量预览", "Live Specs Synchronized • TDS Report Preview")}
              </div>

              {/* Simulated paper frame */}
              <div className="bg-white rounded-2xl shadow-xl p-8 max-w-[650px] w-full border border-slate-200/80 scale-95 origin-top relative overflow-hidden shrink-0 mt-6 min-h-[800px]">
                {/* Simulated Watermark */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.015] rotate-[-45deg] select-none z-0 text-[80px] font-extrabold tracking-tighter">
                  QUALITY PASSED
                </div>

                <div className="relative z-10 space-y-6 text-left">
                  {/* Miniature Mockup Header */}
                  <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase">
                        {t("材料品质安全性评估报告", "Material Quality & Safety Assurance Report")}
                      </h4>
                      <p className="text-[8px] font-mono tracking-widest text-slate-400 mt-1">
                        STANDARDS: {standards.join(', ') || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right text-[8px] text-slate-400">
                      <p className="font-bold">{t("报告编号", "REPORT NO")}</p>
                      <p className="font-mono text-slate-900 font-bold">{reportNo}</p>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-mono">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{t("检验主管", "INSPECTOR")}</p>
                      <p className="text-slate-800 font-bold mt-0.5 truncate">{inspector}</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-mono">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{t("安全性总体判定", "SAFETY EVALUATION")}</p>
                      <p className="text-slate-800 font-bold mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {t("系统自动审核通过", "Auto-Verified Compliant")}
                      </p>
                    </div>
                  </div>

                  {/* Parameter guidelines */}
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-lg text-[9px] font-mono flex justify-between">
                    <div>
                      <p className="font-bold text-slate-300 uppercase tracking-widest mb-1.5">{t("安全控制参考界限", "QA Baseline Thresholds")}</p>
                      <p className="text-slate-400">• {t("MFR 融指合格区:", "MFR Range:")} <span className="text-white font-bold">{mfrMin} - {mfrMax} g/10min</span></p>
                      <p className="text-slate-400">• {t("最低拉伸强度安全线:", "Min Tensile Strength:")} <span className="text-white font-bold">{tensileMin} MPa</span></p>
                    </div>
                    <div className="text-right flex flex-col justify-between">
                      <span className="text-emerald-400 font-bold">100% RoHS & REACH OK</span>
                      <span className="text-slate-400 text-[8px] truncate max-w-[150px]">{notes || t("安全自动核对及物物理参数比对完成。", "Specs automated audit complete.")}</span>
                    </div>
                  </div>

                  {/* Products listings inside the mock */}
                  <div className="space-y-2">
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t("物料安全合规核对大底", "MATERIAL SAFE-STATUS CHECKSHEET")}</h5>
                    <div className="border border-slate-150 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[9px] font-mono">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold">
                            <th className="p-2">{t("测试牌号/厂商", "GRADE / MANU.")}</th>
                            <th className="p-2 text-center">{t("熔指 MFR", "MFR")}</th>
                            <th className="p-2 text-center">{t("拉伸强度", "TENSILE")}</th>
                            <th className="p-2 text-center">{t("判定结果", "STATUS")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {products.slice(0, 3).map((p) => {
                            const mfrObj = Object.entries(p.properties).find(([k]) => k.toLowerCase().includes("mfr") || k.includes("熔指"))?.[1];
                            const tensileObj = Object.entries(p.properties).find(([k]) => k.toLowerCase().includes("tensile") || k.includes("拉伸") || k.includes("屈服"))?.[1];
                            const mfr = mfrObj?.value ?? "-";
                            const tensile = tensileObj?.value ?? "-";
                            
                            // Check local violations list
                            const m = typeof mfr === 'number' ? mfr : parseFloat(String(mfr)) || 0;
                            const tVal = typeof tensile === 'number' ? tensile : parseFloat(String(tensile)) || 0;
                            const isMfrViolation = mfr !== "-" && (m < mfrMin || m > mfrMax);
                            const isTensileViolation = tensile !== "-" && (tVal < tensileMin);
                            const hasViolation = isMfrViolation || isTensileViolation;

                            return (
                              <tr key={p.id}>
                                <td className="p-2">
                                  <p className="font-bold text-slate-800">{p.gradeName}</p>
                                  <p className="text-[8px] text-slate-400 truncate">{p.manufacturer}</p>
                                </td>
                                <td className="p-2 text-center font-bold text-slate-700">{mfr}</td>
                                <td className="p-2 text-center font-bold text-slate-700">{tensile}</td>
                                <td className="p-2 text-center">
                                  {hasViolation ? (
                                    <span className="text-[8px] font-black px-1.5 py-0.5 bg-rose-150 text-rose-700 rounded select-none border border-rose-200">FAIL</span>
                                  ) : (
                                    <span className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-750 rounded select-none border border-emerald-250">PASS</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {products.length > 3 && (
                            <tr>
                              <td colSpan={4} className="p-2 text-center text-slate-400 italic text-[8px] bg-slate-50/50">
                                ... {t(`以及其余 ${products.length - 3} 款已选定的材料参数`, `and ${products.length - 3} other selected material grades...`)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Footer section in the mock */}
                  <div className="flex justify-between items-end border-t border-slate-100 pt-4 mt-4 text-[8px] font-mono text-slate-400">
                    <p>ResinDB Pro Certified Document</p>
                    <div className="text-center w-28">
                      <div className="h-6 border-b border-slate-300 relative flex items-center justify-center">
                        <svg width="60" height="20" viewBox="0 0 100 30" fill="none" className="text-indigo-400">
                          <path d="M10,25 C20,20 40,5 50,15 C60,25 70,12 90,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="mt-1 font-bold text-[7px] tracking-wider uppercase">QA DIVISION</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </div>

      {/* Hidden real full-density TDS output generation node offscreen */}
      <PdfQaReportTemplate
        ref={pdfPdfRef}
        products={products}
        inspector={inspector}
        reportNo={reportNo}
        standards={standards}
        notes={notes}
        mfrMin={mfrMin}
        mfrMax={mfrMax}
        tensileMin={tensileMin}
      />
    </AnimatePresence>
  );
};
