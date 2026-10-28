import React, { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ANALYSIS_GROUPS, ANALYSIS_MODES, type AnalysisMode } from './analysisModes';

export const AnalysisModeNavigation = React.memo(({ active, onSelect }: {
  active: string; onSelect: (mode: AnalysisMode) => void;
}) => {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const matches = useMemo(() => {
    const needle = query.normalize('NFKC').trim().toLocaleLowerCase();
    return ANALYSIS_MODES.filter(mode => [mode.id, t(`chart_${mode.id}`), ANALYSIS_GROUPS[mode.group][language]]
      .some(value => value.toLocaleLowerCase().includes(needle)));
  }, [language, query, t]);
  return <nav className="space-y-4 p-3" aria-label={language === 'en' ? 'Analysis methods' : '分析方法'}>
    <div className="relative">
      <label htmlFor={searchId} className="sr-only">{language === 'en' ? 'Find an analysis method' : '查找分析方法'}</label>
      <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
      <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)}
        placeholder={language === 'en' ? 'Search methods…' : '搜索分析方法…'}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
    </div>
    {Object.entries(ANALYSIS_GROUPS).map(([group, label]) => {
      const modes = matches.filter(mode => mode.group === group);
      return modes.length > 0 && <section key={group} aria-label={label[language]}>
        <h3 className="mb-1 px-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{label[language]}</h3>
        <div className="space-y-1">{modes.map(mode => <button key={mode.id} type="button" data-chart-mode={mode.id}
          aria-pressed={active === mode.id} onClick={() => onSelect(mode.id)}
          className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active === mode.id
            ? 'border-blue-200 bg-blue-50 font-semibold text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'
            : 'border-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
          <mode.icon size={17} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 break-words">{t(`chart_${mode.id}`)}</span>
        </button>)}</div>
      </section>;
    })}
    {matches.length === 0 && <p role="status" className="px-2 text-sm text-slate-500">{language === 'en' ? 'No matching method. Clear the search to browse all methods.' : '没有匹配的方法。清除搜索可浏览全部方法。'}</p>}
  </nav>;
});
