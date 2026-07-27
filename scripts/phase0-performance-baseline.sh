#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
OUT="$ROOT/reports/performance-audit-20260727"
LOGS="$OUT/logs"
mkdir -p "$LOGS"

printf '%s\n' "${GITHUB_SHA:-unknown}" > "$OUT/input-commit.txt"
{
  echo "node=$(node --version)"
  echo "npm=$(npm --version)"
  echo "python=$(python3 --version 2>&1)"
  echo "runner=${RUNNER_OS:-unknown}"
} > "$OUT/runtime.txt"

npm install --package-lock-only --ignore-scripts --no-audit > "$LOGS/lockfile.log" 2>&1
npm ci > "$LOGS/npm-ci.log" 2>&1
npm run lint > "$LOGS/lint.log" 2>&1
npm run typecheck > "$LOGS/typecheck.log" 2>&1

find src tests scripts -type f -print | LC_ALL=C sort > "$OUT/inventory.txt"
{
  echo '# Performance-oriented source scan'
  echo
  grep -RInE --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    'new Worker|postMessage\(|structuredClone|JSON\.stringify|Array\.from|\.filter\(|\.sort\(|\.find\(|getAll\(|transaction\(|Papa\.parse|html2canvas|jsPDF|React\.lazy|lazy\(' \
    src scripts tests || true
} > "$OUT/hotspots.txt"

set +e
npm outdated --json > "$OUT/npm-outdated.json" 2> "$LOGS/npm-outdated.stderr"
outdated_code=$?
set -e
printf '%s\n' "$outdated_code" > "$OUT/npm-outdated.exit"

/usr/bin/time -f 'elapsed_seconds=%e\nmax_rss_kb=%M\nuser_seconds=%U\nsystem_seconds=%S' \
  -o "$OUT/build-time.txt" npm run build > "$LOGS/build.log" 2>&1

node <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const buf = fs.readFileSync(full);
      files.push({
        path: path.relative(dist, full).replaceAll('\\', '/'),
        bytes: buf.length,
        gzipBytes: zlib.gzipSync(buf, { level: 9 }).length,
      });
    }
  }
}
walk(dist);
files.sort((a, b) => b.bytes - a.bytes);
const payload = {
  fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  totalGzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
  largestFiles: files.slice(0, 20),
};
fs.writeFileSync('reports/performance-audit-20260727/bundle-baseline.json', JSON.stringify(payload, null, 2) + '\n');
NODE

cat > tests/performance-phase0.test.ts <<'TS'
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { compileFormulaExpression } from '@/lib/formula/expressionParser';
import { categoryIdFromText, categoryNameFromId } from '@/data/resinData';

function measure(name: string, iterations: number, task: () => void) {
  for (let index = 0; index < Math.min(iterations, 2_000); index += 1) task();
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) task();
  const elapsedMs = performance.now() - start;
  return { name, iterations, elapsedMs, operationsPerSecond: iterations / (elapsedMs / 1_000) };
}

describe('phase-zero performance baseline', () => {
  it('records deterministic formula and category lookup baselines', () => {
    const properties = { density: 0.95, temperature: 30, modulus: 1200 };
    let checksum = 0;
    const metrics = [
      measure('formula-compile', 20_000, () => {
        const evaluator = compileFormulaExpression('p["density"] * 1000 + sqrt(p["modulus"])');
        checksum += evaluator(properties);
      }),
      measure('formula-evaluate-precompiled', 200_000, (() => {
        const evaluator = compileFormulaExpression('p["density"] * 1000 + sqrt(p["modulus"])');
        return () => { checksum += evaluator(properties); };
      })()),
      measure('category-id-lookup', 100_000, () => {
        checksum += categoryIdFromText('high density polyethylene').length;
      }),
      measure('category-name-lookup', 100_000, () => {
        checksum += categoryNameFromId('sub_hdpe').length;
      }),
    ];
    expect(Number.isFinite(checksum)).toBe(true);
    fs.mkdirSync('reports/performance-audit-20260727', { recursive: true });
    fs.writeFileSync(
      'reports/performance-audit-20260727/microbenchmark-baseline.json',
      JSON.stringify({ checksum, metrics }, null, 2) + '\n',
    );
  });
});
TS

npx vitest run tests/performance-phase0.test.ts --pool=forks --maxWorkers=1 > "$LOGS/microbenchmark.log" 2>&1
rm -f tests/performance-phase0.test.ts
rm -f reports/eslint10-diagnostic-20260727.txt

python3 <<'PY'
from __future__ import annotations
import json
from pathlib import Path

out = Path('reports/performance-audit-20260727')
runtime = dict(
    line.split('=', 1)
    for line in (out / 'runtime.txt').read_text(encoding='utf-8').splitlines()
    if '=' in line
)
bundle = json.loads((out / 'bundle-baseline.json').read_text(encoding='utf-8'))
bench = json.loads((out / 'microbenchmark-baseline.json').read_text(encoding='utf-8'))
outdated = json.loads((out / 'npm-outdated.json').read_text(encoding='utf-8') or '{}')
summary = {
    'schemaVersion': 1,
    'phase': 'baseline',
    'inputCommit': (out / 'input-commit.txt').read_text().strip(),
    'runtime': runtime,
    'lint': 'success',
    'typecheck': 'success',
    'dependencyOutdatedCount': len(outdated),
    'bundle': bundle,
    'microbenchmarks': bench['metrics'],
}
(out / 'baseline-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lines = [
    '# ResinDB Pro performance baseline', '',
    f"- Input commit: `{summary['inputCommit']}`",
    f"- Runtime: `{runtime.get('node')}` / `{runtime.get('npm')}` / `{runtime.get('python')}` / `{runtime.get('runner')}`",
    '- ESLint: **PASS**',
    '- TypeScript: **PASS**',
    f"- Outdated dependency entries reported by npm: **{len(outdated)}**", '',
    '## Bundle baseline', '',
    f"- Files: **{bundle['fileCount']}**",
    f"- Total bytes: **{bundle['totalBytes']}**",
    f"- Total gzip bytes: **{bundle['totalGzipBytes']}**", '',
    '| File | Bytes | Gzip bytes |', '|---|---:|---:|',
]
for item in bundle['largestFiles'][:12]:
    lines.append(f"| `{item['path']}` | {item['bytes']} | {item['gzipBytes']} |")
lines.extend(['', '## Microbenchmarks', '', '| Benchmark | Iterations | Elapsed ms | ops/s |', '|---|---:|---:|---:|'])
for item in bench['metrics']:
    lines.append(f"| `{item['name']}` | {item['iterations']} | {item['elapsedMs']:.3f} | {item['operationsPerSecond']:.0f} |")
(out / 'BASELINE.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
PY
