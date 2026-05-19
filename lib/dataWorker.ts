import { Product, SortConfig, ColumnConfig, FilterItem, FormulaConfig } from '../types';
import { calculateCompleteness, isLowBest } from '../productUtils';
import { FormulaEngine } from './formulaParser';
import { calculateTopsis } from './topsisAnalyzer';

const formulaEngine = new FormulaEngine();

export type WorkerMessage = 
  | { type: 'INIT_DATA', payload: { allProducts: Product[], formulas: FormulaConfig[], columns: ColumnConfig[] } }
  | { type: 'QUERY', payload: { activeFilters: FilterItem[], sortConfig: SortConfig[], useTopsis?: boolean, detectAnomaliesKey?: string } };

export type WorkerResponse = 
  | { type: 'INIT_SUCCESS' }
  | { type: 'QUERY_RESULT', payload: { resultIds: string[], topsisTop3Ids?: string[], outliers?: string[] } }
  | { type: 'ERROR', payload: { message: string } };

let data: Product[] = [];
let columns: ColumnConfig[] = [];
let formulas: FormulaConfig[] = [];

// The main message handler for the worker
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  try {
    const msg = e.data;

    switch (msg.type) {
      case 'INIT_DATA': {
        data = msg.payload.allProducts;
        formulas = msg.payload.formulas;
        columns = msg.payload.columns;
        
        self.postMessage({ type: 'INIT_SUCCESS' } as WorkerResponse);
        break;
      }
      
      case 'QUERY': {
        const { activeFilters, sortConfig } = msg.payload;
        
        // 1. Filter
        let filteredData = data;
        if (activeFilters && activeFilters.length > 0) {
          filteredData = data.filter(product => {
            return activeFilters.every(filter => {
              if (filter.type === 'search') {
                const searchLower = filter.label.toLowerCase();
                
                if (product.gradeName.toLowerCase().includes(searchLower)) return true;
                if (product.manufacturer.toLowerCase().includes(searchLower)) return true;
                
                const props = product.properties;
                for (const key in props) {
                   if (String(props[key].value).toLowerCase().includes(searchLower)) return true;
                }
                return false;
              }
              return true;
            });
          });
        }

        // 2. Sort
        let sortedData = filteredData;
        const formulaExecutor = formulaEngine.compileGraph(formulas);
        let topsisTop3Ids: string[] = [];

        if (msg.payload.useTopsis && filteredData.length > 0) {
           const activeCols = columns.filter(c => c.type === 'number' || c.isComputed);
           const topsisCols = activeCols.map(c => ({
              key: c.key,
              isLowBest: isLowBest(c.key)
           }));

           const scores = calculateTopsis(filteredData, topsisCols, (item, key) => {
              const col = columns.find(c => c.key === key);
              if (col?.isComputed && col.formulaId) {
                 return formulaExecutor(item)[col.formulaId] || 0;
              }
              const val = item.properties[key]?.value ?? (item as unknown as Record<string, unknown>)[key];
              return typeof val === 'number' ? val : parseFloat(String(val));
           });

           sortedData = [...filteredData].sort((a, b) => {
              const sA = scores.get(a.id) || 0;
              const sB = scores.get(b.id) || 0;
              return sB - sA;
           });
           
           topsisTop3Ids = sortedData.slice(0, 3).map(p => p.id);
        } else if (sortConfig.length > 0) {
          // Pre-calculate completeness if needed
          const precalculatedScores = new Map<string, number>();
          if (sortConfig.some(s => s.key === 'completeness')) {
            filteredData.forEach(p => {
              precalculatedScores.set(p.id, calculateCompleteness(p));
            });
          }

          sortedData = [...filteredData].sort((a, b) => {
             for (const sort of sortConfig) {
               let aVal: unknown;
               let bVal: unknown;
       
               if (sort.key === 'completeness') {
                 aVal = precalculatedScores.get(a.id);
                 bVal = precalculatedScores.get(b.id);
               } else {
                const col = columns.find(c => c.key === sort.key);
                if (col?.isComputed && col.formulaId) {
                  aVal = formulaExecutor(a)[col.formulaId];
                  bVal = formulaExecutor(b)[col.formulaId];
                } else {
                  aVal = a.properties[sort.key]?.value ?? (a as unknown as Record<string, unknown>)[sort.key];
                  bVal = b.properties[sort.key]?.value ?? (b as unknown as Record<string, unknown>)[sort.key];
                }
              }

              if (aVal === bVal) continue;
              
              if (aVal === undefined || aVal === null) return 1;
              if (bVal === undefined || bVal === null) return -1;

              const isLow = isLowBest(sort.key);
              const m = sort.direction === 'asc' ? 1 : -1;
              const revM = isLow ? -m : m;

              if (typeof aVal === 'number' && typeof bVal === 'number') {
                return (aVal - bVal) * revM;
              }

              const sA = String(aVal).toLowerCase();
              const sB = String(bVal).toLowerCase();
              
              if (sA < sB) return -m;
              if (sA > sB) return m;
            }
            return 0;
          });
        }

        // 3. Anomaly Detection
        let outliers: string[] = [];
        if (msg.payload.detectAnomaliesKey && filteredData.length > 0) {
          const key = msg.payload.detectAnomaliesKey;
          const vals: { id: string, val: number }[] = [];
          let sum = 0;
          let count = 0;
          
          filteredData.forEach(p => {
             let v: unknown;
             const col = columns.find(c => c.key === key);
             if (col?.isComputed && col.formulaId) {
                v = formulaExecutor(p)[col.formulaId];
             } else {
                v = p.properties[key]?.value ?? (p as unknown as Record<string, unknown>)[key];
             }
             if (v !== undefined && v !== null && !isNaN(parseFloat(String(v)))) {
                const num = parseFloat(String(v));
                vals.push({ id: p.id, val: num });
                sum += num;
                count++;
             }
          });

          if (count > 0) {
             const mean = sum / count;
             let sqDiffSum = 0;
             vals.forEach(v => {
                sqDiffSum += Math.pow(v.val - mean, 2);
             });
             const stdDev = Math.sqrt(sqDiffSum / count);
             
             if (stdDev > 0) {
                outliers = vals.filter(v => Math.abs((v.val - mean) / stdDev) > 3).map(v => v.id);
             }
          }
        }

        // 4. Return IDs
        const resultIds = sortedData.map(p => p.id);
        self.postMessage({ type: 'QUERY_RESULT', payload: { resultIds, topsisTop3Ids, outliers } } as WorkerResponse);
        break;
      }
    }
  } catch (err) {
    self.postMessage({ 
      type: 'ERROR', 
      payload: { message: err instanceof Error ? err.message : 'Unknown Worker Error' } 
    } as WorkerResponse);
  }
};
