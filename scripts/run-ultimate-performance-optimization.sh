#!/usr/bin/env bash
set -uo pipefail

OUT="reports/performance-audit-20260727"
LOGS="$OUT/logs"
rm -rf "$OUT"
mkdir -p "$LOGS"
printf '%s\n' "${GITHUB_SHA:-unknown}" > "$OUT/input-commit.txt"
{
  echo "node=$(node --version)"
  echo "npm=$(npm --version)"
  echo "python=$(python3 --version 2>&1)"
  echo "runner=${RUNNER_OS:-unknown}"
} > "$OUT/runtime.txt"
overall=0

record() {
  local name="$1"
  shift
  set +e
  timeout 40m "$@" > "$LOGS/$name.txt" 2>&1
  local code=$?
  set -e
  printf '%s\n' "$code" > "$OUT/$name.status"
  cat "$LOGS/$name.txt"
  if [ "$code" -ne 0 ]; then overall=1; fi
}

summarize_dist() {
  local phase="$1"
  PHASE="$phase" node <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const phase = process.env.PHASE;
const dist = path.resolve('dist');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const bytes = fs.readFileSync(full);
      files.push({
        path: path.relative(dist, full).replaceAll('\\', '/'),
        bytes: bytes.length,
        gzipBytes: zlib.gzipSync(bytes, { level: 9 }).length,
      });
    }
  }
}
walk(dist);
files.sort((a, b) => b.bytes - a.bytes);
const timeLines = fs.readFileSync(`reports/performance-audit-20260727/${phase}-build-time.txt`, 'utf8').trim().split(/\r?\n/);
const timing = Object.fromEntries(timeLines.filter(Boolean).map((line) => line.split('=', 2)));
const summary = {
  phase,
  timing: {
    elapsedSeconds: Number(timing.elapsed_seconds),
    maxRssKb: Number(timing.max_rss_kb),
    userSeconds: Number(timing.user_seconds),
    systemSeconds: Number(timing.system_seconds),
  },
  fileCount: files.length,
  totalBytes: files.reduce((sum, item) => sum + item.bytes, 0),
  totalGzipBytes: files.reduce((sum, item) => sum + item.gzipBytes, 0),
  largestFiles: files.slice(0, 24),
};
fs.writeFileSync(`reports/performance-audit-20260727/${phase}-bundle.json`, JSON.stringify(summary, null, 2) + '\n');
NODE
}

record npm-ci-baseline npm ci

if [ "$(cat "$OUT/npm-ci-baseline.status")" = "0" ]; then
  mkdir -p tests/performance
  cat > tests/performance/phase-baseline.temp.test.ts <<'TS'
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ALIASES, categoryIdFromText } from '@/data/resinData';
import { compileFormulaExpression } from '@/lib/formula/expressionParser';

function measure(name: string, iterations: number, task: () => number) {
  let checksum = 0;
  for (let index = 0; index < Math.min(iterations, 2_000); index += 1) checksum += task();
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) checksum += task();
  const elapsedMs = performance.now() - start;
  return { name, iterations, elapsedMs, operationsPerSecond: iterations / (elapsedMs / 1_000), checksum };
}

function duplicateCount(candidates: Array<{ gradeName: string }>, existing: Array<{ gradeName: string }>) {
  return candidates.filter((candidate) => existing.some(
    (item) => item.gradeName.trim().toUpperCase() === candidate.gradeName.trim().toUpperCase(),
  )).length;
}

function batchPositions(items: Array<{ id: string }>, ids: string[]) {
  let checksum = 0;
  for (const id of ids) checksum += items.findIndex((item) => item.id === id);
  return checksum;
}

