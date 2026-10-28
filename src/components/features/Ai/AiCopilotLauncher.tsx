import React, { lazy, Suspense, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AiCopilotProps } from './AiCopilot';

const Assistant = lazy(() => import('./AiCopilot').then(module => ({ default: module.AiCopilot })));
const buttonClass = 'fixed bottom-20 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white shadow-xl transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 dark:bg-white dark:text-slate-900 md:bottom-6';

/** Keep Markdown and AI settings out of startup until the user opens the tool. */
export function AiCopilotLauncher(props: AiCopilotProps) {
  const [activated, setActivated] = useState(false);
  const { language } = useLanguage();
  const label = language === 'zh' ? '打开 AI 助手' : 'Open AI assistant';
  if (!activated) return <button type="button" onClick={() => setActivated(true)} aria-label={label} className={buttonClass}>
    <Sparkles size={17} aria-hidden="true" /><span className="hidden sm:inline">AI</span>
  </button>;
  return <Suspense fallback={<button className={buttonClass} type="button" disabled aria-busy="true" aria-label={language === 'zh' ? '正在加载 AI 助手' : 'Loading AI assistant'}>
    <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /><span>AI</span>
  </button>}><Assistant {...props} initialOpen /></Suspense>;
}
