import React, { useMemo, useState } from 'react';
import { Activity, Calculator, FlaskConical, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseFiniteReal } from '@/lib/quantityRecord';
import { sandboxCarreau, sandboxWlf, sandboxWeibull } from '@/lib/sandboxModels';

type Model = 'carreau' | 'wlf' | 'weibull';

function NumberField({ label, value, onChange, unit }: { label: string; value: number; onChange: (value: number) => void; unit?: string }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-bold normal-case tracking-wide text-slate-500">{label}</span>
      <div className="flex rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          onChange={(event) => onChange(parseFiniteReal(event.target.value) ?? Number.NaN)}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none dark:text-white"
        />
        {unit && <span className="self-center pr-3 text-xs text-slate-400 normal-case">{unit}</span>}
      </div>
    </label>
  );
}

export const BetaSandboxView: React.FC = () => {
  const { language } = useLanguage();
  const zh = language === 'zh';
  const [model, setModel] = useState<Model>('carreau');
  const [eta0, setEta0] = useState(2400);
  const [lambda, setLambda] = useState(0.155);
  const [shearRate, setShearRate] = useState(10);
  const [n, setN] = useState(0.35);
  const [temperature, setTemperature] = useState(80);
  const [referenceTemperature, setReferenceTemperature] = useState(25);
  const [c1, setC1] = useState(17.44);
  const [c2, setC2] = useState(51.6);
  const [time, setTime] = useState(1000);
  const [scale, setScale] = useState(5000);
  const [shape, setShape] = useState(2);

  const result = useMemo(() => {
    if (model === 'carreau') {
      return { value: sandboxCarreau(eta0, lambda, shearRate, n), unit: 'Pa·s', formula: 'η = η₀[1 + (λγ̇)²]^((n−1)/2)' };
    }
    if (model === 'wlf') {
      return { value: sandboxWlf(temperature, referenceTemperature, c1, c2), unit: 'aT', formula: 'log₁₀(aT) = −C₁(T−Tref)/(C₂+T−Tref)' };
    }
    return { value: sandboxWeibull(time, scale, shape), unit: '% survival', formula: 'R(t) = exp[−(t/η)^β]' };
  }, [c1, c2, eta0, lambda, model, n, referenceTemperature, scale, shape, shearRate, temperature, time]);

  const valid = result.value !== null && Number.isFinite(result.value);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-600 dark:text-indigo-400"><FlaskConical size={24} /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{zh ? '本地计算沙箱' : 'Local Calculation Sandbox'}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {zh ? '该页面只执行透明、确定性的浏览器端公式计算。它不连接仪器、不伪装 WebSocket 遥测，也不声称运行 RDKit、LAMMPS 或外部实验。' : 'This page performs transparent, deterministic browser-side formula calculations only. It does not connect to instruments, simulate WebSocket telemetry, or claim to run RDKit, LAMMPS, or external experiments.'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <nav className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          {([
            ['carreau', zh ? 'Carreau 流变模型' : 'Carreau rheology', Activity],
            ['wlf', zh ? 'WLF 温时等效' : 'WLF time-temperature shift', Calculator],
            ['weibull', zh ? 'Weibull 可靠性' : 'Weibull reliability', ShieldAlert],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setModel(id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${model === id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-4 sm:grid-cols-2">
            {model === 'carreau' && <>
              <NumberField label="η₀" value={eta0} onChange={setEta0} unit="Pa·s" />
              <NumberField label="λ" value={lambda} onChange={setLambda} unit="s" />
              <NumberField label="γ̇" value={shearRate} onChange={setShearRate} unit="s⁻¹" />
              <NumberField label="n (0–1)" value={n} onChange={setN} />
            </>}
            {model === 'wlf' && <>
              <NumberField label="T" value={temperature} onChange={setTemperature} unit="°C" />
              <NumberField label="Tref" value={referenceTemperature} onChange={setReferenceTemperature} unit="°C" />
              <NumberField label="C₁" value={c1} onChange={setC1} />
              <NumberField label="C₂" value={c2} onChange={setC2} unit="°C" />
            </>}
            {model === 'weibull' && <>
              <NumberField label="t" value={time} onChange={setTime} unit="h" />
              <NumberField label={zh ? "η（尺度）" : "η (scale)"} value={scale} onChange={setScale} unit="h" />
              <NumberField label={zh ? "β（形状）" : "β (shape)"} value={shape} onChange={setShape} />
            </>}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
            <p className="font-mono text-xs text-slate-400">{result.formula}</p>
            <p className="mt-3 text-3xl font-black">{valid && result.value !== null ? result.value.toLocaleString(undefined, { maximumFractionDigits: 6 }) : (zh ? '输入或计算无效' : 'Invalid input or calculation')} <span className="text-base font-medium text-slate-400">{valid ? (result.unit === '% survival' ? (zh ? '% 存活率' : '% survival') : result.unit) : ''}</span></p>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {zh ? '结果仅用于教学、探索和输入检查。正式研究必须记录参数来源、适用范围，并用权威软件或实验独立复核。' : 'Results are for education, exploration, and input checking. Formal research must document parameter provenance and applicability, then verify results with authoritative software or experiments.'}
          </div>
        </section>
      </div>
    </div>
  );
};