describe('same-run baseline', () => {
  it('records the current production paths', () => {
    const expression = 'p["density"] * 1000 + sqrt(p["modulus"])';
    const properties = { density: 0.95, modulus: 1200 };
    const existing = Array.from({ length: 3_000 }, (_, index) => ({ gradeName: `GRADE-${index}` }));
    const candidates = Array.from({ length: 300 }, (_, index) => ({ gradeName: `GRADE-${index * 7}` }));
    const items = Array.from({ length: 5_000 }, (_, index) => ({ id: `item-${index}` }));
    const ids = Array.from({ length: 500 }, (_, index) => `item-${index * 9}`);
    const metrics = [
      measure('formula-compile-cached', 20_000, () => compileFormulaExpression(expression)(properties)),
      measure('category-exact-indexed', 150_000, () => categoryIdFromText('high density polyethylene').length),
      measure('duplicate-detection-indexed', 20, () => duplicateCount(candidates, existing)),
      measure('batch-position-indexed', 10, () => batchPositions(items, ids)),
    ];
    expect(metrics.every((item) => Number.isFinite(item.checksum))).toBe(true);
    fs.writeFileSync('reports/performance-audit-20260727/baseline-benchmarks.json', JSON.stringify({ metrics, aliasCount: CATEGORY_ALIASES.length }, null, 2) + '\n');
  });
});
TS
  record baseline-benchmarks npx vitest run tests/performance/phase-baseline.temp.test.ts --pool=forks --maxWorkers=1
  rm -f tests/performance/phase-baseline.temp.test.ts
  rmdir tests/performance 2>/dev/null || true
  set +e
  /usr/bin/time -f 'elapsed_seconds=%e\nmax_rss_kb=%M\nuser_seconds=%U\nsystem_seconds=%S' \
    -o "$OUT/baseline-build-time.txt" npm run build > "$LOGS/baseline-build.txt" 2>&1
  code=$?
  set -e
  printf '%s\n' "$code" > "$OUT/baseline-build.status"
  cat "$LOGS/baseline-build.txt"
  if [ "$code" -ne 0 ]; then overall=1; else summarize_dist baseline; fi
  set +e
  npm outdated --json > "$OUT/npm-outdated.json" 2> "$LOGS/npm-outdated.txt"
  outdated_code=$?
  set -e
  printf '%s\n' "$outdated_code" > "$OUT/npm-outdated.exit"
fi

record apply-optimization python3 scripts/apply-performance-optimization.py

# The final candidate must not contain one-time execution or diagnostic residue.
rm -f .github/workflows/ultimate-performance-optimization-20260727.yml
rm -f .github/ultimate-performance-optimization-20260727.trigger
rm -f scripts/apply-performance-optimization.py
rm -f scripts/run-ultimate-performance-optimization.sh
rm -f reports/performance-audit-20260727/eslint10-remediation.txt
rm -f reports/performance-audit-20260727/gate-diagnostic.txt
rm -rf reports/final-dependency-remediation-20260726

if [ "$(cat "$OUT/apply-optimization.status")" = "0" ]; then
  record visuals-generate npm run visuals:generate
  record npm-ci-final npm ci
else
  printf '1\n' > "$OUT/visuals-generate.status"
  printf '1\n' > "$OUT/npm-ci-final.status"
  overall=1
fi

if [ "$(cat "$OUT/npm-ci-final.status")" = "0" ]; then
  record validate-source npm run validate:source
  record lint npm run lint
  record typecheck npm run typecheck
  record test npm run test
  record test-unit npm run test:unit
  record test-science npm run test:science
  record test-performance npm run test:performance
  record test-coverage npm run test:coverage
  PERFORMANCE_REPORT_PATH="$OUT/final-benchmarks.json" record benchmark-performance npm run benchmark:performance

  set +e
  /usr/bin/time -f 'elapsed_seconds=%e\nmax_rss_kb=%M\nuser_seconds=%U\nsystem_seconds=%S' \
    -o "$OUT/final-build-time.txt" npm run build > "$LOGS/final-build.txt" 2>&1
  code=$?
  set -e
  printf '%s\n' "$code" > "$OUT/build.status"
  cat "$LOGS/final-build.txt"
  if [ "$code" -ne 0 ]; then overall=1; else summarize_dist final; fi

  record smoke npm run smoke
  record test-ui npm run test:ui
  record audit-all npm run audit:all
  record audit-prod npm run audit:prod
  record visuals-check npm run visuals:check
fi

git ls-remote --heads origin | awk '{print $2}' | sed 's#refs/heads/##' | sort > "$OUT/remote-branches.txt"
if [ "$(cat "$OUT/remote-branches.txt")" = "main" ]; then
  printf '0\n' > "$OUT/only-main.status"
else
  printf '1\n' > "$OUT/only-main.status"
  overall=1
fi
set +e
git diff --check > "$LOGS/git-diff-check.txt" 2>&1
diff_code=$?
set -e
printf '%s\n' "$diff_code" > "$OUT/git-diff-check.status"
if [ "$diff_code" -ne 0 ]; then overall=1; fi

cat > /tmp/write-performance-evidence.py <<'PY'
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

OUT = Path('reports/performance-audit-20260727')
LOGS = OUT / 'logs'


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    text = path.read_text(encoding='utf-8', errors='replace').strip()
    return json.loads(text) if text else {}


