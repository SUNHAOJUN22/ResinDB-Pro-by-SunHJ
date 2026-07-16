import { logger } from '@/lib/logger';
import React, { useRef, useState, useEffect } from "react";
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
import { useData } from "@/contexts/DataContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { safeStorage } from "@/lib/utils";

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
  const { refreshData, isRefreshing, syncEvents } = useData();
  const { t } = useLanguage();
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRefreshing) {
      setSyncProgress(0);
      interval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);
    } else {
      setSyncProgress(prev => {
        if (prev > 0) {
          setTimeout(() => setSyncProgress(0), 1000);
          return 100;
        }
        return prev;
      });
    }
    return () => clearInterval(interval);
  }, [isRefreshing]);

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
      configData[key] = safeStorage.local.getItem(key);
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
            safeStorage.local.setItem(key, configData[key]);
            importCount++;
          }
        });

        if (importCount === 0) {
          addToast("error", t("sysHealthImportEmptyError"));
          return;
        }

        addToast("success", t("sysHealthImportSuccess"));
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        logger.error("Config import error:", err);
        addToast("error", t("sysHealthImportError"));
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
                    {t("sysHealthTitle")}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
                    {t("sysHealthSubtitle")}
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
                className={`p-4 ${isRefreshing ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'} border rounded-2xl flex flex-col gap-3 relative overflow-hidden transition-colors`}
              >
                {!isRefreshing && <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent dark:via-emerald-500/5 animate-shimmer" />}
                
                <div className="flex items-center gap-4 relative z-10 w-full">
                  <div className="relative">
                    <div className={`w-3 h-3 ${isRefreshing ? 'bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'} rounded-full animate-pulse`}></div>
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-mono font-bold ${isRefreshing ? 'text-primary-900 dark:text-primary-300' : 'text-emerald-900 dark:text-emerald-300'} tracking-tight`}>
                      {isRefreshing ? t("sysHealthSyncing") : t("sysHealthAllNormal")}
                    </p>
                    <p className={`text-[9px] ${isRefreshing ? 'text-primary-600 dark:text-primary-500' : 'text-emerald-600 dark:text-emerald-500'} font-mono uppercase tracking-widest mt-1`}>
                      {t("sysHealthLatency")}
                    </p>
                  </div>
                  <motion.button
                    whileHover={isRefreshing ? {} : { scale: 1.05 }}
                    whileTap={isRefreshing ? {} : { scale: 0.95 }}
                    onClick={refreshData}
                    disabled={isRefreshing}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-widest uppercase transition-all cursor-pointer disabled:cursor-not-allowed ${
                      isRefreshing
                        ? 'bg-primary-100 text-primary-500 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 shadow-sm'
                    }`}
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                    {isRefreshing ? t("syncing") : t("syncNow")}
                  </motion.button>
                </div>

                {/* Progress Bar Container */}
                <AnimatePresence>
                  {(isRefreshing || syncProgress > 0) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: 4 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      className="w-full relative z-10"
                    >
                       <div className="flex items-center justify-between text-[10px] font-mono text-primary-600 dark:text-primary-400 mb-1.5 font-bold uppercase tracking-widest">
                         <span>Database Synchronization Base Node</span>
                         <span>{Math.round(syncProgress)}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-primary-200 dark:bg-primary-900/40 rounded-full overflow-hidden shrink-0">
                         <motion.div 
                           className="h-full bg-primary-500" 
                           animate={{ width: `${syncProgress}%` }}
                           transition={{ ease: "easeInOut" }}
                         />
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Recent Sync Events */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={12} />
                    {t("sysHealthSyncLog")}
                  </h4>
                  <span className="text-[9px] font-mono text-slate-400">
                    {syncEvents.length} {t("syncLogsCount")}
                  </span>
                </div>
                <div className="p-1 max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                  {syncEvents.length === 0 ? (
                    <div className="text-center p-4 text-[10px] font-mono text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      {t("sysHealthNoEvents")}
                    </div>
                  ) : (
                    syncEvents.map((event) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={event.id}
                        className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      >
                        <div className={`mt-0.5 w-1.5 h-1.5 rounded-full ${event.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-mono leading-relaxed truncate ${event.status === 'success' ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600 dark:text-rose-400'}`}>
                            {event.message}
                          </p>
                          <p className="text-[9px] font-mono text-slate-400 mt-1">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-md ${event.status === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                          {event.status}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

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
                      {t("sysHealthReleaseNotes")} (v3.1.0-PRO)
                    </h4>
                    <div className="space-y-3">
                      {[
                        t("sysHealthReleaseNote1"),
                        t("sysHealthReleaseNote2"),
                        t("sysHealthReleaseNote3"),
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
                  title={t("sysHealthExport")}
                >
                  <Download size={14} /> {t("sysHealthExport")}
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
                  title={t("sysHealthImport")}
                >
                  <Upload size={14} /> {t("sysHealthImport")}
                </motion.button>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-10 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all rounded-xl shadow-lg"
              >
                {t("sysHealthConfirm")}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// v3.1.0-sync

// v3.1.0-sync-fixed
