import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, HelpCircle } from "lucide-react";

import { useLanguage } from "../contexts/LanguageContext";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="help-modal-root"
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
            className="relative bg-white dark:bg-slate-950 w-full max-w-2xl border border-slate-300 dark:border-slate-700 overflow-hidden flex flex-col rounded-[2.5rem] shadow-2xl"
          >
            <div className="px-6 py-5 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-serif text-slate-800 dark:text-white tracking-tight">
                    帮助中心
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    Knowledge Base & Guides
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 z-10 rounded-xl"
              >
                <X size={16} />
              </motion.button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
              <div className="space-y-4">
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest ml-1">
                  {t("gettingStarted") || "快速入门"}
                </h4>
                {[
                  {
                    title: "如何导入数据?",
                    desc: "支持 Excel, CSV, JSON 格式",
                  },
                  {
                    title: "搜索语法指南",
                    desc: "使用属性过滤 and 关键词搜索",
                  },
                  { title: "批量编辑技巧", desc: "一次性更新多条记录" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{
                      scale: 1.02,
                      x: 8,
                      borderColor: "rgba(79, 70, 229, 0.4)",
                    }}
                    whileTap={{ scale: 0.98 }}
                    className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer group rounded-2xl shadow-sm hover:shadow-md"
                  >
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tight">
                      {item.title}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest ml-1">
                  {t("advancedFeatures") || "进阶功能"}
                </h4>
                {[
                  { title: "雷达图对比", desc: "多维度性能可视化分析" },
                  { title: "导出专业报告", desc: "生成 PDF and Excel 报表" },
                  { title: "管理权限设置", desc: "RBAC 角色访问控制" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    whileHover={{
                      scale: 1.02,
                      x: 8,
                      borderColor: "rgba(79, 70, 229, 0.4)",
                    }}
                    whileTap={{ scale: 0.98 }}
                    className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer group rounded-2xl shadow-sm hover:shadow-md"
                  >
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tight">
                      {item.title}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between">
              <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                需要更多帮助? 联系技术支持
              </p>
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: "#000" }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-8 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono font-bold text-[10px] uppercase tracking-widest transition-all rounded-xl shadow-lg"
              >
                关闭
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HelpModal;
