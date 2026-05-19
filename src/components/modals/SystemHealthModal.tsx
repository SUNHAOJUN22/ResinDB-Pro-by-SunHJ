import { logger } from '@/lib/logger';
import React, { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Activity,
  Server,
  Database,
  RefreshCw,
  Sparkles,
  Download,
  Upload,
} from "lucide-react";

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  lastSync: string;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({
  isOpen,
  onClose,
  status,
  lastSync,
  addToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportConfig = () => {
    const configKeys = [
      "resindb-saved-views",
      "resindb-theme",
      "resindb-language",
      "resindb-compact",
      "resindb-users",
    ];
    const configData: Record<string, string | null> = {};

    configKeys.forEach((key) => {
      configData[key] = localStorage.getItem(key);
    });

    const blob = new Blob([JSON.stringify(configData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resindb-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file");
        
        const configData = JSON.parse(text);
        
        // Basic schema validation
        const allowedKeys = [
          "resindb-saved-views",
          "resindb-theme",
          "resindb-language",
          "resindb-compact",
          "resindb-users",
          "resindb-formulas",
          "resindb-tour-completed"
        ];

        let importCount = 0;
        Object.keys(configData).forEach((key) => {
          if (allowedKeys.includes(key) && configData[key] !== null) {
            // Further type checking could go here for critical items
            localStorage.setItem(key, configData[key]);
            importCount++;
          }
        });

        if (importCount === 0) {
          addToast("error", "未能识别出有效的系统配置项。");
          return;
        }

        addToast("success", `成功导入 ${importCount} 项系统配置！页面将立即刷新。`);
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        logger.error("Config import error:", err);
        addToast("error", "导入配置失败：文件格式不兼容或 JSON 已损坏。");
      }
    };
    reader.readAsText(file);
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="system-health-modal-root"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={onClose}
          ></motion.div>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="relative bg-white dark:bg-slate-950 w-full max-w-lg border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] rounded-[2.5rem] shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-2 bg-emerald-600 text-white border border-emerald-700 rounded-xl shadow-sm">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">
                    系统诊断与版本
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
                    System Health & Versioning
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
                className="p-2 bg-white/10 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-white border border-transparent hover:border-rose-300 dark:hover:border-rose-800 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 z-10 rounded-xl"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "Server",
                    value: "Asia-East1 (Active)",
                    icon: Server,
                    color: "primary",
                  },
                  {
                    label: "Database",
                    value: "ResinDB-v2 (Sync)",
                    icon: Database,
                    color: "emerald",
                  },
                  {
                    label: "Status",
                    value: status.toUpperCase(),
                    icon: RefreshCw,
                    color: status === "online" ? "emerald" : "amber",
                  },
                  {
                    label: "Last Sync",
                    value: lastSync,
                    icon: Activity,
                    color: "primary",
                  },
                ].map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{
                      y: -4,
                      boxShadow:
                        "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    }}
                    className={`p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group transition-all rounded-3xl cursor-default border-transparent hover:border-${item.color === "primary" ? "primary-500" : "emerald-500"}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`p-1.5 ${item.color === "primary" ? "bg-primary-100 dark:bg-primary-900/20 text-primary-500 border border-primary-200 dark:border-primary-800" : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-500 border border-emerald-200 dark:border-emerald-800"} rounded-lg`}
                      >
                        <item.icon size={14} />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-white tracking-tight">
                      {item.value}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-4 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent dark:via-emerald-500/5 animate-shimmer" />
                <div className="relative">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                </div>
                <div className="flex-1 relative z-10">
                  <p className="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300 tracking-tight">
                    所有系统运行正常
                  </p>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-500 font-mono uppercase tracking-widest mt-1">
                    延迟: 24ms | 吞吐量: 1.2GB/s
                  </p>
                </div>
                <RefreshCw
                  size={16}
                  className="text-emerald-400 animate-spin-slow relative z-10"
                />
              </motion.div>

              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-5 bg-slate-900 dark:bg-slate-950 border border-slate-800 text-white relative overflow-hidden rounded-3xl"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 -rotate-12">
                    <Sparkles size={60} />
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-[9px] font-mono uppercase tracking-widest mb-4 text-primary-400 flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary-500 rounded-full" />
                      版本说明 (v2.6.1-PRO)
                    </h4>
                    <div className="space-y-3">
                      {[
                        "引入智能牌号相似度推荐引擎",
                        "优化了大数据量下的 DataGrid 渲染性能",
                        "新增多维度雷达图对比分析功能",
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.1 }}
                          className="flex items-center gap-3 group/item cursor-default"
                        >
                          <div className="w-1.5 h-1.5 bg-primary-500 rounded-full transition-transform group-hover/item:scale-150 rotate-45" />
                          <p className="text-[11px] leading-relaxed text-slate-400 group-hover/item:text-slate-200 transition-colors font-mono">
                            {item}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between shrink-0">
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExportConfig}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-all rounded-xl shadow-sm flex items-center gap-2"
                  title="导出系统配置"
                >
                  <Download size={14} /> 导出配置
                </motion.button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".json"
                  onChange={handleImportConfig}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-all rounded-xl shadow-sm flex items-center gap-2"
                  title="导入系统配置"
                >
                  <Upload size={14} /> 导入配置
                </motion.button>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-10 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all rounded-xl shadow-lg"
              >
                确认
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