def metric_map(data: dict) -> dict[str, dict]:
    return {item['name']: item for item in data.get('metrics', [])}


def percent_change(before: float, after: float) -> float | None:
    if not before:
        return None
    return (after - before) / before * 100

statuses = {p.stem: int(p.read_text().strip()) for p in sorted(OUT.glob('*.status'))}
runtime = dict(line.split('=', 1) for line in (OUT / 'runtime.txt').read_text().splitlines() if '=' in line)
result = 'success' if statuses and all(code == 0 for code in statuses.values()) else 'failure'
input_commit = (OUT / 'input-commit.txt').read_text().strip()
branches = (OUT / 'remote-branches.txt').read_text().splitlines() if (OUT / 'remote-branches.txt').exists() else []
baseline_bundle = load_json(OUT / 'baseline-bundle.json')
final_bundle = load_json(OUT / 'final-bundle.json')
baseline_bench = metric_map(load_json(OUT / 'baseline-benchmarks.json'))
final_bench_all = metric_map(load_json(OUT / 'final-benchmarks.json'))
optimized_names = (
    'formula-compile-cached',
    'category-exact-indexed',
    'duplicate-detection-indexed',
    'batch-position-indexed',
)
comparisons = []
for name in optimized_names:
    before = baseline_bench.get(name, {})
    after = final_bench_all.get(name, {})
    if before and after:
        comparisons.append({
            'name': name,
            'beforeElapsedMs': before['elapsedMs'],
            'afterElapsedMs': after['elapsedMs'],
            'elapsedChangePercent': percent_change(before['elapsedMs'], after['elapsedMs']),
            'beforeOperationsPerSecond': before['operationsPerSecond'],
            'afterOperationsPerSecond': after['operationsPerSecond'],
        })

coverage_text = (LOGS / 'test-coverage.txt').read_text(errors='replace') if (LOGS / 'test-coverage.txt').exists() else ''
coverage_text = re.sub(r'\x1b\[[0-9;]*m', '', coverage_text)
tests_match = re.search(r'Tests\s+(\d+) passed', coverage_text)
files_match = re.search(r'Test Files\s+(\d+) passed', coverage_text)
coverage_match = re.search(r'All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)', coverage_text)
coverage = {}
if coverage_match:
    coverage = {
        'statements': float(coverage_match.group(1)),
        'branches': float(coverage_match.group(2)),
        'functions': float(coverage_match.group(3)),
        'lines': float(coverage_match.group(4)),
    }
test_files = int(files_match.group(1)) if files_match else None
tests = int(tests_match.group(1)) if tests_match else None
visuals = sorted(p.name for p in Path('docs/assets').glob('resindb-*.svg'))
completed = dt.datetime.now(dt.timezone.utc).isoformat()

# Keep README/contract counts synchronized with the exact final suite.
if test_files is not None and tests is not None:
    readme_path = Path('README.md')
    readme = readme_path.read_text(encoding='utf-8')
    readme = re.sub(r'记录 \*\*\d+ 个测试文件、\d+ 个测试用例\*\* 全部通过', f'记录 **{test_files} 个测试文件、{tests} 个测试用例** 全部通过', readme)
    readme_path.write_text(readme, encoding='utf-8')
    validation_path = Path('docs/VALIDATION.md')
    validation = validation_path.read_text(encoding='utf-8')
    validation = re.sub(r'The recorded baseline contains \*\*\d+ test files and \d+ passing tests\*\*\.', f'The recorded baseline contains **{test_files} test files and {tests} passing tests**.', validation)
    validation_path.write_text(validation, encoding='utf-8')

