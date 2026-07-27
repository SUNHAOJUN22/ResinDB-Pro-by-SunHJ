#!/usr/bin/env python3
"""Apply the measured, low-risk ResinDB performance optimization candidate."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{relative}: expected one replacement anchor, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def write(relative: str, content: str) -> None:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# 1. Formula compilation: exact-expression bounded LRU cache.
replace_once(
    "src/lib/formula/expressionParser.ts",
    """export function compileFormulaExpression(expression: string): Evaluator {
  return new ArithmeticParser(expression).parse();
}
""",
    """const FORMULA_CACHE_LIMIT = 256;
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
""",
)

# 2. Category lookup: O(1) exact lookup with order-preserving substring fallback.
replace_once(
    "src/data/resinData.ts",
    """export const CATEGORY_ALIASES = safeLoad(aliasesDoc, 'resin-category-aliases', (v): v is CategoryAlias[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.categoryId === 'string' && typeof x.canonicalName === 'string' && Array.isArray(x.aliases)), []);

export function categoryIdFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  const match = CATEGORY_ALIASES.find((entry) => entry.aliases.some((alias) => normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())));
  return match?.categoryId ?? 'root_plastic';
}

export function categoryNameFromId(id: string): string {
  return CATEGORY_ALIASES.find((entry) => entry.categoryId === id)?.canonicalName ?? flatCategories.find((entry) => entry.id === id)?.name ?? 'Resin';
}
""",
    """export const CATEGORY_ALIASES = safeLoad(aliasesDoc, 'resin-category-aliases', (v): v is CategoryAlias[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.categoryId === 'string' && typeof x.canonicalName === 'string' && Array.isArray(x.aliases)), []);

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
for (const entry of CATEGORY_ALIASES) {
  categoryNameById.set(entry.categoryId, entry.canonicalName);
}

export function categoryIdFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  const exact = categoryIdByExactAlias.get(normalized);
  if (exact) return exact;
  return normalizedCategoryAliases.find((entry) => normalized.includes(entry.normalized))?.categoryId ?? 'root_plastic';
}

export function categoryNameFromId(id: string): string {
  return categoryNameById.get(id) ?? 'Resin';
}
""",
)

# 3. Shared grade and ID indexes used by import and IndexedDB cache paths.
write(
    "src/lib/performance/dataIndexes.ts",
    """export interface GradeNamed {
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
  for (let index = 0; index < items.length; index += 1) {
    positions.set(items[index].id, index);
  }
  return positions;
}
""",
)

replace_once(
    "src/components/modals/ImportModal.tsx",
    "import { getProductValidationWarnings } from '@/utils/productUtils';\n",
    "import { getProductValidationWarnings } from '@/utils/productUtils';\nimport { buildGradeNameIndex, countDuplicateGradeNames } from '@/lib/performance/dataIndexes';\n",
)
replace_once(
    "src/components/modals/ImportModal.tsx",
    """  // Memoized duplicate count for live reactiveness
  const computedDuplicateOverlapCount = useMemo(() => {
    return parsedProducts.filter((p) =>
      (allProducts || []).some((x) => x.gradeName.trim().toUpperCase() === p.gradeName.trim().toUpperCase())
    ).length;
  }, [parsedProducts, allProducts]);
""",
    """  const existingGradeNames = useMemo(() => buildGradeNameIndex(allProducts), [allProducts]);
  const computedDuplicateOverlapCount = useMemo(
    () => countDuplicateGradeNames(parsedProducts, existingGradeNames),
    [parsedProducts, existingGradeNames],
  );
""",
)
replace_once(
    "src/components/modals/ImportModal.tsx",
    """        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
""",
    """        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          worker: file.size >= 1_000_000,
