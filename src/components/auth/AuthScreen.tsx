import React, { useState } from "react";
import { Globe, Moon, Sun, Sparkles, User as UserIcon, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { User as UserType } from '@/types/index';
import { motion, AnimatePresence } from "motion/react";

interface AuthScreenProps {
  onLogin: (user: UserType) => void;
}

const mockAccounts: UserType[] = [
  {
    id: "admin-1",
    name: "haojunsun",
    email: "haojun.sun@resindb.pri",
    role: "admin",
    avatar: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="8" fill="%234f46e5"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%236366f1" stroke-width="2.5" transform="rotate(0 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%233b82f6" stroke-width="2.5" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="12" stroke="%238b5cf6" stroke-width="2.5" transform="rotate(120 50 50)"/><circle cx="90" cy="50" r="4" fill="%236366f1" /><circle cx="70" cy="84" r="4" fill="%233b82f6" /><circle cx="30" cy="16" r="4" fill="%238b5cf6" /></svg>`
  },
  {
    id: "editor-1",
    name: "bot",
    email: "editor.bot@resindb.pri",
    role: "editor",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bot1"
  },
  {
    id: "viewer-1",
    name: "bot",
    email: "viewer.bot@resindb.pri",
    role: "viewer",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bot2"
  }
];

const PrecisionLabLogo: React.FC<{ className?: string }> = ({ className }) => (
  <motion.svg
    viewBox="0 0 100 100"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    initial="initial"
    animate="animate"
  >
    <circle
      cx="50"
      cy="50"
      r="48"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeDasharray="2 2"
      className="text-slate-200 dark:text-slate-800"
    />
    <motion.path
      d="M50 20 L80 40 L80 70 L50 90 L20 70 L20 40 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-primary-500/50"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
    />
    <motion.path
      d="M50 35 L65 45 L65 60 L50 70 L35 60 L35 45 Z"
      fill="currentColor"
      className="text-primary-600 dark:text-primary-400 shadow-xl"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.5 }}
    />
    {[0, 120, 240].map((angle, i) => (
      <motion.circle
        key={i}
        cx={50 + 35 * Math.cos((angle * Math.PI) / 180)}
        cy={50 + 35 * Math.sin((angle * Math.PI) / 180)}
        r="3"
        className="fill-emerald-500 dark:fill-emerald-400"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
      />
    ))}
  </motion.svg>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const { language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (account: UserType) => {
    setIsLoading(true);
    setError(null);
    setTimeout(() => {
      onLogin(account);
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500 p-4">
      {/* Immersive Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary-600/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-sky-500/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[70%] h-[70%] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] dark:opacity-[0.05]"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-primary-500 to-indigo-500 opacity-80 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"></div>

        <div className="p-6 md:p-10 pb-4 md:pb-6 text-center shrink-0">
          <motion.div
            className="inline-flex p-3 md:p-4 bg-white dark:bg-slate-800 border border-slate-100/50 dark:border-slate-700/50 rounded-2xl md:rounded-[2.5rem] shadow-2xl shadow-primary-500/5 mb-4 md:mb-8"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <PrecisionLabLogo className="w-12 h-12 md:w-16 md:h-16" />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">
            Sign In to ResinDB
          </h1>
          <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
            <Sparkles size={14} className="text-amber-500" />
            CNPC ResinDB.pri
            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
            v2.6.1
          </div>
        </div>

        <div className="px-6 md:px-10 pb-6 md:pb-10 space-y-4">
          <AnimatePresence mode="wait">
             {error && (
               <motion.div
                 key="auth-error-alert"
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-bold"
               >
                 {error}
               </motion.div>
             )}
           </AnimatePresence>

           <div className="space-y-3">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-4">
               <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></span>
               Select Account
               <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></span>
             </div>
             
             {mockAccounts.map((account) => (
               <motion.button
                 key={account.id}
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
                 onClick={() => handleLogin(account)}
                 disabled={isLoading}
                 className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl transition-all group text-left disabled:opacity-50"
               >
                 <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border-2 border-white dark:border-slate-800 shadow-sm">
                   <img src={account.avatar} alt={account.name} className="w-full h-full object-cover" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                     {account.name}
                   </div>
                   <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                     {account.email}
                   </div>
                 </div>
                 <div className="shrink-0 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                   {account.role === 'admin' && <Shield size={16} className="text-rose-500" />}
                   {account.role === 'editor' && <Sparkles size={16} className="text-emerald-500" />}
                   {account.role === 'viewer' && <UserIcon size={16} className="text-slate-400" />}
                 </div>
               </motion.button>
             ))}
           </div>
        </div>

        <div className="p-4 md:p-8 bg-slate-50/50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-4 md:gap-6 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-500/5 to-transparent animate-shimmer" />
          <motion.button
            whileHover={{ scale: 1.1, color: "#4f46e5" }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleLanguage}
            className="flex items-center gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] transition-all relative z-10"
          >
            <Globe size={14} strokeWidth={2.5} />{" "}
            {language === "zh" ? "English" : "中文"}
          </motion.button>
          <div className="w-px h-3 bg-slate-200 dark:bg-slate-800 mt-1 relative z-10"></div>
          <motion.button
            whileHover={{ scale: 1.1, color: "#f59e0b" }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="flex items-center gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] transition-all relative z-10"
          >
            {theme === "dark" ? (
              <Sun size={14} strokeWidth={2.5} />
            ) : (
              <Moon size={14} strokeWidth={2.5} />
            )}{" "}
            {theme === "dark" ? "Light" : "Dark"}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