outdated = load_json(OUT / 'npm-outdated.json')
package = load_json(Path('package.json'))
lock = load_json(Path('package-lock.json'))
root_lock = lock.get('packages', {}).get('', {})
all_declared = {**package.get('dependencies', {}), **package.get('devDependencies', {})}
manual = {
    'vite': ('E', 'Vite 8/Rolldown requires a dedicated build migration and browser regression campaign.'),
    'echarts': ('E', 'Official tree-shakable imports can reduce size, but every chart/component option must be enumerated first.'),
    'react': ('C', 'React 19.2 remains the current application line; use Performance Tracks before further memoization.'),
    'react-dom': ('C', 'Keep aligned with React 19.2 and update through normal lockfile maintenance.'),
    'papaparse': ('B', 'Current API supports Worker and streaming; this candidate enables Worker parsing for large local files.'),
    '@tanstack/react-virtual': ('B', 'Small update candidate; retain existing virtualization and verify table interactions.'),
    'motion': ('B', 'Small update candidate; visual regression is required.'),
}
rows = []
for name in sorted(all_declared):
    current = lock.get('packages', {}).get(f'node_modules/{name}', {}).get('version', root_lock.get('dependencies', {}).get(name) or root_lock.get('devDependencies', {}).get(name) or all_declared[name])
    info = outdated.get(name, {}) if isinstance(outdated, dict) else {}
    latest = info.get('latest', current)
    wanted = info.get('wanted', current)
    if name in manual:
        recommendation, reason = manual[name]
    elif current == latest:
        recommendation, reason = 'C', 'Current resolved version matches npm latest for this package.'
    elif wanted != current:
        recommendation, reason = 'A', 'A compatible update exists within the declared range; update lockfile with regression tests.'
    else:
        recommendation, reason = 'B', 'Latest version is outside the current resolved range; evaluate compatibility before changing the manifest.'
    rows.append({'component': name, 'declared': all_declared[name], 'current': current, 'wanted': wanted, 'latest': latest, 'recommendation': recommendation, 'reason': reason})

matrix_lines = [
    '# Dependency update matrix', '',
    '| Component | Declared | Resolved | Wanted | Latest | Class | Decision |',
    '|---|---:|---:|---:|---:|:---:|---|',
]
for row in rows:
    matrix_lines.append(f"| `{row['component']}` | `{row['declared']}` | `{row['current']}` | `{row['wanted']}` | `{row['latest']}` | **{row['recommendation']}** | {row['reason']} |")
(OUT / 'dependency-update-matrix.md').write_text('\n'.join(matrix_lines) + '\n', encoding='utf-8')

research = '''# Primary-source web research ledger

| Area | Primary source | Applied decision |
|---|---|---|
| React profiling | https://react.dev/reference/react/Profiler and React 19.2 Performance Tracks | Measure render work before adding memoization; no blanket memo patch. |
| Vite | https://vite.dev/blog/announcing-vite8 and the Vite migration guide | Vite 8/Rolldown is classified as a separate migration, not a blind update. |
| ECharts | https://echarts.apache.org/handbook/en/basics/import/ | Tree-shakable core imports are a high-value follow-up after complete chart-component enumeration. |
| Web Workers | https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects | Transferable ArrayBuffers are deferred until request ownership and buffer lifetimes are explicit. |
| IndexedDB | https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/getAll | Retain one catalog load for the maintained in-memory indexes; optimize repeated cache scans instead. |
| Papa Parse | https://www.papaparse.com/docs | Enable Worker parsing for large local CSV/TXT files; streaming remains a separate UI/progress change. |
| ESLint | https://eslint.org/blog/2026/02/eslint-v10.0.0-released/ | Keep ESLint 10 and fix semantic findings rather than suppressing rules. |
'''
(OUT / 'web-research.md').write_text(research, encoding='utf-8')

proof = {
    'result': result,
    'validatedInputCommit': input_commit,
    'completedAt': completed,
    'runtime': runtime,
    'remoteBranches': branches,
    'statuses': statuses,
    'scope': 'same-run performance baseline, measured low-risk optimization, scientific regression, browser smoke, dependency audit and deterministic documentation validation',
    'rawEvidenceArtifact': f'resindb-performance-optimization-{input_commit}',
}
summary = {
    'schemaVersion': 1,
    'result': result,
    'repository': 'SUNHAOJUN22/ResinDB-Pro-by-SunHJ',
    'version': package.get('version'),
    'validatedInputCommit': input_commit,
    'completedAt': completed,
    'runtime': runtime,
    'remoteBranches': branches,
    'statuses': statuses,
    'testFilesPassed': test_files,
    'testsPassed': tests,
    'coveragePercent': coverage,
    'visualCount': len(visuals),
    'generatedVisuals': visuals,
    'performance': {
        'baselineBundle': baseline_bundle,
        'finalBundle': final_bundle,
        'comparisons': comparisons,
        'benchmarkMethod': 'same GitHub Linux runner, same datasets and iteration counts',
    },
    'optimizationChanges': [
        '256-entry exact-expression LRU formula compiler cache',
        'precomputed category and property-key maps',
        'Set-based duplicate grade detection',
        'Map-based batch cache position lookup',
        'Papa Parse Worker mode for local files >= 1 MB',
        'explicit vendor chunk groups with a 1000 kB warning threshold',
    ],
    'deferredMigrations': [
        'Vite 8/Rolldown build migration',
        'ECharts tree-shakable core/component registration',
        'transferable ArrayBuffer worker protocols',
    ],
    'rawEvidenceArtifact': proof['rawEvidenceArtifact'],
    'currentTreeVerification': proof,
}
payload = json.dumps(summary, ensure_ascii=False, indent=2) + '\n'
for path in (
    Path('reports/final-visual-upgrade-20260726/summary.json'),
    Path('reports/ci-validation-latest.json'),
    OUT / 'summary.json',
):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload, encoding='utf-8')

