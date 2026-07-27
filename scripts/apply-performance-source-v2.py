#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{relative}: expected one replacement anchor, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def write(relative: str, content: str) -> None:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


print('stage=formula-cache')
replace_once(
    'src/lib/formula/expressionParser.ts',
    '''export function compileFormulaExpression(expression: string): Evaluator {
  return new ArithmeticParser(expression).parse();
}
''',
    '''const FORMULA_CACHE_LIMIT = 256;
const formulaEvaluatorCache = new Map<string, Evaluator>();

export function compileFormulaExpressionUncached(expression: string): Evaluator {
  return new ArithmeticParser(expression).parse();
}

export function compileFormulaExpression(expression: string): Evaluator {
  const cached = formulaEvaluatorCache.get(expression);
  if (cached) {
    formulaEvaluatorCache.delete(expression);
    formulaEvaluatorCache.set(expression, cached);
    return cached;
  }

  const evaluator = compileFormulaExpressionUncached(expression);
  formulaEvaluatorCache.set(expression, evaluator);
  if (formulaEvaluatorCache.size > FORMULA_CACHE_LIMIT) {
    const oldest = formulaEvaluatorCache.keys().next().value;
    if (oldest !== undefined) formulaEvaluatorCache.delete(oldest);
  }
  return evaluator;
}

export function clearFormulaExpressionCache(): void {
  formulaEvaluatorCache.clear();
}

export function getFormulaExpressionCacheSize(): number {
  return formulaEvaluatorCache.size;
}
''',
)

print('stage=category-index')
replace_once(
    'src/data/resinData.ts',
    '''export const CATEGORY_ALIASES = safeLoad(aliasesDoc, 'resin-category-aliases', (v): v is CategoryAlias[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.categoryId === 'string' && typeof x.canonicalName === 'string' && Array.isArray(x.aliases)), []);

export function categoryIdFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  const match = CATEGORY_ALIASES.find((entry) => entry.aliases.some((alias) => normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())));
  return match?.categoryId ?? 'root_plastic';
}

export function categoryNameFromId(id: string): string {
  return CATEGORY_ALIASES.find((entry) => entry.categoryId === id)?.canonicalName ?? flatCategories.find((entry) => entry.id === id)?.name ?? 'Resin';
}
''',
    '''export const CATEGORY_ALIASES = safeLoad(aliasesDoc, 'resin-category-aliases', (v): v is CategoryAlias[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.categoryId === 'string' && typeof x.canonicalName === 'string' && Array.isArray(x.aliases)), []);

const normalizedCategoryAliases = CATEGORY_ALIASES.flatMap((entry) =>
  entry.aliases.map((alias) => ({ normalized: alias.toLowerCase(), categoryId: entry.categoryId })),
);
const categoryIdByExactAlias = new Map<string, string>();
for (const entry of normalizedCategoryAliases) {
  if (!categoryIdByExactAlias.has(entry.normalized)) {
    categoryIdByExactAlias.set(entry.normalized, entry.categoryId);
  }
}
const categoryNameById = new Map(flatCategories.map((entry) => [entry.id, entry.name]));
for (const entry of CATEGORY_ALIASES) categoryNameById.set(entry.categoryId, entry.canonicalName);

export function categoryIdFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  const exact = categoryIdByExactAlias.get(normalized);
  if (exact) return exact;
  return normalizedCategoryAliases.find((entry) => normalized.includes(entry.normalized))?.categoryId ?? 'root_plastic';
}

export function categoryNameFromId(id: string): string {
  return categoryNameById.get(id) ?? 'Resin';
}
''',
)

print('stage=shared-indexes')
write(
    'src/lib/performance/dataIndexes.ts',
    '''export interface GradeNamed {
  gradeName: string;
}

export interface Identified {
  id: string;
}

export function normalizeGradeName(value: string): string {
  return value.trim().toUpperCase();
}

export function buildGradeNameIndex(items: readonly GradeNamed[]): Set<string> {
  return new Set(items.map((item) => normalizeGradeName(item.gradeName)));
}

export function countDuplicateGradeNames(
  candidates: readonly GradeNamed[],
  existingNames: ReadonlySet<string>,
): number {
  let count = 0;
  for (const candidate of candidates) {
    if (existingNames.has(normalizeGradeName(candidate.gradeName))) count += 1;
  }
  return count;
}

export function buildIdPositionIndex<T extends Identified>(items: readonly T[]): Map<string, number> {
  const positions = new Map<string, number>();
  for (let index = 0; index < items.length; index += 1) positions.set(items[index].id, index);
  return positions;
}
''',
)

