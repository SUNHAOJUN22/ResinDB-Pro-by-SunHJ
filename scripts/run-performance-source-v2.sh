#!/usr/bin/env bash
set -uo pipefail
OUT=reports/performance-audit-20260727
LOGS="$OUT/source-logs"
rm -rf "$LOGS"
mkdir -p "$LOGS"
overall=0
printf '%s\n' "${GITHUB_SHA:-unknown}" > "$OUT/source-input-commit.txt"

record() {
  local name="$1"; shift
  set +e
  timeout 40m "$@" > "$LOGS/$name.txt" 2>&1
  local code=$?
  set -e
  printf '%s\n' "$code" > "$OUT/source-$name.status"
  cat "$LOGS/$name.txt"
  if [ "$code" -ne 0 ]; then overall=1; fi
}

bundle_summary() {
  local phase="$1"
  PHASE="$phase" node <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const phase = process.env.PHASE;
const dist = path.resolve('dist');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const data = fs.readFileSync(full);
      files.push({ path: path.relative(dist, full).replaceAll('\\', '/'), bytes: data.length, gzipBytes: zlib.gzipSync(data, { level: 9 }).length });
    }
  }
}
walk(dist);
files.sort((a, b) => b.bytes - a.bytes);
fs.writeFileSync(`reports/performance-audit-20260727/source-${phase}-bundle.json`, JSON.stringify({ phase, fileCount: files.length, totalBytes: files.reduce((s, x) => s + x.bytes, 0), totalGzipBytes: files.reduce((s, x) => s + x.gzipBytes, 0), largestFiles: files.slice(0, 20) }, null, 2) + '\n');
NODE
}

record npm-ci-baseline npm ci
if [ "$(cat "$OUT/source-npm-ci-baseline.status")" = 0 ]; then
  mkdir -p tests/performance
  cat > tests/performance/source-baseline.temp.test.ts <<'TS'
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { categoryIdFromText } from '@/data/resinData';
import { compileFormulaExpression } from '@/lib/formula/expressionParser';
function measure(name: string, iterations: number, task: () => number) { let checksum = 0; for (let i = 0; i < Math.min(iterations, 2000); i++) checksum += task(); const start = performance.now(); for (let i = 0; i < iterations; i++) checksum += task(); const elapsedMs = performance.now() - start; return { name, iterations, elapsedMs, operationsPerSecond: iterations / (elapsedMs / 1000), checksum }; }
function duplicate(c: Array<{gradeName:string}>, e: Array<{gradeName:string}>) { return c.filter(x => e.some(y => y.gradeName.trim().toUpperCase() === x.gradeName.trim().toUpperCase())).length; }
function positions(items: Array<{id:string}>, ids: string[]) { let sum = 0; for (const id of ids) sum += items.findIndex(x => x.id === id); return sum; }
describe('source baseline', () => { it('records current paths', () => { const expression = 'p["density"] * 1000 + sqrt(p["modulus"])'; const props = { density: .95, modulus: 1200 }; const existing = Array.from({length:3000},(_,i)=>({gradeName:`GRADE-${i}`})); const candidates = Array.from({length:300},(_,i)=>({gradeName:`GRADE-${i*7}`})); const items = Array.from({length:5000},(_,i)=>({id:`item-${i}`})); const ids=Array.from({length:500},(_,i)=>`item-${i*9}`); const metrics=[measure('formula-compile-cached',20000,()=>compileFormulaExpression(expression)(props)),measure('category-exact-indexed',150000,()=>categoryIdFromText('high density polyethylene').length),measure('duplicate-detection-indexed',20,()=>duplicate(candidates,existing)),measure('batch-position-indexed',10,()=>positions(items,ids))]; expect(metrics.every(x=>Number.isFinite(x.checksum))).toBe(true); fs.writeFileSync('reports/performance-audit-20260727/source-baseline-benchmarks.json',JSON.stringify({metrics},null,2)+'\n'); }); });
TS
  record baseline-benchmark npx vitest run tests/performance/source-baseline.temp.test.ts --pool=forks --maxWorkers=1
  rm -f tests/performance/source-baseline.temp.test.ts
  rmdir tests/performance 2>/dev/null || true
  record baseline-build npm run build
  if [ "$(cat "$OUT/source-baseline-build.status")" = 0 ]; then bundle_summary baseline; fi
fi

record apply python3 scripts/apply-performance-source-v2.py
if [ "$(cat "$OUT/source-apply.status")" = 0 ]; then
  record npm-ci-final npm ci
else
  printf '1\n' > "$OUT/source-npm-ci-final.status"; overall=1
fi
if [ "$(cat "$OUT/source-npm-ci-final.status")" = 0 ]; then
  PERFORMANCE_REPORT_PATH="$OUT/source-final-benchmarks.json" record benchmark npm run benchmark:performance
  record lint npm run lint
  record typecheck npm run typecheck
  record test npm run test
  record test-performance npm run test:performance
  record build npm run build
  if [ "$(cat "$OUT/source-build.status")" = 0 ]; then bundle_summary final; fi
  record audit-all npm run audit:all
  record audit-prod npm run audit:prod
fi

set +e
git diff --check > "$LOGS/git-diff-check.txt" 2>&1
code=$?
set -e
printf '%s\n' "$code" > "$OUT/source-git-diff-check.status"
if [ "$code" -ne 0 ]; then overall=1; fi

python3 <<'PY'
from __future__ import annotations
import json
from pathlib import Path
out=Path('reports/performance-audit-20260727')
statuses={p.stem.removeprefix('source-'):int(p.read_text().strip()) for p in sorted(out.glob('source-*.status'))}
def load(name):
 p=out/name
 return json.loads(p.read_text()) if p.exists() else {}
base=load('source-baseline-benchmarks.json').get('metrics',[])
final=load('source-final-benchmarks.json').get('metrics',[])
base_map={x['name']:x for x in base}; final_map={x['name']:x for x in final}
comparisons=[]
for name in ('formula-compile-cached','category-exact-indexed','duplicate-detection-indexed','batch-position-indexed'):
 if name in base_map and name in final_map:
  b=base_map[name]; f=final_map[name]
  comparisons.append({'name':name,'beforeElapsedMs':b['elapsedMs'],'afterElapsedMs':f['elapsedMs'],'elapsedChangePercent':(f['elapsedMs']-b['elapsedMs'])/b['elapsedMs']*100})
result='success' if statuses and all(v==0 for v in statuses.values()) else 'failure'
payload={'schemaVersion':1,'phase':'source-optimization','result':result,'validatedInputCommit':(out/'source-input-commit.txt').read_text().strip(),'statuses':statuses,'comparisons':comparisons,'baselineBundle':load('source-baseline-bundle.json'),'finalBundle':load('source-final-bundle.json')}
(out/'SOURCE_PHASE.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
lines=['# Performance source optimization phase','',f'- Result: **{result.upper()}**','', '| Gate | Exit code |','|---|---:|']
lines += [f'| `{k}` | `{v}` |' for k,v in statuses.items()]
lines += ['', '## Same-run comparisons', '', '| Path | Before ms | After ms | Change |','|---|---:|---:|---:|']
for x in comparisons: lines.append(f"| `{x['name']}` | {x['beforeElapsedMs']:.3f} | {x['afterElapsedMs']:.3f} | {x['elapsedChangePercent']:.1f}% |")
(out/'SOURCE_PHASE.md').write_text('\n'.join(lines)+'\n')
(out/'source-result.txt').write_text(result+'\n')
PY
exit "$overall"