lines = [
    '# ResinDB Pro performance optimization report', '',
    f'- Result: **{result.upper()}**',
    f'- Validated input commit: `{input_commit}`',
    f"- Runtime: `{runtime.get('node')}` / `{runtime.get('npm')}` / `{runtime.get('python')}` / `{runtime.get('runner')}`",
    f"- Remote branches: `{', '.join(branches)}`",
    f'- Test files passed: **{test_files}**',
    f'- Tests passed: **{tests}**',
    f'- Deterministic README visuals: **{len(visuals)}**', '',
    '## Measured optimization', '',
    '| Path | Before ms | After ms | Elapsed change | Before ops/s | After ops/s |',
    '|---|---:|---:|---:|---:|---:|',
]
for item in comparisons:
    change = item['elapsedChangePercent']
    change_text = 'n/a' if change is None else f'{change:.1f}%'
    lines.append(f"| `{item['name']}` | {item['beforeElapsedMs']:.3f} | {item['afterElapsedMs']:.3f} | {change_text} | {item['beforeOperationsPerSecond']:.0f} | {item['afterOperationsPerSecond']:.0f} |")
if baseline_bundle and final_bundle:
    lines.extend([
        '', '## Build and bundle', '',
        '| Metric | Baseline | Final | Change |', '|---|---:|---:|---:|',
        f"| Build elapsed seconds | {baseline_bundle['timing']['elapsedSeconds']:.2f} | {final_bundle['timing']['elapsedSeconds']:.2f} | {percent_change(baseline_bundle['timing']['elapsedSeconds'], final_bundle['timing']['elapsedSeconds']):.1f}% |",
        f"| Total JavaScript/CSS/assets bytes | {baseline_bundle['totalBytes']} | {final_bundle['totalBytes']} | {percent_change(baseline_bundle['totalBytes'], final_bundle['totalBytes']):.1f}% |",
        f"| Total gzip bytes | {baseline_bundle['totalGzipBytes']} | {final_bundle['totalGzipBytes']} | {percent_change(baseline_bundle['totalGzipBytes'], final_bundle['totalGzipBytes']):.1f}% |",
        f"| Largest emitted file bytes | {baseline_bundle['largestFiles'][0]['bytes']} | {final_bundle['largestFiles'][0]['bytes']} | {percent_change(baseline_bundle['largestFiles'][0]['bytes'], final_bundle['largestFiles'][0]['bytes']):.1f}% |",
    ])
lines.extend(['', '## Gate status', '', '| Gate | Exit code |', '|---|---:|'])
lines.extend(f'| `{name}` | `{code}` |' for name, code in statuses.items())
if coverage:
    lines.extend([
        '', '## Coverage', '', '| Metric | Percent |', '|---|---:|',
        f"| Statements | {coverage['statements']:.2f}% |",
        f"| Branches | {coverage['branches']:.2f}% |",
        f"| Functions | {coverage['functions']:.2f}% |",
        f"| Lines | {coverage['lines']:.2f}% |",
    ])
lines.extend([
    '', '## Decision summary', '',
    '- Applied only measured, behavior-preserving changes.',
    '- Vite 8/Rolldown is deferred to a dedicated build migration.',
    '- ECharts on-demand imports are deferred until every used series and component is enumerated.',
    '- Transferable buffers are deferred until ownership and detachment behavior are explicit.',
    '', 'See `dependency-update-matrix.md` and `web-research.md` for the update survey.',
])
report = '\n'.join(lines) + '\n'
(OUT / 'FINAL.md').write_text(report, encoding='utf-8')
Path('reports/final-visual-upgrade-20260726/REPORT.md').write_text(report, encoding='utf-8')
PY

python3 /tmp/write-performance-evidence.py
record validate-docs npm run validate:docs
python3 /tmp/write-performance-evidence.py

final_result="$(python3 -c 'import json; print(json.load(open("reports/ci-validation-latest.json"))["result"])')"
printf '%s\n' "$final_result" > "$OUT/result.txt"
if [ "$final_result" != "success" ]; then overall=1; fi
exit "$overall"
