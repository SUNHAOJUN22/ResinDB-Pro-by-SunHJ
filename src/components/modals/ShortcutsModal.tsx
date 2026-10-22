import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Command,
  Download,
  Keyboard,
  Activity,
  Info,
  CheckCircle2,
  Search,
} from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const zh = language === "zh";
  const shortcuts = [
    { key: "/", label: zh ? "聚焦搜索框" : "Focus search", icon: Search },
    { key: "Ctrl + K", label: zh ? "打开命令中心" : "Open command center", icon: Command },
    { key: "Ctrl + I", label: zh ? "导入数据" : "Import data", icon: Download },
    { key: "Ctrl + E", label: zh ? "导出选中项" : "Export selected records", icon: Download },
    { key: "?", label: zh ? "显示快捷键" : "Show keyboard shortcuts", icon: Keyboard },
    { key: "ESC", label: zh ? "关闭弹窗/取消选择" : "Close dialog or clear selection", icon: X },
    { key: "↑ / ↓", label: zh ? "表格行导航" : "Navigate table rows", icon: Activity },
    { key: "Enter", label: zh ? "查看详情" : "View details", icon: Info },
    { key: "Space", label: zh ? "选择当前行" : "Select current row", icon: CheckCircle2 },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="shortcuts-modal-root"
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={onClose}
          ></motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 overflow-hidden rounded-[2.5rem] shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary-600 text-white border border-primary-700 rounded-xl shadow-sm">
                  <Keyboard size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-slate-800 dark:text-white tracking-tight">
                    {zh ? "键盘快捷键" : "Keyboard shortcuts"}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    {zh ? "常用操作与按键" : "Common actions and keys"}
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
                aria-label={zh ? "关闭快捷键" : "Close shortcuts"}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-sm transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 z-10 rounded-xl"
              >
                <X size={16} />
              </motion.button>
            </div>
            <div className="p-6 space-y-2 bg-white dark:bg-slate-950 overflow-y-auto max-h-[60vh] custom-scrollbar">
              {shortcuts.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{
                    x: 6,
                    backgroundColor: "rgba(248, 250, 252, 0.5)",
                    borderColor: "rgba(79, 70, 229, 0.4)",
                  }}
                  className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 group transition-all rounded-2xl shadow-sm hover:shadow-md cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-400 group-hover:text-primary-500 group-hover:border-primary-500/30 transition-all rounded-xl shadow-inner">
                      <s.icon size={15} />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.key
                      .split(s.key.includes("+") ? " + " : " / ")
                      .map((k, ki) => (
                        <React.Fragment key={ki}>
                          <kbd className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-500 dark:text-white shadow-sm rounded-lg min-w-[2.5rem] text-center border-b-[3px] active:border-b-0 active:translate-y-px transition-all">
                            {k}
                          </kbd>
                          {ki <
                            s.key.split(s.key.includes("+") ? " + " : " / ")
                              .length -
                              1 && (
                            <span className="text-[10px] text-slate-400 font-mono font-bold">
                              {s.key.includes("+") ? "+" : "/"}
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 flex justify-center">
              <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                ResinDB Pro v3.2.0
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