print('stage=import-index')
replace_once(
    'src/components/modals/ImportModal.tsx',
    "import { getProductValidationWarnings } from '@/utils/productUtils';\n",
    "import { getProductValidationWarnings } from '@/utils/productUtils';\nimport { buildGradeNameIndex, countDuplicateGradeNames } from '@/lib/performance/dataIndexes';\n",
)
replace_once(
    'src/components/modals/ImportModal.tsx',
    '''  // Memoized duplicate count for live reactiveness
  const computedDuplicateOverlapCount = useMemo(() => {
    return parsedProducts.filter((p) =>
      (allProducts || []).some((x) => x.gradeName.trim().toUpperCase() === p.gradeName.trim().toUpperCase())
    ).length;
  }, [parsedProducts, allProducts]);
''',
    '''  const existingGradeNames = useMemo(() => buildGradeNameIndex(allProducts), [allProducts]);
  const computedDuplicateOverlapCount = useMemo(
    () => countDuplicateGradeNames(parsedProducts, existingGradeNames),
    [parsedProducts, existingGradeNames],
  );
''',
)
replace_once(
    'src/components/modals/ImportModal.tsx',
    '''        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
''',
    '''        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          worker: file.size >= 1_000_000,
''',
)

print('stage=batch-cache-index')
replace_once(
    'src/lib/adapters/IndexedDBProductAdapter.ts',
    "import { generateId } from '@/lib/utils';\n",
    "import { generateId } from '@/lib/utils';\nimport { buildIdPositionIndex } from '@/lib/performance/dataIndexes';\n",
)
adapter = ROOT / 'src/lib/adapters/IndexedDBProductAdapter.ts'
text = adapter.read_text(encoding='utf-8')
pattern = re.compile(r'  private registerMutationBatchUpdate\(ids: string\[], updates: ProductUpdates\): void \{.*?\n  \}\n\n  private registerMutationBatchCreate', re.S)
replacement = '''  private registerMutationBatchUpdate(ids: string[], updates: ProductUpdates): void {
    if (!this.cachedProducts) return;
    const { _propertyUpdates, ...restUpdates } = updates;
    const positions = buildIdPositionIndex(this.cachedProducts);

    for (const id of ids) {
      const index = positions.get(id);
      if (index === undefined) continue;
      const product = this.cachedProducts[index];
      const newProperties = { ...product.properties };
      if (_propertyUpdates) {
        Object.entries(_propertyUpdates).forEach(([key, updateVal]) => {
          if (updateVal !== null && typeof updateVal === "object" && "value" in updateVal) {
            newProperties[key] = { ...newProperties[key], ...updateVal as PropertyValue };
          } else {
            newProperties[key] = {
              ...(newProperties[key] || { unit: "" }),
              value: updateVal as string | number,
            };
          }
        });
      }

      const updated = {
        ...product,
        ...restUpdates,
        properties: newProperties,
        updatedAt: new Date().toISOString().split('T')[0],
      };
      this.cachedProducts[index] = updated;
      if (this.indicesRebuilt) {
        this.deindexProduct(id);
        this.indexProduct(updated);
      }
    }
    if (this.indicesRebuilt) this.sortPropertyIndices();
  }

  private registerMutationBatchCreate'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'IndexedDBProductAdapter batch method regex matched {count} times')
adapter.write_text(text, encoding='utf-8')

print('stage=bundle-groups')
vite = ROOT / 'vite.config.ts'
text = vite.read_text(encoding='utf-8')
pattern = re.compile(r"      build: \{\n        outDir: 'dist',.*?\n      \}\n", re.S)
replacement = '''      build: {
        outDir: 'dist',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              const moduleId = id.replaceAll('\\\\', '/');
              if (moduleId.includes('/react-markdown/') || moduleId.includes('/remark-') || moduleId.includes('/rehype-') || moduleId.includes('/unified/') || moduleId.includes('/micromark')) return 'vendor-markdown';
              if (moduleId.includes('/react/') || moduleId.includes('/react-dom/') || moduleId.includes('/scheduler/')) return 'vendor-react';
              if (moduleId.includes('/echarts/') || moduleId.includes('/zrender/')) return 'vendor-echarts';
              if (moduleId.includes('/recharts/') || moduleId.includes('/d3-') || moduleId.includes('/d3/')) return 'vendor-charts';
              if (moduleId.includes('/jspdf/') || moduleId.includes('/html2canvas/') || moduleId.includes('/canvg/')) return 'vendor-export';
              if (moduleId.includes('/lucide-react/') || moduleId.includes('/motion/')) return 'vendor-ui-libs';
              if (moduleId.includes('/papaparse/') || moduleId.includes('/idb/') || moduleId.includes('/lodash/') || moduleId.includes('/diff/') || moduleId.includes('/@tanstack/')) return 'vendor-data';
              return 'vendor-misc';
            },
          },
        },
      }
