import fs from 'node:fs';
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
      fs.writeFileSync(output, JSON.stringify({ metrics }, null, 2) + '
');
    }
  });
});