""",
)

replace_once(
    "src/lib/adapters/IndexedDBProductAdapter.ts",
    "import { generateId } from '@/lib/utils';\n",
    "import { generateId } from '@/lib/utils';\nimport { buildIdPositionIndex } from '@/lib/performance/dataIndexes';\n",
)
replace_once(
    "src/lib/adapters/IndexedDBProductAdapter.ts",
    """  private registerMutationBatchUpdate(ids: string[], updates: ProductUpdates): void {
    if (!this.cachedProducts) return;
    const { _propertyUpdates, ...restUpdates } = updates;
    
    for (const id of ids) {
      const p = this.cachedProducts.find(x => x.id === id);
      if (p) {
        const newProperties = { ...p.properties };
        if (_propertyUpdates) {
          Object.entries(_propertyUpdates).forEach(([key, updateVal]) => {
            if (updateVal !== null && typeof updateVal === "object" && "value" in updateVal) {
              newProperties[key] = { ...newProperties[key], ...updateVal as PropertyValue };
            } else {
              newProperties[key] = { 
                ...(newProperties[key] || { unit: "" }), 
                value: updateVal as string | number 
              };
            }
          });
        }
        
        const updated = {
          ...p,
          ...restUpdates,
          properties: newProperties,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        
        const idx = this.cachedProducts.findIndex(x => x.id === id);
        if (idx !== -1) {
          this.cachedProducts[idx] = updated;
        }
        
        if (this.indicesRebuilt) {
          this.deindexProduct(id);
          this.indexProduct(updated);
        }
      }
    }
    if (this.indicesRebuilt) {
      this.sortPropertyIndices();
    }
  }
""",
    """  private registerMutationBatchUpdate(ids: string[], updates: ProductUpdates): void {
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
""",
)

# 4. Bundle grouping: preserve lazy boundaries instead of one generic 1.45 MB vendor bucket.
replace_once(
    "vite.config.ts",
    """      build: {
        outDir: 'dist',
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('echarts') || id.includes('zrender')) {
                            return 'vendor-echarts';
                        }
                        if (id.includes('lucide-react') || id.includes('motion')) {
                            return 'vendor-ui-libs';
                        }
                        return 'vendor';
                    }
                }
            }
        }
      }
""",
    """      build: {
        outDir: 'dist',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              const moduleId = id.replaceAll('\\\\', '/');
              if (moduleId.includes('/react-markdown/') || moduleId.includes('/remark-') || moduleId.includes('/rehype-') || moduleId.includes('/unified/') || moduleId.includes('/micromark')) {
                return 'vendor-markdown';
              }
              if (moduleId.includes('/react/') || moduleId.includes('/react-dom/') || moduleId.includes('/scheduler/')) {
                return 'vendor-react';
              }
              if (moduleId.includes('/echarts/') || moduleId.includes('/zrender/')) {
                return 'vendor-echarts';
              }
              if (moduleId.includes('/recharts/') || moduleId.includes('/d3-') || moduleId.includes('/d3/')) {
                return 'vendor-charts';
              }
              if (moduleId.includes('/jspdf/') || moduleId.includes('/html2canvas/') || moduleId.includes('/canvg/')) {
                return 'vendor-export';
              }
              if (moduleId.includes('/lucide-react/') || moduleId.includes('/motion/')) {
                return 'vendor-ui-libs';
              }
              if (moduleId.includes('/papaparse/') || moduleId.includes('/idb/') || moduleId.includes('/lodash/') || moduleId.includes('/diff/') || moduleId.includes('/@tanstack/')) {
                return 'vendor-data';
              }
              return 'vendor-misc';
            },
          },
        },
      }
""",
)

# 5. Durable performance tests and cross-platform benchmark command.
write(
    "scripts/run-performance-benchmark.mjs",
    """import { spawnSync } from 'node:child_process';

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  executable,
  ['vitest', 'run', 'tests/performance/performance-regression.test.ts', '--pool=forks', '--maxWorkers=1'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PERFORMANCE_REPORT_PATH:
        process.env.PERFORMANCE_REPORT_PATH || 'reports/performance-audit-20260727/final-benchmarks.json',
    },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
""",
)
write(
    "tests/performance/performance-regression.test.ts",
    """import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ALIASES,
  categoryIdFromText,
  categoryNameFromId,
} from '@/data/resinData';
import {
  clearFormulaExpressionCache,
  compileFormulaExpression,
  compileFormulaExpressionUncached,
  getFormulaExpressionCacheSize,
} from '@/lib/formula/expressionParser';
import {
  buildGradeNameIndex,
  buildIdPositionIndex,
  countDuplicateGradeNames,
} from '@/lib/performance/dataIndexes';

interface Metric {
  name: string;
  iterations: number;
  elapsedMs: number;
  operationsPerSecond: number;
  checksum: number;
}

function measure(name: string, iterations: number, task: () => number): Metric {
  let checksum = 0;
  for (let index = 0; index < Math.min(iterations, 2_000); index += 1) checksum += task();
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) checksum += task();
  const elapsedMs = performance.now() - start;
  return {
    name,
    iterations,
    elapsedMs,
    operationsPerSecond: iterations / (elapsedMs / 1_000),
    checksum,
  };
}

function legacyCategoryIdFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  const match = CATEGORY_ALIASES.find((entry) =>
    entry.aliases.some((alias) => normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())),
  );
  return match?.categoryId ?? 'root_plastic';
}

function legacyDuplicateCount(candidates: Array<{ gradeName: string }>, existing: Array<{ gradeName: string }>): number {
  return candidates.filter((candidate) =>
    existing.some((item) => item.gradeName.trim().toUpperCase() === candidate.gradeName.trim().toUpperCase()),
  ).length;
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
  const metrics = [
    measure('formula-compile-uncached', 20_000, () => compileFormulaExpressionUncached(expression)(properties)),
    measure('formula-compile-cached', 20_000, () => compileFormulaExpression(expression)(properties)),
    measure('category-exact-legacy', 150_000, () => legacyCategoryIdFromText('high density polyethylene').length),
    measure('category-exact-indexed', 150_000, () => categoryIdFromText('high density polyethylene').length),
    measure('duplicate-detection-legacy', 20, () => legacyDuplicateCount(candidates, existing)),
    measure('duplicate-detection-indexed', 20, () => countDuplicateGradeNames(candidates, gradeIndex)),
    measure('batch-position-legacy', 10, () => legacyBatchPositions(items, ids)),
    measure('batch-position-indexed', 10, () => ids.reduce((sum, id) => sum + (idIndex.get(id) ?? -1), 0)),
  ];
  return metrics;
}

describe('performance regression and scientific correctness', () => {
  it('keeps cached and uncached formula evaluators mathematically equivalent', () => {
    clearFormulaExpressionCache();
    const expression = 'max(p["a"], 2) ** 2 + p["b"]';
    const properties = { a: 3, b: 1.25 };
    expect(compileFormulaExpression(expression)(properties)).toBe(
      compileFormulaExpressionUncached(expression)(properties),
    );
    expect(compileFormulaExpression(expression)).toBe(compileFormulaExpression(expression));
    expect(() => compileFormulaExpression('p["a"] + )')).toThrow();
  });

  it('bounds the formula cache and preserves category lookup behavior', () => {
    clearFormulaExpressionCache();
    for (let index = 0; index < 400; index += 1) {
      compileFormulaExpression(`p["value"] + ${index}`);
    }
    expect(getFormulaExpressionCacheSize()).toBeLessThanOrEqual(256);
    expect(categoryIdFromText('high density polyethylene')).toBe(legacyCategoryIdFromText('high density polyethylene'));
    expect(categoryIdFromText('industrial high density polyethylene grade')).toBe(
      legacyCategoryIdFromText('industrial high density polyethylene grade'),
    );
    expect(categoryNameFromId('sub_hdpe')).not.toBe('Resin');
  });

  it('uses indexed duplicate and batch lookups without changing results', () => {
    const existing = [{ gradeName: 'A' }, { gradeName: ' B ' }, { gradeName: 'C' }];
    const candidates = [{ gradeName: 'a' }, { gradeName: 'B' }, { gradeName: 'D' }];
    expect(countDuplicateGradeNames(candidates, buildGradeNameIndex(existing))).toBe(
      legacyDuplicateCount(candidates, existing),
    );
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(buildIdPositionIndex(items).get('b')).toBe(1);
  });

  it('records stable relative performance evidence', () => {
    const metrics = collectMetrics();
    const byName = new Map(metrics.map((metric) => [metric.name, metric]));
    const ratio = (optimized: string, legacy: string) =>
      (byName.get(optimized)?.elapsedMs ?? Infinity) / (byName.get(legacy)?.elapsedMs ?? 0);

    expect(ratio('formula-compile-cached', 'formula-compile-uncached')).toBeLessThan(1.5);
    expect(ratio('category-exact-indexed', 'category-exact-legacy')).toBeLessThan(2);
    expect(ratio('duplicate-detection-indexed', 'duplicate-detection-legacy')).toBeLessThan(2);
    expect(ratio('batch-position-indexed', 'batch-position-legacy')).toBeLessThan(2);

    const output = process.env.PERFORMANCE_REPORT_PATH;
    if (output) {
      fs.mkdirSync(new URL('../..', new URL(`file://${output}`)).pathname, { recursive: true });
      fs.mkdirSync(output.slice(0, output.lastIndexOf('/')), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ metrics }, null, 2) + '\n');
    }
  });
});
""",
)

# Fix portable report path creation in the test without relying on URL parsing.
replace_once(
    "tests/performance/performance-regression.test.ts",
    """    if (output) {
      fs.mkdirSync(new URL('../..', new URL(`file://${output}`)).pathname, { recursive: true });
      fs.mkdirSync(output.slice(0, output.lastIndexOf('/')), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ metrics }, null, 2) + '\\n');
    }