'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'vite build regex matched {count} times')
vite.write_text(text, encoding='utf-8')

print('stage=performance-tests')
write(
    'scripts/run-performance-benchmark.mjs',
    '''import { spawnSync } from 'node:child_process';

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  executable,
  ['vitest', 'run', 'tests/performance/performance-regression.test.ts', '--pool=forks', '--maxWorkers=1'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PERFORMANCE_REPORT_PATH: process.env.PERFORMANCE_REPORT_PATH || 'reports/performance-audit-20260727/final-benchmarks.json',
    },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
''',
)
write(
    'tests/performance/performance-regression.test.ts',
    r'''import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ALIASES, categoryIdFromText, categoryNameFromId } from '@/data/resinData';
import {
  clearFormulaExpressionCache,
  compileFormulaExpression,
  compileFormulaExpressionUncached,
  getFormulaExpressionCacheSize,
} from '@/lib/formula/expressionParser';
import { buildGradeNameIndex, buildIdPositionIndex, countDuplicateGradeNames } from '@/lib/performance/dataIndexes';

interface Metric { name: string; iterations: number; elapsedMs: number; operationsPerSecond: number; checksum: number }

function measure(name: string, iterations: number, task: () => number): Metric {
  let checksum = 0;
  for (let index = 0; index < Math.min(iterations, 2_000); index += 1) checksum += task();
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) checksum += task();
  const elapsedMs = performance.now() - start;
  return { name, iterations, elapsedMs, operationsPerSecond: iterations / (elapsedMs / 1_000), checksum };
}

function legacyCategoryIdFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  return CATEGORY_ALIASES.find((entry) => entry.aliases.some((alias) => normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())))?.categoryId ?? 'root_plastic';
}

function legacyDuplicateCount(candidates: Array<{ gradeName: string }>, existing: Array<{ gradeName: string }>): number {
  return candidates.filter((candidate) => existing.some((item) => item.gradeName.trim().toUpperCase() === candidate.gradeName.trim().toUpperCase())).length;
}

function legacyBatchPositions(items: Array<{ id: string }>, ids: string[]): number {
  let checksum = 0;
  for (const id of ids) checksum += items.findIndex((item) => item.id === id);
  return checksum;
}

function collectMetrics(): Metric[] {
  const expression = 'p["density"] * 1000 + sqrt(p["modulus"])';
  const properties = { density: 0.95, modulus: 1200 };
  const existing = Array.from({ length: 3_000 }, (_, index) => ({ gradeName: `GRADE-${index}` }));
  const candidates = Array.from({ length: 300 }, (_, index) => ({ gradeName: `GRADE-${index * 7}` }));
  const items = Array.from({ length: 5_000 }, (_, index) => ({ id: `item-${index}` }));
  const ids = Array.from({ length: 500 }, (_, index) => `item-${index * 9}`);
  const gradeIndex = buildGradeNameIndex(existing);
  const idIndex = buildIdPositionIndex(items);
  clearFormulaExpressionCache();
  return [
    measure('formula-compile-uncached', 20_000, () => compileFormulaExpressionUncached(expression)(properties)),
    measure('formula-compile-cached', 20_000, () => compileFormulaExpression(expression)(properties)),
    measure('category-exact-legacy', 150_000, () => legacyCategoryIdFromText('high density polyethylene').length),
    measure('category-exact-indexed', 150_000, () => categoryIdFromText('high density polyethylene').length),
    measure('duplicate-detection-legacy', 20, () => legacyDuplicateCount(candidates, existing)),
    measure('duplicate-detection-indexed', 20, () => countDuplicateGradeNames(candidates, gradeIndex)),
    measure('batch-position-legacy', 10, () => legacyBatchPositions(items, ids)),
    measure('batch-position-indexed', 10, () => ids.reduce((sum, id) => sum + (idIndex.get(id) ?? -1), 0)),
  ];
}

describe('performance regression and correctness', () => {
  it('keeps cached and uncached formulas equivalent', () => {
    clearFormulaExpressionCache();
    const expression = 'max(p["a"], 2) ** 2 + p["b"]';
    const properties = { a: 3, b: 1.25 };
    expect(compileFormulaExpression(expression)(properties)).toBe(compileFormulaExpressionUncached(expression)(properties));
    expect(compileFormulaExpression(expression)).toBe(compileFormulaExpression(expression));
    expect(() => compileFormulaExpression('p["a"] + )')).toThrow();
  });

  it('bounds the cache and preserves category behavior', () => {
    clearFormulaExpressionCache();
    for (let index = 0; index < 400; index += 1) compileFormulaExpression(`p["value"] + ${index}`);
    expect(getFormulaExpressionCacheSize()).toBeLessThanOrEqual(256);
    expect(categoryIdFromText('high density polyethylene')).toBe(legacyCategoryIdFromText('high density polyethylene'));
    expect(categoryIdFromText('industrial high density polyethylene grade')).toBe(legacyCategoryIdFromText('industrial high density polyethylene grade'));
    expect(categoryNameFromId('sub_hdpe')).not.toBe('Resin');
  });

  it('preserves duplicate and batch lookup results', () => {
    const existing = [{ gradeName: 'A' }, { gradeName: ' B ' }, { gradeName: 'C' }];
    const candidates = [{ gradeName: 'a' }, { gradeName: 'B' }, { gradeName: 'D' }];
    expect(countDuplicateGradeNames(candidates, buildGradeNameIndex(existing))).toBe(legacyDuplicateCount(candidates, existing));
    expect(buildIdPositionIndex([{ id: 'a' }, { id: 'b' }, { id: 'c' }]).get('b')).toBe(1);
  });

  it('records broad relative performance evidence', () => {
    const metrics = collectMetrics();
    const byName = new Map(metrics.map((metric) => [metric.name, metric]));
    const ratio = (optimized: string, legacy: string) => (byName.get(optimized)?.elapsedMs ?? Infinity) / (byName.get(legacy)?.elapsedMs ?? 0);
    expect(ratio('formula-compile-cached', 'formula-compile-uncached')).toBeLessThan(1.5);
    expect(ratio('category-exact-indexed', 'category-exact-legacy')).toBeLessThan(2);
    expect(ratio('duplicate-detection-indexed', 'duplicate-detection-legacy')).toBeLessThan(2);
    expect(ratio('batch-position-indexed', 'batch-position-legacy')).toBeLessThan(2);
    const output = process.env.PERFORMANCE_REPORT_PATH;
    if (output) {
      const separator = Math.max(output.lastIndexOf('/'), output.lastIndexOf('\\'));
      if (separator > 0) fs.mkdirSync(output.slice(0, separator), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ metrics }, null, 2) + '\n');
    }
  });
});
''',
)

print('stage=package-and-ci')
package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['scripts']['test:performance'] = 'vitest run tests/performance --pool=forks --maxWorkers=1'
package['scripts']['benchmark:performance'] = 'node scripts/run-performance-benchmark.mjs'
package['scripts']['validate:ci'] = 'npm run validate && npm run test:unit && npm run test:science && npm run test:performance && npm run test:coverage && npm run test:ui && npm run audit:all'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
replace_once(
    '.github/workflows/ci.yml',
    '''      - name: Scientific and worker tests
        run: npm run test:science

      - name: Coverage
''',
    '''      - name: Scientific and worker tests
        run: npm run test:science

      - name: Performance regression tests
        run: npm run test:performance

      - name: Coverage
''',
)
print('stage=done')
