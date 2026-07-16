import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2, PlugZap, Save, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  AiApiConfig,
  clearAiConfig,
  getAiConfig,
  saveAiConfig,
  testAiConnection,
} from '@/services/aiService';

interface AiApiSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const EMPTY_CONFIG: AiApiConfig = {
  endpoint: '',
  apiKey: '',
  model: '',
};

export const AiApiSettingsModal: React.FC<AiApiSettingsModalProps> = ({
  open,
  onClose,
  onSaved,
}) => {
  const [config, setConfig] = useState<AiApiConfig>(EMPTY_CONFIG);
  const [status, setStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (open) {
      setConfig(getAiConfig());
      setStatus(null);
    }
  }, [open]);

  const updateField = (field: keyof AiApiConfig, value: string) => {
    setConfig((current) => ({ ...current, [field]: value }));
    setStatus(null);
  };

  const handleSave = () => {
    if (!config.endpoint.trim() || !config.model.trim()) {
      setStatus('API endpoint and model are required.');
      return;
    }
    saveAiConfig(config);
    setStatus('Configuration saved in this browser.');
    onSaved?.();
  };

  const handleClear = () => {
    clearAiConfig();
    setConfig(EMPTY_CONFIG);
    setStatus('Browser-stored AI API configuration cleared.');
    onSaved?.();
  };

  const handleTest = async () => {
    if (!config.endpoint.trim() || !config.model.trim()) {
      setStatus('Enter the API endpoint and model before testing.');
      return;
    }

    saveAiConfig(config);
    setIsTesting(true);
    setStatus(null);
    try {
      const result = await testAiConnection();
      setStatus(`Connection succeeded: ${result.trim().slice(0, 80) || 'OK'}`);
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Connection test failed.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-api-settings-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary-500/10 p-2.5 text-primary-500">
                  <PlugZap size={20} />
                </div>
                <div>
                  <h2 id="ai-api-settings-title" className="font-black text-slate-900 dark:text-white">
                    AI API Settings
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Provider-neutral, OpenAI-compatible chat-completions endpoint
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close AI API settings"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </header>

            <div className="space-y-5 p-6">
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 shrink-0" size={18} />
                <p className="text-xs leading-relaxed">
                  Settings entered here are stored in this browser&apos;s localStorage. Use only a restricted development key. For production, route requests through an authenticated server-side gateway.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">API endpoint</span>
                <input
                  value={config.endpoint}
                  onChange={(event) => updateField('endpoint', event.target.value)}
                  placeholder="https://provider.example/v1/chat/completions"
                  autoComplete="url"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Model identifier</span>
                <input
                  value={config.model}
                  onChange={(event) => updateField('model', event.target.value)}
                  placeholder="Enter the model name required by your provider"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">API key</span>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(event) => updateField('apiKey', event.target.value)}
                  placeholder="Optional when your gateway uses another authentication method"
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>

              {status && (
                <div className="flex items-start gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={16} />
                  <span className="break-all">{status}</span>
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <Trash2 size={15} />
                Clear
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 transition hover:border-primary-400 hover:text-primary-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {isTesting ? <Loader2 className="animate-spin" size={15} /> : <PlugZap size={15} />}
                  Test
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-500"
                >
                  <Save size={15} />
                  Save
                </button>
              </div>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
