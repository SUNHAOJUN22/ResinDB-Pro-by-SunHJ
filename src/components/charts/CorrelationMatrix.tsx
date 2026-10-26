import { buildSpearmanPayload } from '@/lib/spearmanPayload';
import React, { useEffect, useState } from 'react';
import type { SpearmanMessage, SpearmanResponse } from '@/workers/spearmanWorker';
import { Loader2 } from 'lucide-react';
import { Product } from '@/types/index';

interface CorrelationMatrixProps {
  data: Product[];
  keys: string[];
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ data, keys }) => {
  const [result, setResult] = useState<{ data: Product[]; keys: string[]; matrix: number[][]; error?: string; constantKeys?: string[] } | null>(null);

  useEffect(() => {
    if (data.length === 0 || keys.length < 2) return;
    // A dedicated worker and captured input identity bind every response to one
    // request. Termination plus the closed flag also rejects late queued events.
    const worker = new Worker(new URL('../../workers/spearmanWorker.ts', import.meta.url), { type: 'module' });
    let closed = false;
    const fail = (message: string) => { if (!closed) setResult({ data, keys, matrix: [], error: message }); };
    worker.onmessage = (event: MessageEvent<SpearmanResponse>) => {
      if (closed) return;
      const response = event.data;
      if (response.type === 'ERROR') { fail(response.payload.message); return; }
      const { matrix, keys: returnedKeys } = response.payload;
      if (returnedKeys.length !== keys.length || returnedKeys.some((key, index) => key !== keys[index])
        || matrix.length !== keys.length || matrix.some(row => row.length !== keys.length || row.some(value => !Number.isFinite(value)))) {
        fail('Correlation response does not match the requested features'); return;
      }
      setResult({ data, keys, matrix, constantKeys: response.payload.diagnostics.constantKeys });
    };
    worker.onerror = () => fail('Correlation worker failed');
    worker.postMessage({ type: 'COMPUTE_SPEARMAN', payload: { data: buildSpearmanPayload(data, keys), keys } } satisfies SpearmanMessage);
    return () => { closed = true; worker.terminate(); };
  }, [data, keys]);

  if (data.length === 0 || keys.length < 2) return null;
  if (!result || result.data !== data || result.keys !== keys) {
    return <div className="flex items-center justify-center p-12 text-slate-400 gap-2"><Loader2 className="animate-spin" size={20}/> Computing Spearman Rank Correlation...</div>;
  }
  if (result.error) return <p role="alert" className="p-4 text-slate-500">Correlation unavailable: {result.error}</p>;
  const matrix = result.matrix;
  if (matrix.length === 0) return null;
  const constantKeys = new Set(result.constantKeys ?? []);

  const getColor = (val: number) => {
     // Red for positive (+1), Blue for negative (-1), White/transparent for 0
     if (val > 0) {
        return `rgba(239, 68, 68, ${val * 0.9})`; // rose-500
     } else if (val < 0) {
        return `rgba(59, 130, 246, ${Math.abs(val) * 0.9})`; // blue-500
     }
     return 'transparent';
  };

  return (
    <div className="w-full overflow-auto custom-scrollbar relative p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
      <div className="flex mb-2">
         <div className="w-24 shrink-0" />
         {keys.map((k) => (
             <div key={k} className="w-12 h-24 shrink-0 relative">
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rotate-[-45deg] origin-bottom-left text-[10px] font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {k.length > 8 ? k.substring(0,8) + '..' : k}
                </span>
             </div>
         ))}
      </div>
      {keys.map((rowKey, i) => (
         <div key={rowKey} className="flex">
            <div className="w-24 shrink-0 flex items-center justify-end pr-3 text-[10px] font-mono text-slate-600 dark:text-slate-400 text-right truncate">
              {rowKey.length > 12 ? rowKey.substring(0, 12) + '..' : rowKey}
            </div>
            {keys.map((colKey, j) => (
               <div 
                 key={`${rowKey}-${colKey}`}
                 className="w-12 h-12 shrink-0 border border-slate-100 dark:border-slate-800 flex items-center justify-center group relative cursor-crosshair transition-transform hover:z-10 hover:scale-110 hover:shadow-lg rounded-sm"
                 style={{ backgroundColor: constantKeys.has(rowKey) || constantKeys.has(colKey) ? 'transparent' : getColor(matrix[i][j]) }}
               >
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] font-black pointer-events-none drop-shadow-md text-slate-900 dark:text-white mix-blend-overlay">
                    {constantKeys.has(rowKey) || constantKeys.has(colKey) ? 'N/A' : matrix[i][j].toFixed(2)}
                  </span>
               </div>
            ))}
         </div>
      ))}
      <div className="mt-6 flex items-center gap-4 text-[10px] font-mono text-slate-500 justify-center">
         <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm" /> -1 (Inverse)</div>
         <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 dark:bg-slate-800 rounded-sm border" /> 0</div>
         <div className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-500 rounded-sm" /> +1 (Direct)</div>
      </div>
    </div>
  );
};
