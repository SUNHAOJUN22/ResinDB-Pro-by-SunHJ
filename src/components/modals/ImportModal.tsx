import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Database,
  Filter,
  Clipboard,
  FileText,
  FileJson,
  Image as ImageIcon,
  Trash2,
  FileDown,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Product } from '@/types/index';
import { motion, AnimatePresence } from "motion/react";
import { logger } from "@/lib/logger";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (products: Product[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = React.memo(({
  isOpen,
  onClose,
  onImport,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep(1);
        setStagedFiles([]);
        setImportErrors([]);
        setParsedProducts([]);
      }, 300);
    }
  }, [isOpen]);

  // Non-blocking CSV Parser with proper quoted field support
  const parseCSV = async (
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<Product[]> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const products: Product[] = [];

    // Helper to parse a single CSV line into an array of strings
    const parseCSVLine = (line: string) => {
      const result = [];
      let currentField = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          result.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      result.push(currentField.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
    const gradeIdx = headers.findIndex(
      (h) => h.includes("grade") || h.includes("牌号"),
    );
    const manIdx = headers.findIndex(
      (h) => h.includes("manufacturer") || h.includes("厂家"),
    );

    if (gradeIdx === -1) {
      throw new Error("Missing required column: Grade/牌号");
    }

    const totalLines = lines.length;
    const chunkSize = 200; // Smaller chunks for more responsiveness

    for (let startIndex = 1; startIndex < totalLines; startIndex += chunkSize) {
      // Yield to main thread to keep UI responsive
      await new Promise((resolve) => setTimeout(resolve, 0));
      onProgress(Math.floor((startIndex / totalLines) * 100));

      const endChunk = Math.min(startIndex + chunkSize, totalLines);
      for (let i = startIndex; i < endChunk; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = parseCSVLine(line);
        if (cols.length < 1 || !cols[gradeIdx]) continue;

        const now = new Date().toISOString().split("T")[0];
        const newProduct: Product = {
          id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          gradeName: cols[gradeIdx] || "Unknown Grade",
          manufacturer: manIdx > -1 && cols[manIdx] ? cols[manIdx] : "Imported",
          manufacturerId: "m-import",
          categoryIds: ["root_plastic"],
          createdAt: now,
          updatedAt: now,
          properties: {},
        };

        headers.forEach((h, idx) => {
          if (idx !== gradeIdx && idx !== manIdx && cols[idx]) {
            let key = h;
            // Common mapping
            if (h.includes("density") || h.includes("密度")) key = "密度";
            else if (h.includes("mfr") || h.includes("熔体")) key = "熔体质量流动速率";
            else if (h.includes("tensile") || h.includes("拉伸")) key = "拉伸屈服应力";
            else if (h.includes("modulus") || h.includes("模量")) key = "弯曲模量";
            else if (h.includes("impact") || h.includes("冲击")) key = "悬臂梁缺口冲击强度";

            const val = parseFloat(cols[idx]);
            newProduct.properties[key] = {
              value: isNaN(val) ? cols[idx] : val,
              unit: "",
            };
          }
        });
        products.push(newProduct);
      }
    }
    onProgress(100);
    return products;
  };

  const [importProgress, setImportProgress] = useState(0);

  const processFiles = async () => {
    setStep(2);
    setImportErrors([]);
    setImportProgress(0);
    const allNewProducts: Product[] = [];
    const errors: string[] = [];

    for (const file of stagedFiles) {
      try {
        if (file.name.endsWith(".csv") || file.type.includes("csv")) {
          const items = await parseCSV(file, setImportProgress);
          allNewProducts.push(...items);
        } else {
          // Mock generation for non-CSV files for demo
          allNewProducts.push({
            id: `mock-${Date.now()}`,
            gradeName: `Imported-${file.name.substring(0, 5)}`,
            manufacturer: "Imported Data",
            manufacturerId: "m-import",
            categoryIds: ["root_plastic"],
            createdAt: new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0],
            properties: {
              密度: { value: 0.95 + Math.random() * 0.05, unit: "g/cm³" },
              熔体质量流动速率: { value: Math.random() * 5, unit: "g/10min" },
            },
          });
        }
      } catch (e: unknown) {
        logger.error("Parse error", e);
        errors.push(
          `文件 ${file.name} 解析失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (errors.length > 0) {
      setImportErrors(errors);
    }

    // Simulate processing delay for UX
    setTimeout(() => {
      setParsedProducts(allNewProducts);
      if (allNewProducts.length > 0) {
        setStep(3);
      } else {
        setStep(1); // Go back if nothing parsed
      }
    }, 1500);
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files);
    setStagedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  // ... (Keep existing drag/drop logic: useEffect handlePaste, addFiles, removeFiles etc.)
  // Re-implementing them briefly for context as I am replacing the whole file content
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const items = e.clipboardData?.items;
      if (!items) return;
      const newFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) newFiles.push(file);
        }
      }
      if (newFiles.length > 0) addFiles(newFiles);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, addFiles]);

  const removeFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };
  const getFileIcon = (file: File) => {
    if (file.type.includes("image"))
      return <ImageIcon size={18} className="text-purple-500" />;
    if (file.type.includes("json"))
      return <FileJson size={18} className="text-amber-500" />;
    if (file.name.includes("csv"))
      return <FileSpreadsheet size={18} className="text-emerald-500" />;
    return <FileText size={18} className="text-blue-500" />;
  };
  const handleDownloadTemplate = () => {
    const csvContent =
      "Grade Name, Manufacturer, Density, MFR, Tensile Strength\nHDPE-Demo, Sinopec, 0.95, 0.8, 24";
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "resindb_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="import-modal-root"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          ></motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="relative w-full max-w-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 flex flex-col max-h-[95vh] shadow-2xl rounded-2xl md:rounded-[2.5rem] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 relative overflow-hidden shrink-0">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-2 bg-primary-600 text-white border border-primary-700 rounded-xl shadow-inner">
                  <Database size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className="text-sm font-serif font-bold text-white leading-none tracking-tight mb-1 truncate"
                    title={t("importTitle")}
                  >
                    {t("importTitle")}
                  </h3>
                  <p
                    className="text-[10px] text-slate-400 font-mono uppercase tracking-widest truncate"
                    title={t("dataIngestion")}
                  >
                    {t("dataIngestion")}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{
                  scale: 1.1,
                  backgroundColor: "rgba(225, 29, 72, 1)",
                }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 bg-white/10 backdrop-blur-md border border-white/20 text-white transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 z-10 rounded-xl"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Step Indicator */}
            <div className="px-4 md:px-6 py-3 md:py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 md:gap-3 shrink-0">
              {[1, 2, 3, 4].map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 font-mono font-bold text-[9px] md:text-[10px] transition-all duration-300 border ${step >= s ? "bg-primary-600 text-white border-primary-600 shadow-sm scale-110" : "bg-white dark:bg-slate-950 text-slate-400 border-slate-300 dark:border-slate-700"}`}
                  >
                    {step > s ? (
                      <CheckCircle size={12} className="md:size-[14px]" />
                    ) : (
                      s
                    )}
                  </div>
                  {s < 4 && (
                    <div
                      className={`h-px w-6 md:w-8 transition-all duration-500 ${step > s ? "bg-primary-500" : "bg-slate-300 dark:border-slate-700"}`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-950">
              {step === 1 && (
                <div className="space-y-6">
                  {importErrors.length > 0 && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 space-y-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-mono font-bold text-[10px] uppercase tracking-widest">
                        <AlertCircle size={14} />
                        <span>解析过程中出现错误:</span>
                      </div>
                      <ul className="text-[10px] font-mono text-rose-500 dark:text-rose-400/80 list-disc list-inside space-y-1">
                        {importErrors.map((err, i) => (
                          <li key={i} className="truncate" title={err}>
                            {err}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Drag & Drop Zone */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className={`
                        relative group border-2 border-dashed p-8 md:p-12 flex flex-col items-center justify-center text-center transition-all duration-500 cursor-pointer overflow-hidden rounded-xl md:rounded-[2rem]
                        ${
                          isDragging
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10 scale-[0.98]"
                            : "border-slate-300 dark:border-slate-700 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 bg-white dark:bg-slate-950 shadow-sm"
                        }
                    `}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      addFiles(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      accept=".csv,.xlsx,.json,.txt,image/*"
                      onChange={(e) => {
                        if (e.target.files) addFiles(e.target.files);
                      }}
                    />

                    <div
                      className={`w-16 h-16 flex items-center justify-center mb-6 transition-all duration-500 border ${isDragging ? "bg-primary-600 text-white border-primary-600 rotate-12 scale-110 shadow-xl" : "bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-300 dark:border-slate-700 group-hover:text-primary-500 group-hover:scale-110 group-hover:rotate-3"}`}
                    >
                      <UploadCloud size={32} strokeWidth={1.5} />
                    </div>

                    <div className="space-y-2 relative z-10">
                      <h4 className="text-slate-900 dark:text-white font-serif font-bold text-lg tracking-tight">
                        {t("dragDrop")}{" "}
                        <span className="text-primary-600 dark:text-primary-400">
                          {t("browseFiles")}
                        </span>
                      </h4>
                      <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <Clipboard size={12} /> Ctrl+V to Paste
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          .CSV, .XLSX, .JSON
                        </span>
                      </div>
                    </div>
                  </motion.div>
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl">
                    <div className="p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-primary-600 dark:text-primary-400 shrink-0 rounded-lg">
                      <FileDown size={18} />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2">
                        <h4 className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                          {t("downloadTemplate")}
                        </h4>
                        <motion.button
                          whileHover={{ scale: 1.05, x: 2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleDownloadTemplate}
                          className="text-[10px] font-mono font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline uppercase tracking-widest focus:outline-none transition-all px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30"
                        >
                          Download .CSV
                        </motion.button>
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {t("templateDesc")}
                      </p>
                    </div>
                  </div>

                  {stagedFiles.length > 0 && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2 fade-in">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest px-1">
                        <span>
                          {t("readyToImport")} ({stagedFiles.length})
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05, color: "#f43f5e" }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setStagedFiles([])}
                          className="text-rose-500 hover:text-rose-600 hover:underline focus:outline-none transition-all px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        >
                          Clear All
                        </motion.button>
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {stagedFiles.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                          >
                            <div className="p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700">
                              {getFileIcon(file)}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate">
                                {file.name}
                              </p>
                              <p className="text-[9px] text-slate-400 font-mono uppercase">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <motion.button
                              whileHover={{
                                scale: 1.1,
                                backgroundColor: "rgba(244, 63, 94, 0.1)",
                                color: "#f43f5e",
                              }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(idx);
                              }}
                              className="p-1.5 text-slate-400 transition-all border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm"
                            >
                              <Trash2 size={14} />
                            </motion.button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={processFiles}
                      disabled={stagedFiles.length === 0}
                      className={`w-full py-3.5 font-mono font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.98] focus:outline-none ${stagedFiles.length > 0 ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-lg" : "bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-300 dark:border-slate-700 cursor-not-allowed"}`}
                    >
                      {stagedFiles.length > 0 ? (
                        <>
                          <Database size={14} /> Parse {stagedFiles.length}{" "}
                          Files
                        </>
                      ) : (
                        t("dragDropDesc")
                      )}
                    </motion.button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col items-center justify-center py-12 w-full max-w-xs mx-auto">
                  <div className="relative w-16 h-16 border-2 border-slate-200 dark:border-slate-800 border-t-primary-600 animate-spin mb-8 rounded-full"></div>
                  <h4 className="text-slate-900 dark:text-slate-100 font-mono font-bold text-xs uppercase tracking-widest animate-pulse">
                    {t("processing")}
                  </h4>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div
                      className="bg-primary-600 h-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 mt-2 uppercase tracking-widest">
                    {importProgress}% {t("parsingFiles")}
                  </p>
                </div>
              )}

              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                      <Filter size={14} className="text-primary-500" /> Parsed
                      Data Preview
                    </h4>
                    <span className="text-[10px] font-mono font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 border border-primary-200 dark:border-primary-800 px-2 py-0.5">
                      {parsedProducts.length} Items
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    {parsedProducts.slice(0, 10).map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-800 last:border-0 gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate"
                            title={p.gradeName}
                          >
                            {p.gradeName}
                          </div>
                          <div
                            className="text-[10px] font-mono text-slate-500 truncate"
                            title={p.manufacturer}
                          >
                            {p.manufacturer}
                          </div>
                        </div>
                        <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-2 py-1 shrink-0 whitespace-nowrap">
                          {Object.keys(p.properties).length} props
                        </div>
                      </div>
                    ))}
                    {parsedProducts.length > 10 && (
                      <div className="p-3 text-center text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                        ...and {parsedProducts.length - 10} more
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStep(4)}
                      className="w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-mono font-bold text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] focus:outline-none"
                    >
                      <CheckCircle size={14} /> {t("confirmMerge")}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center justify-center py-6 text-center"
                >
                  <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-6 shadow-sm">
                    <CheckCircle className="text-emerald-600 w-10 h-10" />
                  </div>
                  <h4 className="text-slate-900 dark:text-white font-serif font-bold text-2xl mb-2 tracking-tight">
                    {t("success")}
                  </h4>
                  <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-8">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {parsedProducts.length} {t("recordsProcessed")}
                    </span>
                  </p>
                  <div className="flex gap-3 w-full">
                    <motion.button
                      whileHover={{
                        scale: 1.02,
                        backgroundColor: "#4f46e5",
                        boxShadow:
                          "0 20px 25px -5px rgba(79, 70, 229, 0.4), 0 10px 10px -5px rgba(79, 70, 229, 0.1)",
                      }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (onImport) onImport(parsedProducts);
                        onClose();
                      }}
                      className="flex-1 px-4 py-4 bg-primary-600 text-white font-mono font-bold text-[11px] uppercase tracking-widest shadow-xl transition-all focus:outline-none rounded-[2rem] border border-primary-500 shadow-primary-500/20"
                    >
                      {t("finish")}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
