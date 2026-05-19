import React from "react";
import { motion } from "motion/react";
import { GitCompare, Edit, Download, Trash2, X } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

interface BatchActionBarProps {
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  setIsComparisonOpen: (isOpen: boolean) => void;
  setIsBatchEditOpen: (isOpen: boolean) => void;
  handleExport: () => void;
  handleDelete: (ids: string[]) => void;
  addToast: (
    type: "info" | "success" | "warning" | "error",
    message: string,
  ) => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedIds,
  setSelectedIds,
  setIsComparisonOpen,
  setIsBatchEditOpen,
  handleExport,
  handleDelete,
  addToast,
}) => {
  const { t } = useLanguage();

  if (selectedIds.size === 0) return null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      exit={{ y: 80, opacity: 0, x: "-50%" }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
      layout
      className="fixed bottom-6 left-1/2 z-[100] pointer-events-none w-full max-w-fit px-4"
    >
      <div className="pointer-events-auto bg-slate-950/90 dark:bg-white/95 backdrop-blur-3xl px-6 py-4 rounded-[2.5rem] border border-white/10 dark:border-slate-200/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] flex items-center justify-center gap-8 ring-1 ring-white/5 dark:ring-slate-950/5">
        <div className="flex items-center gap-4 pr-8 border-r border-white/10 dark:border-slate-200">
          <div className="relative group/count">
            <motion.div
              key={selectedIds.size}
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 bg-primary-600 dark:bg-primary-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-[0_0_20px_rgba(var(--color-primary-600-rgb),0.4)] transition-transform cursor-pointer"
            >
              {selectedIds.size}
            </motion.div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 dark:border-white animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white dark:text-slate-950 uppercase tracking-[0.2em]">
              {t("selected")}
            </p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.1em] mt-0.5">
              {t("recordsSelected")}
            </p>
          </div>
        </div>

        <motion.div layout className="flex items-center gap-6">
          {[
            {
              icon: GitCompare,
              label: t("compareAnalysis"),
              color: "emerald",
              onClick: () => {
                if (selectedIds.size < 2) {
                  addToast("info", t("selectTwoToCompare"));
                  return;
                }
                setIsComparisonOpen(true);
              },
            },
            {
              icon: Edit,
              label: t("batchEdit"),
              color: "amber",
              onClick: () => setIsBatchEditOpen(true),
            },
            {
              icon: Download,
              label: t("generateReport"),
              color: "primary",
              onClick: handleExport,
            },
            {
              icon: Trash2,
              label: t("delete"),
              color: "rose",
              onClick: () => handleDelete(Array.from(selectedIds)),
            },
          ].map((action, idx) => (
            <motion.button
              key={idx}
              layout
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={action.onClick}
              className="flex flex-col items-center gap-1.5 group focus:outline-none focus:ring-0"
            >
              <div
                className={`p-3.5 bg-white/5 dark:bg-slate-100 rounded-[1.25rem] text-white dark:text-slate-700 transition-all ${
                  action.color === "emerald"
                    ? "group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    : action.color === "amber"
                      ? "group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                      : action.color === "rose"
                        ? "group-hover:bg-rose-600 group-hover:text-white group-hover:shadow-[0_0_15px_rgba(225,29,72,0.4)]"
                        : "group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-[0_0_15px_rgba(var(--color-primary-600-rgb),0.4)]"
                }`}
              >
                <action.icon size={20} strokeWidth={2.5} />
              </div>
              <span className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                {action.label}
              </span>
            </motion.button>
          ))}
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setSelectedIds(new Set())}
          className="ml-4 p-2 text-slate-500 hover:text-rose-500 transition-colors rounded-xl hover:bg-white/5 dark:hover:bg-slate-100"
          title="Clear selection"
        >
          <X size={16} strokeWidth={3} />
        </motion.button>
      </div>
    </motion.div>
  );
};
