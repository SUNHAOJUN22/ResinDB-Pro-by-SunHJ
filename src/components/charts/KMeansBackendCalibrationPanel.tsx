import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  Loader2,
  Play,
  Square,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useKMeansBackendCalibration } from '@/hooks/workers/useKMeansBackendCalibration';

function formatTimestamp(value: string | null, language: string): string {
  if (!value) return '—';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '—';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export function KMeansBackendCalibrationPanel() {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const {
    profileState,
    isLoadingProfile,
    isPersistingProfile,
    isCalibrating,
    benchmarkResult,
    benchmarkError,
    benchmarkProgress,
    storageError,
    runCalibration,
    cancelCalibration,
    clearProfile,
  } = useKMeansBackendCalibration();

  const english = language === 'en';
  const profile = profileState.profile;
  const progress = Math.round((benchmarkProgress?.ratio ?? 0) * 100);
  const statusLabel = profileState.status === 'valid'
    ? profile?.status === 'wasm-beneficial'
      ? (english ? 'Local WASM profile ready' : '本机 WASM 配置已就绪')
      : profile?.status === 'typescript-preferred'
        ? (english ? 'Local TypeScript preference' : '本机优先使用 TypeScript')
        : (english ? 'Local evidence is inconclusive' : '本机证据尚不充分')
    : profileState.status === 'missing'
      ? (english ? 'No local calibration profile' : '尚无本机校准配置')
      : (english ? 'Local profile unavailable' : '本机配置不可用');

  return (
    <div
      data-testid="kmeans-backend-calibration"
      className="absolute right-3 top-3 z-20 w-[min(22rem,calc(100%-1.5rem))] rounded-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95"
    >
      <button
        type="button"
        data-testid="kmeans-calibration-toggle"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Gauge size={15} className="shrink-0 text-indigo-500" />
          <span className="truncate text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
            {english ? 'K-Means device calibration' : 'K-Means 本机性能校准'}
          </span>
        </span>
        <span className="text-[10px] font-bold text-slate-400">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3 text-[11px] dark:border-slate-800">
          <div className="flex items-start gap-2">
            {profileState.status === 'valid' ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
            ) : (
              <Cpu size={14} className="mt-0.5 shrink-0 text-slate-400" />
            )}
            <div className="min-w-0">
              <div className="font-bold text-slate-700 dark:text-slate-200">
                {isLoadingProfile ? (english ? 'Loading local profile…' : '正在读取本机配置…') : statusLabel}
              </div>
              {profile && (
                <div className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                  <div>{english ? 'Generated' : '生成时间'}: {formatTimestamp(profile.generatedAt, language)}</div>
                  <div>{english ? 'Expires' : '失效时间'}: {formatTimestamp(profile.expiresAt, language)}</div>
                  <div>
                    {english ? 'Crossover workload' : '交叉点工作量'}: {' '}
                    {profile.crossoverWorkloadOperations?.toLocaleString() ?? '—'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p
            data-testid="kmeans-calibration-privacy"
            className="rounded-xl bg-slate-50 px-2.5 py-2 leading-relaxed text-slate-500 dark:bg-slate-900 dark:text-slate-400"
          >
            {english
              ? 'Calibration runs in a browser Worker. The profile stays in IndexedDB on this device and is never uploaded.'
              : '校准在浏览器 Worker 中运行；配置仅保存在本机 IndexedDB，不会上传。'}
          </p>

          {isCalibrating && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>{benchmarkProgress?.phase ?? (english ? 'Benchmarking' : '正在校准')}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {(benchmarkError || storageError) && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-2.5 py-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{benchmarkError ?? storageError}</span>
            </div>
          )}

          {benchmarkResult && !isPersistingProfile && !storageError && (
            <div className="rounded-xl bg-emerald-50 px-2.5 py-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              {english ? 'Calibration completed and stored locally.' : '校准已完成并保存在本机。'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {isCalibrating ? (
              <button
                type="button"
                onClick={() => cancelCalibration('K-Means device calibration cancelled by the user')}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-100 px-2 py-2 font-bold text-amber-700 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Square size={12} />
                {english ? 'Cancel' : '取消'}
              </button>
            ) : (
              <button
                type="button"
                data-testid="kmeans-calibration-run"
                onClick={() => runCalibration('full')}
                disabled={isPersistingProfile}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-2 py-2 font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPersistingProfile ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {english ? 'Calibrate' : '运行校准'}
              </button>
            )}
            <button
              type="button"
              data-testid="kmeans-calibration-clear"
              onClick={() => void clearProfile()}
              disabled={isCalibrating || isPersistingProfile || profileState.status === 'missing'}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2 py-2 font-bold text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Trash2 size={12} />
              {english ? 'Clear' : '清除配置'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
