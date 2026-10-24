import { parseFiniteReal as parseFiniteNumeric } from '@/lib/quantityRecord';
import { admittedPropertyValue } from '@/lib/propertyAdmission';
import { Product, SortConfig, ColumnConfig, FilterItem, FormulaConfig } from '@/types/index';
import { calculateCompleteness, getComparableNumericPropertyKeys, isLowBest } from '@/utils/productUtils';
import { FormulaEngine } from '@/lib/formulaParser';
import { calculateTopsis } from '@/lib/topsisAnalyzer';

const formulaEngine = new FormulaEngine();


export type WorkerMessage =
  | { type: 'INIT_DATA', payload: { allProducts: Product[], formulas: FormulaConfig[], columns: ColumnConfig[] } }
  | { type: 'QUERY', payload: { activeFilters: Pick<FilterItem, 'id' | 'label' | 'type'>[], inputIsFiltered?: boolean, sortConfig: SortConfig[], useTopsis?: boolean, detectAnomaliesKey?: string } };

export type WorkerResponse =
  | { type: 'INIT_SUCCESS' }
  | { type: 'QUERY_RESULT', payload: { resultIds: string[], topsisTop3Ids?: string[], outliers?: string[] } }
  | { type: 'ERROR', payload: { message: string } };

let data: Product[] = [];
let columns: ColumnConfig[] = [];
let formulas: FormulaConfig[] = [];

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
        let filteredData = data;
        // The application passes an admitted, pre-filtered cohort. The legacy
        // standalone worker query remains available for explicit raw search terms.
        if (!msg.payload.inputIsFiltered && activeFilters && activeFilters.length > 0) {
          filteredData = data.filter(product => activeFilters.every(filter => {
            if (filter.type !== 'search') return true;
            const searchLower = filter.label.toLowerCase();
            if (product.gradeName.toLowerCase().includes(searchLower)) return true;
            if (product.manufacturer.toLowerCase().includes(searchLower)) return true;
            return Object.values(product.properties).some(property =>
              String(property.value).toLowerCase().includes(searchLower));
          }));
        }

        let sortedData = filteredData;
        const formulaExecutor = formulaEngine.compileGraph(formulas);
        let topsisTop3Ids: string[] = [];

        if (msg.payload.useTopsis && filteredData.length > 0) {
          // Column metadata can lag a product edit. Revalidate property criteria
          // against the exact cohort being ranked instead of trusting stale types.
          const comparableKeys = new Set(getComparableNumericPropertyKeys(filteredData));
          const activeCols = columns.filter(c => c.isComputed || (!c.isSystem && comparableKeys.has(c.key)));
          const topsisCols = activeCols.map(c => ({
            key: c.key,
            isLowBest: isLowBest(c.key),
            unit: c.unit,
          }));
          const scores = activeCols.length === 0 ? new Map<string, number>() : calculateTopsis(filteredData, topsisCols, (item, key) => {
            const col = columns.find(c => c.key === key);
            if (col?.isComputed && col.formulaId) {
              return parseFiniteNumeric(formulaExecutor(item)[col.formulaId]);
            }
            const property = item.properties[key];
            return property ? admittedPropertyValue(property) : parseFiniteNumeric((item as unknown as Record<string, unknown>)[key]);
          });

          sortedData = [...filteredData].sort((a, b) => {
            const sA = scores.get(a.id);
            const sB = scores.get(b.id);
            if (sA === undefined && sB === undefined) return a.id.localeCompare(b.id);
            if (sA === undefined) return 1;
            if (sB === undefined) return -1;
            return sB - sA;
          });
          topsisTop3Ids = sortedData.filter(product => scores.has(product.id)).slice(0, 3).map(product => product.id);
        } else if (sortConfig.length > 0) {
          const precalculatedScores = new Map<string, number>();
          if (sortConfig.some(s => s.key === 'completeness')) {
            filteredData.forEach(product => precalculatedScores.set(product.id, calculateCompleteness(product)));
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

              const lowBest = isLowBest(sort.key);
              const direction = sort.direction === 'asc' ? 1 : -1;
              const multiplier = lowBest ? -direction : direction;
              if (typeof aVal === 'number' && typeof bVal === 'number') {
                return (aVal - bVal) * multiplier;
              }
              const left = String(aVal).toLowerCase();
              const right = String(bVal).toLowerCase();
              if (left < right) return -direction;
              if (left > right) return direction;
            }
            return 0;
          });
        } else {
          sortedData = [...filteredData].sort((a, b) => {
            const left = a.priority !== undefined ? a.priority : 1_000_000;
            const right = b.priority !== undefined ? b.priority : 1_000_000;
            return left - right;
          });
        }

        let outliers: string[] = [];
        if (msg.payload.detectAnomaliesKey && filteredData.length > 0) {
          const key = msg.payload.detectAnomaliesKey;
          const values: { id: string, value: number }[] = [];
          for (const product of filteredData) {
            const col = columns.find(c => c.key === key);
            const raw = col?.isComputed && col.formulaId
              ? formulaExecutor(product)[col.formulaId]
              : product.properties[key] ? admittedPropertyValue(product.properties[key]) : (product as unknown as Record<string, unknown>)[key];
            const numeric = parseFiniteNumeric(raw);
            if (numeric !== null) values.push({ id: product.id, value: numeric });
          }
          if (values.length > 0) {
            const scale = values.reduce((maximum, item) => Math.max(maximum, Math.abs(item.value)), 0) || 1;
            const mean = values.reduce((sum, item) => sum + item.value / scale, 0) / values.length;
            const variance = values.reduce((sum, item) => sum + (item.value / scale - mean) ** 2, 0) / values.length;
            const standardDeviation = Math.sqrt(variance);
            if (standardDeviation > 0) {
              outliers = values
                .filter(item => Math.abs((item.value / scale - mean) / standardDeviation) > 3)
                .map(item => item.id);
            }
          }
        }

        self.postMessage({
          type: 'QUERY_RESULT',
          payload: { resultIds: sortedData.map(product => product.id), topsisTop3Ids, outliers },
        } as WorkerResponse);
        break;
      }
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: error instanceof Error ? error.message : 'Unknown Worker Error' },
    } as WorkerResponse);
  }
};
