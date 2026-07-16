import React, { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Brain,
  ChevronRight,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { Product } from '@/types/index';
import { getAiInsights, isAiConfigured } from '@/services/aiService';
import { AiApiSettingsModal } from '@/components/modals/AiApiSettingsModal';

interface DashboardAiCardProps {
  data: Product[];
}

export const DashboardAiCard: React.FC<DashboardAiCardProps> = ({ data }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configured, setConfigured] = useState(() => isAiConfigured());

  const refreshConfiguredState = () => setConfigured(isAiConfigured());

  const fetchInsight = useCallback(async () => {
    if (isLoading) return;
    if (!isAiConfigured()) {
      setError('AI API is not configured. Open settings and enter an endpoint and model.');
      setSettingsOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await getAiInsights(
        data,
        'Provide a three-sentence technical summary of the current dataset. Focus on grade variety, manufacturer distribution, missing data, and evidence limits.',
      );
      setInsight(result || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI API request failed.');
    } finally {
      setIsLoading(false);
    }
  }, [data, isLoading]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="md:col-span-2 lg:col-span-2 p-6 glass-card relative overflow-hidden flex flex-col justify-between group"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -ml-16 -mb-16 group-hover:bg-indigo-500/10 transition-colors" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-500/10 rounded-2xl text-primary-500 shadow-sm border border-primary-500/10">
                <Brain size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">
                  AI API Insights
                </h3>
                <div className={`flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-widest ${configured ? 'text-emerald-500' : 'text-amber-500'}`}>
                  <span className={`w-1 h-1 rounded-full ${configured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {configured ? 'User provider configured' : 'Configuration required'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSettingsOpen(true)}
                aria-label="Open AI API settings"
                className="p-2 text-slate-400 hover:text-primary-500 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-lg"
              >
                <Settings2 size={16} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                onClick={fetchInsight}
                disabled={isLoading}
                aria-label="Generate AI dataset insight"
                className="p-2 text-slate-400 hover:text-primary-500 transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-primary-500" />
                ) : (
                  <RefreshCw size={16} />
                )}
              </motion.button>
            </div>
          </div>

          <div className="min-h-[80px] relative">
            {isLoading && !insight ? (
              <div className="space-y-3 relative overflow-hidden">
                <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded-full" />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent skew-x-12"
                />
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl text-rose-600 dark:text-rose-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p className="text-[11px] font-bold leading-relaxed">{error}</p>
              </div>
            ) : (
              <div className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed markdown-body">
                <Markdown
                  components={{
                    p: ({ children }) => <p className="mb-0 leading-relaxed text-xs">{children}</p>,
                    strong: ({ children }) => (
                      <strong className="font-black text-slate-900 dark:text-white">{children}</strong>
                    ),
                  }}
                >
                  {insight || 'Configure your own API endpoint and model, then click refresh to generate a dataset summary.'}
                </Markdown>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between relative z-10 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">
              Provider-neutral · user supplied
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded px-1"
          >
            API settings
            <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>

      <AiApiSettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          refreshConfiguredState();
        }}
        onSaved={refreshConfiguredState}
      />
    </>
  );
};
