import React, { useState } from "react";
import {
  X,
  Save,
  Plus,
  Trash2,
  Factory,
  Loader2,
  Settings2,
  Thermometer,
  FileText,
  Layers,
  Sparkles,
} from "lucide-react";
import { Product, PropertyValue } from "../types";
import { useLanguage } from "../contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import { aiService } from "../services/aiService";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Partial<Product>) => Promise<void> | void;
}

interface PropertyRow {
  id: string;
  key: string;
  value: string;
  unit: string;
  standard: string;
  instrument: string;
  temperature: string;
  referenceId: string;
  sourceUrl: string;
  isExpanded: boolean;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<Partial<Product>>({
    gradeName: "",
    manufacturer: "",
    categoryIds: [],
  });
  const [propertyRows, setPropertyRows] = useState<PropertyRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleAiFill = async () => {
    if (!formData.gradeName || isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const generated = await aiService.generateProductProperties(
        formData.gradeName,
        formData.manufacturer || ""
      );

      const newRows: PropertyRow[] = Object.entries(generated).map(([key, val]) => ({
        id: `ai-${Date.now()}-${key}`,
        key,
        value: String(val.value),
        unit: val.unit || "",
        standard: val.standard || "",
        instrument: val.instrument || "",
        temperature: val.temperature || "",
        referenceId: val.referenceId || "",
        sourceUrl: val.sourceUrl || "",
        isExpanded: false,
      }));

      setPropertyRows(prev => [...newRows, ...prev]);
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (isSaving || !formData.gradeName) return;
    setIsSaving(true);

    const newProperties: Record<string, PropertyValue> = {};
    propertyRows.forEach((row) => {
      if (row.key.trim()) {
        const numVal = Number(row.value);
        newProperties[row.key] = {
          value: !isNaN(numVal) && row.value.trim() !== "" ? numVal : row.value,
          unit: row.unit.trim() || undefined,
          standard: row.standard.trim() || undefined,
          instrument: row.instrument.trim() || undefined,
          temperature: row.temperature.trim() || undefined,
          referenceId: row.referenceId.trim() || undefined,
          sourceUrl: row.sourceUrl.trim() || undefined,
        };
      }
    });

    const newProduct: Partial<Product> = {
      ...formData,
      properties: newProperties,
    };

    try {
      await onSave(newProduct);
      onClose();
      // Reset form
      setFormData({ gradeName: "", manufacturer: "", categoryIds: [] });
      setPropertyRows([]);
    } catch {
      // Error handling in parent
    } finally {
      setIsSaving(false);
    }
  };

  const addRow = () => {
    setPropertyRows([
      ...propertyRows,
      {
        id: `new-${Date.now()}`,
        key: "",
        value: "",
        unit: "",
        standard: "",
        instrument: "",
        temperature: "",
        referenceId: "",
        sourceUrl: "",
        isExpanded: true,
      },
    ]);
  };

  const removeRow = (id: string) => {
    setPropertyRows(propertyRows.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof PropertyRow, val: string | boolean) => {
    setPropertyRows(
      propertyRows.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  const toggleExpand = (id: string) => {
    setPropertyRows(
      propertyRows.map((r) =>
        r.id === id ? { ...r, isExpanded: !r.isExpanded } : r,
      ),
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="add-product-modal-root"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            key="add-product-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          ></motion.div>
          <motion.div
            key="add-product-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 flex flex-col max-h-[90vh] shadow-2xl rounded-[2.5rem] overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between bg-slate-900 dark:bg-slate-950 relative overflow-hidden shrink-0">
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-emerald-600 text-white border border-emerald-700 rounded-xl shadow-inner">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-white tracking-tight leading-none mb-1">
                    {t("addProduct", "Add New Product")}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest truncate">
                    Material Specification Creator
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
                className="p-2 bg-white/5 backdrop-blur-md border border-white/10 text-slate-400 rounded-xl transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 z-10"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 bg-white dark:bg-slate-950">
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">
                  <Settings2 size={14} className="text-primary-500" />{" "}
                  {t("basicInfo")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest ml-1">
                      {t("gradeName")}
                    </label>
                    <div className="relative">
                      <motion.input
                        type="text"
                        whileFocus={{
                          scale: 1.01,
                          boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.1)",
                        }}
                        placeholder="e.g. Resin Pro 500"
                        value={formData.gradeName || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, gradeName: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold outline-none transition-all focus:border-primary-500 text-slate-800 dark:text-white pr-24"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleAiFill}
                          disabled={!formData.gradeName || isAiGenerating}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[8px] font-mono font-black uppercase tracking-tighter rounded-lg shadow-sm disabled:opacity-50"
                        >
                          {isAiGenerating ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Sparkles size={10} />
                          )}
                          {t("aiSmartFill", "Smart Fill")}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest ml-1">
                      {t("manufacturer")}
                    </label>
                    <div className="relative">
                      <Factory
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <motion.input
                        type="text"
                        whileFocus={{
                          scale: 1.01,
                          boxShadow: "0 0 0 4px rgba(79, 70, 229, 0.1)",
                        }}
                        placeholder="e.g. Material Corp"
                        value={formData.manufacturer || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            manufacturer: e.target.value,
                          })
                        }
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold outline-none transition-all focus:border-primary-500 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    <Layers size={14} className="text-primary-500" />{" "}
                    {t("properties")}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={addRow}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-sm rounded-xl"
                  >
                    <Plus size={14} /> {t("addProperty")}
                  </motion.button>
                </div>

                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.05
                      }
                    }
                  }}
                  className="space-y-3"
                >
                  <AnimatePresence mode="popLayout">
                    {propertyRows.map((row) => (
                      <motion.div
                        key={row.id}
                        layout
                        variants={{
                          hidden: { opacity: 0, x: -20, scale: 0.95 },
                          visible: { opacity: 1, x: 0, scale: 1 }
                        }}
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        className={`bg-slate-50 dark:bg-slate-900 border transition-all duration-300 overflow-hidden ${row.isExpanded ? "border-primary-500 ring-1 ring-primary-500/20 shadow-lg shadow-primary-500/5" : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 shadow-sm"}`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <motion.input
                              type="text"
                              placeholder={t("propertyName")}
                              value={row.key || ""}
                              onChange={(e) =>
                                updateRow(row.id, "key", e.target.value)
                              }
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-800 dark:text-white rounded-lg"
                            />
                            <motion.input
                              type="text"
                              placeholder={t("propertyValue")}
                              value={row.value || ""}
                              onChange={(e) =>
                                updateRow(row.id, "value", e.target.value)
                              }
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-bold text-primary-600 dark:text-primary-400 rounded-lg"
                            />
                            <motion.input
                              type="text"
                              placeholder={t("unit")}
                              value={row.unit || ""}
                              onChange={(e) =>
                                updateRow(row.id, "unit", e.target.value)
                              }
                              className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-500 rounded-lg"
                            />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => toggleExpand(row.id)}
                              className={`p-1.5 border rounded-lg ${row.isExpanded ? "bg-primary-600 border-primary-600 text-white" : "text-slate-400 hover:text-slate-600 bg-white dark:bg-slate-950 shadow-sm"}`}
                            >
                              <Settings2 size={14} />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1, color: "#f43f5e" }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => removeRow(row.id)}
                              className="p-1.5 text-slate-400 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                            >
                              <Trash2 size={14} />
                            </motion.button>
                          </div>
                        </div>

                        {row.isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
                             <div className="space-y-1">
                                <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><FileText size={10} /> {t("standard")}</label>
                                <input type="text" value={row.standard || ""} onChange={e => updateRow(row.id, "standard", e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-bold rounded-lg" />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Thermometer size={10} /> {t("testConditions")}</label>
                                <input type="text" value={row.temperature || ""} onChange={e => updateRow(row.id, "temperature", e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-bold rounded-lg" />
                             </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex justify-end items-center gap-3 shrink-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-6 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 rounded-xl"
              >
                {t("cancel")}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                disabled={isSaving || !formData.gradeName}
                className="flex items-center gap-2 px-8 py-2 bg-emerald-600 text-white font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50 shadow-md rounded-xl"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {t("createProduct", "Create Product")}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
