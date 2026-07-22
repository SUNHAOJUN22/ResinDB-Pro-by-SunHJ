import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquare, Loader2, Send } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [type, setType] = useState<"bug" | "feature" | "other">("bug");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsSubmitting(false);
    setIsSubmitted(true);
    setTimeout(() => {
      onClose();
      setTimeout(() => setIsSubmitted(false), 500);
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="feedback-modal-root"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <motion.div
            key="feedback-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={onClose}
          ></motion.div>
          <motion.div
            key="feedback-modal-content"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="relative bg-white dark:bg-slate-950 w-full max-w-lg border border-slate-300 dark:border-slate-700 overflow-hidden rounded-[2.5rem] shadow-2xl min-h-[400px] flex flex-col"
          >
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col h-full"
                >
                  <div className="px-6 py-4 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-xl shadow-inner">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-serif font-bold text-slate-800 dark:text-white tracking-tight">
                          发送反馈
                        </h3>
                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
                          Help us improve the platform
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
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 shadow-sm transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 z-10 rounded-xl"
                    >
                      <X size={16} />
                    </motion.button>
                  </div>
                  <div className="p-6 space-y-6 bg-white dark:bg-slate-950 flex-1">
                    <div className="flex gap-2">
                      {(["bug", "feature", "other"] as const).map((t) => (
                        <motion.button
                          key={t}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setType(t)}
                          className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest transition-all border rounded-xl shadow-sm ${type === t ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-slate-950 text-slate-500 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"}`}
                        >
                          {t === "bug"
                            ? "缺陷报告"
                            : t === "feature"
                              ? "功能建议"
                              : "其他反馈"}
                        </motion.button>
                      ))}
                    </div>
                    <div className="relative group">
                      <motion.textarea
                        whileFocus={{
                          scale: 1.005,
                          backgroundColor: "rgba(255, 255, 255, 1)",
                        }}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="请描述您遇到的问题或建议..."
                        className="w-full h-48 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all resize-none rounded-2xl group-hover:border-slate-300 dark:group-hover:border-slate-700 shadow-inner"
                      />
                      <div className="absolute bottom-3 right-4 text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                        {message.length} CHARS
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 flex justify-end gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onClose}
                      className="px-6 py-2 text-slate-500 font-mono text-[10px] uppercase tracking-widest hover:text-slate-800 dark:hover:text-slate-200 transition-all rounded-xl"
                    >
                      取消
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmit}
                      disabled={!message || isSubmitting}
                      className="px-8 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-transparent font-mono text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50 flex items-center gap-2 rounded-xl shadow-lg shadow-black/5 dark:shadow-white/5"
                    >
                      {isSubmitting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      提交反馈
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      damping: 12,
                      stiffness: 200,
                      delay: 0.2,
                    }}
                    className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 border border-emerald-200 dark:border-emerald-800 shadow-xl"
                  >
                    <motion.div
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                    >
                      <Send size={40} />
                    </motion.div>
                  </motion.div>
                  <h3 className="text-xl font-serif font-black text-slate-800 dark:text-white tracking-tight mb-2">
                    感谢您的反馈!
                  </h3>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] max-w-[240px]">
                    您的建议对我们非常重要，我们将尽快处理。
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
