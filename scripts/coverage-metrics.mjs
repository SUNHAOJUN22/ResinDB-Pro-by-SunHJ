import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'coverage', 'coverage-final.json');
const artifactDir = path.join(root, 'artifacts');
const sourceRoot = path.join(root, 'src');

function percentage(covered, total) {
  return total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2));
}

function summarizeCounter(counter) {
  const values = Object.values(counter);
  const covered = values.filter((value) => value > 0).length;
  return { covered, total: values.length, percent: percentage(covered, values.length) };
}

function summarizeBranches(branches) {
  const values = Object.values(branches).flat();
  const covered = values.filter((value) => value > 0).length;
  return { covered, total: values.length, percent: percentage(covered, values.length) };
}

async function countProductionSources(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) count += await countProductionSources(target);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) count += 1;
  }
  return count;
}

const coverage = JSON.parse(await readFile(sourcePath, 'utf8'));
const totals = {
  statements: { covered: 0, total: 0 },
  branches: { covered: 0, total: 0 },
  functions: { covered: 0, total: 0 },
  lines: { covered: 0, total: 0 },
};

for (const fileCoverage of Object.values(coverage)) {
  const statements = summarizeCounter(fileCoverage.s);
  const branches = summarizeBranches(fileCoverage.b);
  const functions = summarizeCounter(fileCoverage.f);
  const lineHits = new Map();
  for (const [statementId, count] of Object.entries(fileCoverage.s)) {
    const line = fileCoverage.statementMap[statementId]?.start?.line;
    if (line) lineHits.set(line, Math.max(lineHits.get(line) ?? 0, count));
  }
  const lines = summarizeCounter(Object.fromEntries(lineHits));
  for (const [name, metric] of Object.entries({ statements, branches, functions, lines })) {
    totals[name].covered += metric.covered;
    totals[name].total += metric.total;
  }
}

for (const metric of Object.values(totals)) metric.percent = percentage(metric.covered, metric.total);

const instrumentedSourceFileCount = Object.keys(coverage).length;
const productionSourceFileCount = await countProductionSources(sourceRoot);
const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  coverageScope: 'all-production-typescript',
  instrumentedSourceFileCount,
  productionSourceFileCount,
  scopeComplete: instrumentedSourceFileCount === productionSourceFileCount,
  thresholds: { statements: 24, branches: 12, functions: 14, lines: 24 },
  totals,
};

await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'coverage-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
if (!report.scopeComplete) {
  throw new Error(`Coverage scope incomplete: instrumented ${instrumentedSourceFileCount} of ${productionSourceFileCount} production source files`);
}
console.log(`Whole-source coverage (${productionSourceFileCount} files): ${totals.lines.percent}% lines, ${totals.statements.percent}% statements, ${totals.branches.percent}% branches, ${totals.functions.percent}% functions.`);