""",
    """    if (output) {
      const separator = Math.max(output.lastIndexOf('/'), output.lastIndexOf('\\\\'));
      if (separator > 0) fs.mkdirSync(output.slice(0, separator), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ metrics }, null, 2) + '\\n');
    }
""",
)

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package["scripts"]
scripts["test:performance"] = "vitest run tests/performance --pool=forks --maxWorkers=1"
scripts["benchmark:performance"] = "node scripts/run-performance-benchmark.mjs"
scripts["validate:ci"] = "npm run validate && npm run test:unit && npm run test:science && npm run test:performance && npm run test:coverage && npm run test:ui && npm run audit:all"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Permanent CI includes the performance regression group.
replace_once(
    ".github/workflows/ci.yml",
    """      - name: Scientific and worker tests
        run: npm run test:science

      - name: Coverage
""",
    """      - name: Scientific and worker tests
        run: npm run test:science

      - name: Performance regression tests
        run: npm run test:performance

      - name: Coverage
""",
)

# 6. Four truthful, deterministic performance diagrams.
generator_path = ROOT / "scripts/generate-readme-visuals.py"
generator = generator_path.read_text(encoding="utf-8")
visual_anchor = """    Visual(
        "resindb-security-deployment.svg", "deployment-title",
"""
new_visuals = """    Visual(
        "resindb-performance-data-flow.svg", "performance-flow-title",
        "High-performance data flow", "Index once • reuse workers • preserve scientific outputs",
        "Measured performance architecture from indexed data and cached formulas through workers, guards and lazy presentation chunks.",
        "flow",
        (
            ("Index", "Map • Set • taxonomy"),
            ("Compile", "bounded formula LRU"),
            ("Dispatch", "dedicated workers"),
            ("Compute", "unchanged equations"),
            ("Validate", "finite + equivalent"),
            ("Present", "lazy views + chunks"),
        ),
        ("Measure first", "Same-run comparison", "No scientific approximation"),
    ),
    Visual(
        "resindb-formula-cache.svg", "formula-cache-title",
        "Bounded formula compilation cache", "Exact expressions reuse safe evaluators without dynamic code execution",
        "Formula cache flow with exact-expression lookup, LRU promotion, whitelist parsing, evaluation and bounded eviction.",
        "flow",
        (
            ("Expression", "exact source text"),
            ("LRU lookup", "256-entry bound"),
            ("Whitelist parse", "cache miss only"),
            ("Evaluator", "pure closure"),
            ("Calculate", "same numeric result"),
            ("Evict", "oldest entry"),
        ),
        ("No eval", "Failures not cached", "Cache can be cleared"),
    ),
    Visual(
        "resindb-indexed-lookup.svg", "indexed-lookup-title",
        "Indexed lookup and batch updates", "Replace repeated linear scans with reusable Map and Set indexes",
        "Indexed lookup architecture for category aliases, property labels, duplicate grade detection and batch cache positions.",
        "grid",
        (
            ("Category aliases", "exact Map + ordered fallback"),
            ("Property labels", "memoized key Map"),
            ("Duplicate grades", "normalized Set"),
            ("Batch cache", "ID → position Map"),
            ("IndexedDB", "single transactions"),
            ("Correctness", "legacy-equivalent tests"),
        ),
        ("O(1) average lookup", "O(n + k) batch path", "No data-model change"),
    ),
    Visual(
        "resindb-benchmark-loop.svg", "benchmark-loop-title",
        "Performance benchmark loop", "Baseline and candidate run on the same Linux runner and datasets",
        "Closed-loop benchmark process from frozen baseline through candidate optimization, correctness gates, repeat measurement and evidence publication.",
        "flow",
        (
            ("Freeze", "commit + runtime"),
            ("Baseline", "build + microbench"),
            ("Optimize", "measured hotspots"),
            ("Regress", "science + UI tests"),
            ("Measure", "same workload"),
            ("Publish", "JSON + report"),
        ),
        ("Relative thresholds", "Raw values retained", "No promotional claims"),
    ),
"""
if visual_anchor not in generator:
    raise SystemExit("visual generator insertion anchor is missing")
generator_path.write_text(generator.replace(visual_anchor, new_visuals + visual_anchor, 1), encoding="utf-8")

# README: measured performance architecture and 18 deterministic diagrams.
readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
performance_section = """## 性能架构与可重复基准

<p align="center">
  <img src="docs/assets/resindb-performance-data-flow.svg" alt="ResinDB Pro 从索引、公式缓存、Worker 计算、结果保护到延迟加载展示的高性能数据流" width="100%" />
</p>

本轮只落地经过同一 GitHub Linux runner 对比的低风险优化：公式编译采用 256 项有界 LRU；分类别名、属性标签、导入重复牌号和批量缓存位置使用 `Map`/`Set` 索引；大于 1 MB 的 CSV/TXT 允许 Papa Parse 使用 Worker；构建按 React、ECharts、图表、导出、Markdown、UI 和数据工具拆分共享 chunk。科学公式、单位、输入边界和有限数值检查保持不变。

<p align="center">
  <img src="docs/assets/resindb-formula-cache.svg" alt="白名单公式编译结果通过 256 项有界 LRU 复用并保持数值等价的流程" width="100%" />
</p>

公式缓存仅以完整表达式文本为键。解析失败不会进入缓存；缓存可在测试中清空；`eval`、`new Function` 和任意代码执行仍被禁止。

<p align="center">
  <img src="docs/assets/resindb-indexed-lookup.svg" alt="分类、属性、重复牌号和批量缓存更新使用 Map 与 Set 索引的结构" width="100%" />
</p>

索引将精确分类和属性查询的平均复杂度由线性扫描降为 O(1)，将导入重复检测由 O(n×m) 调整为 O(n+m)，将批量缓存位置解析由 O(k×n) 调整为 O(n+k)。分类的模糊包含匹配仍保留原顺序作为兼容回退。

<p align="center">
  <img src="docs/assets/resindb-benchmark-loop.svg" alt="冻结基线、应用优化、正确性回归、相同工作负载复测和发布证据组成的性能闭环" width="100%" />
</p>

```bash
npm run test:performance
npm run benchmark:performance
```

性能测试使用宽松相对阈值，并同时核对旧逻辑与优化逻辑的结果。实际构建体积、运行时间、微基准和依赖更新矩阵见 [`reports/performance-audit-20260727/FINAL.md`](reports/performance-audit-20260727/FINAL.md)。Vite 8/Rolldown、ECharts 按需导入和 transferable `ArrayBuffer` 因涉及构建器迁移、完整图表组件枚举或数据所有权改变，本轮只记录为后续独立验证项。

"""
anchor = "## 典型科研工作流\n"
if anchor not in readme:
    raise SystemExit("README performance section anchor is missing")
readme = readme.replace(anchor, performance_section + anchor, 1)
readme = readme.replace("验证 **14 张确定性功能图**", "验证 **18 张确定性功能图**")
readme = readme.replace("## 十四张可复现功能图", "## 十八张可复现功能图")
readme = readme.replace("本 README 的**十四张**功能图", "本 README 的**十八张**功能图")
readme = readme.replace("README 是否引用全部 14 张图", "README 是否引用全部 18 张图")
readme = readme.replace("assets/                    # 14 张确定性 SVG", "assets/                    # 18 张确定性 SVG")
readme = readme.replace("npm run test:science\nnpm run test:coverage", "npm run test:science\nnpm run test:performance\nnpm run test:coverage")
readme_path.write_text(readme, encoding="utf-8")

# Validation contract.
validation_path = ROOT / "docs/VALIDATION.md"
validation = validation_path.read_text(encoding="utf-8")
validation = validation.replace("exact 14-image inventory", "exact 18-image inventory")
validation = validation.replace("verified 14 deterministic README visuals", "verified 18 deterministic README visuals")
validation = validation.replace("the visual inventory must contain all 14 files", "the visual inventory must contain all 18 files")
validation = validation.replace(
    "8. `npm run test:science` passes the isolated scientific/data/worker group.\n9. `npm run test:coverage`",
    "8. `npm run test:science` passes the isolated scientific/data/worker group.\n9. `npm run test:performance` verifies formula-cache correctness, indexed lookup equivalence and broad relative performance limits.\n10. `npm run test:coverage`",
)
validation = validation.replace("10. `npm run build`", "11. `npm run build`")
validation = validation.replace("11. `npm run smoke`", "12. `npm run smoke`")
validation = validation.replace("12. `npm run test:ui`", "13. `npm run test:ui`")
validation = validation.replace("13. `npm run audit:all`", "14. `npm run audit:all`")
validation = validation.replace("14. `git diff --check`", "15. `git diff --check`")
validation = validation.replace("15. The remote branch inventory", "16. The remote branch inventory")
performance_contract = """## Performance acceptance contract

Performance changes must preserve mathematical outputs and data semantics. `npm run test:performance` compares cached and uncached formula evaluation, legacy and indexed category lookup, nested and Set-based duplicate detection, and linear and Map-based batch positions. Thresholds are deliberately relative and broad so shared CI runners detect regressions without pretending to provide laboratory-grade timing. `npm run benchmark:performance` writes machine-readable evidence under `reports/performance-audit-20260727/`.

The current optimized paths are a 256-entry exact-expression LRU, precomputed category/property lookup maps, normalized duplicate-grade sets, batch ID-position maps, Papa Parse Worker use for files of at least 1 MB, and explicit vendor chunk groups. Worker transferable buffers and ECharts tree-shakable imports remain separate migration candidates until ownership and complete component usage are benchmarked.

"""
contract_anchor = "## Dependency audit contract\n"
if contract_anchor not in validation:
    raise SystemExit("validation performance contract anchor is missing")
validation = validation.replace(contract_anchor, performance_contract + contract_anchor, 1)
validation_path.write_text(validation, encoding="utf-8")

# Repository documentation validator: 18 visuals, performance scripts, ESLint flat config dependency and temporary hygiene.
validator_path = ROOT / "scripts/validate-repository-docs.py"
validator = validator_path.read_text(encoding="utf-8")
visual_tuple_anchor = '    "resindb-security-deployment.svg",\n'
additional_visuals = (
    '    "resindb-performance-data-flow.svg",\n'
    '    "resindb-formula-cache.svg",\n'
    '    "resindb-indexed-lookup.svg",\n'
    '    "resindb-benchmark-loop.svg",\n'
)
if additional_visuals.strip() not in validator:
    validator = validator.replace(visual_tuple_anchor, additional_visuals + visual_tuple_anchor, 1)
validator = validator.replace('"audit:prod": "npm audit --omit=dev --audit-level=high",\n', '"audit:prod": "npm audit --omit=dev --audit-level=high",\n        "test:performance": "vitest run tests/performance --pool=forks --maxWorkers=1",\n        "benchmark:performance": "node scripts/run-performance-benchmark.mjs",\n', 1)
validator = validator.replace('        "eslint": "^10.8.0",\n', '        "@eslint/js": "^10.0.1",\n        "eslint": "^10.8.0",\n', 1)
validator = validator.replace('    if "十四张" not in readme_text and "14 张" not in readme_text:\n        fail("README must state that the visual system contains 14 diagrams")\n', '    if "十八张" not in readme_text and "18 张" not in readme_text:\n        fail("README must state that the visual system contains 18 diagrams")\n')
validator = validator.replace('    if "npm run audit:all" not in ci:\n        fail("permanent CI must execute npm run audit:all")\n', '    if "npm run audit:all" not in ci:\n        fail("permanent CI must execute npm run audit:all")\n    if "npm run test:performance" not in ci:\n        fail("permanent CI must execute npm run test:performance")\n')
forbidden_anchor = '    "docs/MIGRATION_v3.1.0.md",\n'
forbidden = (
    '    ".github/ultimate-performance-optimization-20260727.trigger",\n'
    '    ".github/workflows/ultimate-performance-optimization-20260727.yml",\n'
    '    "scripts/apply-performance-optimization.py",\n'
    '    "scripts/run-ultimate-performance-optimization.sh",\n'
    '    ".github/eslint10-semantic-remediation-20260727.trigger",\n'
    '    ".github/workflows/eslint10-semantic-remediation-20260727.yml",\n'
    '    "scripts/fix-eslint10-findings.py",\n'
    '    "reports/performance-audit-20260727/gate-diagnostic.txt",\n'
    '    "reports/performance-audit-20260727/eslint10-remediation.txt",\n'
)
if '"scripts/run-ultimate-performance-optimization.sh"' not in validator:
    validator = validator.replace(forbidden_anchor, forbidden + forbidden_anchor, 1)
validator_path.write_text(validator, encoding="utf-8")

print("applied measured performance optimization candidate")
