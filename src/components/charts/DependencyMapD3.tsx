import React, { useMemo, useState } from 'react';
import { Download, Maximize2, RotateCcw, Search } from 'lucide-react';
import { RESIN_NETWORK, type ResinNetworkNode } from '@/data/resinData';
import { useLanguage } from '@/contexts/LanguageContext';

const point = (node: ResinNetworkNode, index: number, total: number) => {
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  const radius = node.group === 'resin' ? 185 : 100;
  return { x: 300 + Math.cos(angle) * radius, y: 220 + Math.sin(angle) * radius };
};

const DependencyMapD3: React.FC = () => {
  const { language } = useLanguage();
  const zh = language === 'zh';
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ResinNetworkNode | null>(null);
  const [labels, setLabels] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const positions = useMemo(() => new Map(RESIN_NETWORK.nodes.map((node, index) => [node.id, point(node, index, RESIN_NETWORK.nodes.length)])), []);
  const filtered = RESIN_NETWORK.nodes.filter(node => !query || node.id.toLowerCase().includes(query.toLowerCase()));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(RESIN_NETWORK, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resindb-resin-network.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section data-testid="dependency-map" className={`${fullscreen ? 'fixed inset-0 z-[240]' : 'h-full'} flex flex-col rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-950`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex-1">
          <Search className="absolute left-2 top-2.5" size={14} />
          <input value={query} onChange={event => setQuery(event.target.value)} aria-label={zh ? '搜索单体或树脂' : 'Search monomers or resins'} placeholder={zh ? '搜索单体或树脂' : 'Search monomers or resins'} className="w-full rounded-lg border py-2 pl-8 pr-2 text-sm" />
        </label>
        <button type="button" onClick={() => { setQuery(''); setSelected(null); }} title={zh ? '复位' : 'Reset'} aria-label={zh ? '复位' : 'Reset'}><RotateCcw size={16} /></button>
        <button type="button" onClick={() => setLabels(!labels)} aria-pressed={labels} className="rounded-lg border px-2 py-1 text-xs">{zh ? '标签' : 'Labels'}</button>
        <button type="button" onClick={() => setFullscreen(!fullscreen)} title={zh ? (fullscreen ? '退出全屏' : '全屏') : (fullscreen ? 'Exit full screen' : 'Full screen')} aria-label={zh ? (fullscreen ? '退出全屏' : '全屏') : (fullscreen ? 'Exit full screen' : 'Full screen')}><Maximize2 size={16} /></button>
        <button type="button" onClick={exportJson} title={zh ? '导出 JSON' : 'Export JSON'} aria-label={zh ? '导出 JSON' : 'Export JSON'}><Download size={16} /></button>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_220px]">
        <svg role="img" aria-label={zh ? '树脂原料与聚合物关系图' : 'Resin feedstock and polymer relationships'} data-testid="dependency-map-svg" viewBox="0 0 600 440" className="h-full min-h-[420px] w-full rounded-xl bg-slate-50 dark:bg-slate-900">
          {RESIN_NETWORK.links.map((link, index) => {
            const a = positions.get(String(link.source));
            const b = positions.get(String(link.target));
            return a && b ? <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" opacity=".2" strokeWidth={link.value ?? 1} /> : null;
          })}
          {filtered.map(node => {
            const position = positions.get(node.id)!;
            return <g key={node.id} onClick={() => setSelected(node)} className="cursor-pointer">
              <circle cx={position.x} cy={position.y} r={Math.max(8, node.radius ?? 14)} fill={node.group === 'resin' ? 'var(--color-primary-500,#6366f1)' : '#94a3b8'} stroke="white" strokeWidth="2" />
              <title>{node.id}</title>
              {labels && <text x={position.x} y={position.y + (node.radius ?? 14) + 13} textAnchor="middle" fontSize="10" fill="currentColor">{node.id}</text>}
            </g>;
          })}
        </svg>
        <aside className="rounded-xl border p-3 text-sm dark:border-slate-700">
          <h3 className="font-bold">{zh ? '网络分析' : 'Network analysis'}</h3>
          <p className="mt-2 text-xs text-slate-500">{zh
            ? `节点 ${RESIN_NETWORK.nodes.length}；关系 ${RESIN_NETWORK.links.length}。点击节点查看原料、分子式与用途说明。`
            : `${RESIN_NETWORK.nodes.length} nodes; ${RESIN_NETWORK.links.length} relationships. Select a node to view its feedstock, formula, and source description.`}</p>
          {selected && <dl className="mt-4 space-y-2 text-xs">
            <dt className="font-bold">{selected.id}</dt>
            <dd>{selected.group === 'resin' ? (zh ? '树脂' : 'Resin') : (zh ? '化学原料' : 'Chemical feedstock')}</dd>
            {selected.formula && <dd>{zh ? '分子式：' : 'Formula: '}{selected.formula}</dd>}
            {selected.cas && <dd>CAS: {selected.cas}</dd>}
            <dd>{selected.desc ?? (zh ? '未提供说明' : 'No source description provided')}</dd>
          </dl>}
        </aside>
      </div>
    </section>
  );
};
export default DependencyMapD3;
