import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const artifacts = path.join(root, 'artifacts');

async function readJson(name, fallback = null) {
  try { return JSON.parse(await readFile(path.join(artifacts, name), 'utf8')); }
  catch { return fallback; }
}
async function exists(name) {
  try { await access(path.join(artifacts, name)); return true; }
  catch { return false; }
}

const [
  tests,
  coverage,
  build,
  ui,
  prodAudit,
  fullAudit,
  ciGates,
  context,
  kmeansBenchmark,
  computeSurfaceAudit,
  scientificUiAudit,
] = await Promise.all([
  readJson('test-results.json'),
  readJson('coverage-summary.json'),
  readJson('build-metrics.json'),
  readJson('ui-smoke-manifest.json'),
  readJson('npm-audit-prod.json'),
  readJson('npm-audit-all.json'),
  readJson('ci-gates.json'),
  readJson('ci-context.json', { sha: 'local-worktree', repository: 'local' }),
  readJson('kmeans-backend-benchmark.json'),
  readJson('compute-surface-audit.json'),
  readJson('scientific-ui-audit.json'),
]);

let branchProof = '';
try { branchProof = (await readFile(path.join(artifacts, 'branch-proof.txt'), 'utf8')).trim(); } catch {}
const screenshotEntries = Object.entries(ui?.screenshots ?? {});
const screenshotChecks = await Promise.all(screenshotEntries.map(async ([scene, file]) => ({
  scene,
  file,
  exists: await exists(file),
})));

function noHighAuditFindings(audit) {
  const summary = audit?.metadata?.vulnerabilities;
  return Boolean(summary) && Number(summary.high ?? 0) === 0 && Number(summary.critical ?? 0) === 0;
}

function validKMeansBenchmark(report) {
  return report?.schemaVersion === 'kmeans-backend-benchmark-report-1.0.0'
    && report?.timingGate === 'informational-only'
    && report?.equivalence?.status === 'PASS'
    && Array.isArray(report?.cases)
    && report.cases.length > 0
    && report.cases.every((entry) => entry?.equivalence === 'PASS')
    && typeof report?.reportDigest === 'string'
    && /^[0-9a-f]{64}$/.test(report.reportDigest);
}

const checks = {
  coreGates: ciGates?.status === 'PASS',
  tests: Boolean(tests?.success) && tests?.numFailedTests === 0 && tests?.numTotalTests > 0,
  wholeSourceCoverage: Boolean(coverage?.scopeComplete) && coverage?.coverageScope === 'all-production-typescript',
  buildBudgets: Boolean(build?.entry && build?.echarts) &&
    build.entry.gzipBytes <= build.budgets.entryGzipBytes &&
    build.echarts.bytes <= build.budgets.echartsRawBytes,
  externalData: Number(build?.externalResinDataBytes ?? 0) > 0,
  uiEvidence: screenshotChecks.length >= 7 && screenshotChecks.every((entry) => entry.exists),
  kmeansBenchmarkEvidence: validKMeansBenchmark(kmeansBenchmark),
  computeSurface: computeSurfaceAudit?.acceptance === 'PASS'
    && computeSurfaceAudit?.catalogModules === computeSurfaceAudit?.workerFiles
    && computeSurfaceAudit?.workerFiles >= 26,
  scientificUi: scientificUiAudit?.acceptance === 'PASS',
  productionAudit: noHighAuditFindings(prodAudit),
  completeAudit: noHighAuditFindings(fullAudit),
  singleMainBranch: branchProof.split(/\r?\n/).filter(Boolean).length === 1 && /refs\/heads\/main$/.test(branchProof),
};

const receipt = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  repository: context.repository,
  sha: context.sha,
  acceptance: Object.values(checks).every(Boolean) ? 'PASS' : 'EVIDENCE_INCOMPLETE',
  checks,
  tests: tests ? {
    files: tests.testResults?.length ?? tests.numTotalTestSuites,
    total: tests.numTotalTests,
    passed: tests.numPassedTests,
    failed: tests.numFailedTests,
  } : null,
  coverage: coverage ? {
    scope: coverage.coverageScope,
    instrumentedSourceFileCount: coverage.instrumentedSourceFileCount,
    productionSourceFileCount: coverage.productionSourceFileCount,
    totals: coverage.totals,
  } : null,
  build: build ? {
    entryGzipBytes: build.entry?.gzipBytes,
    entryGzipBudgetBytes: build.budgets?.entryGzipBytes,
    echartsBytes: build.echarts?.bytes,
    echartsBudgetBytes: build.budgets?.echartsRawBytes,
    externalResinDataBytes: build.externalResinDataBytes,
  } : null,
  computeSurface: computeSurfaceAudit ? {
    acceptance: computeSurfaceAudit.acceptance,
    catalogModules: computeSurfaceAudit.catalogModules,
    workerFiles: computeSurfaceAudit.workerFiles,
    chartMappedModules: computeSurfaceAudit.chartMappedModules,
  } : null,
  scientificUi: scientificUiAudit ? {
    acceptance: scientificUiAudit.acceptance,
    chartFiles: scientificUiAudit.chartFiles,
    directEchartsInitFiles: scientificUiAudit.directEchartsInitFiles,
  } : null,
  kmeansBenchmark: kmeansBenchmark ? {
    schemaVersion: kmeansBenchmark.schemaVersion,
    runtime: kmeansBenchmark.benchmarkRuntime,
    mode: kmeansBenchmark.mode,
    timingGate: kmeansBenchmark.timingGate,
    equivalence: kmeansBenchmark.equivalence,
    crossoverAnalysis: kmeansBenchmark.crossoverAnalysis,
    environmentFingerprint: kmeansBenchmark.environment?.fingerprint,
    reportDigest: kmeansBenchmark.reportDigest,
  } : null,
  uiScenes: screenshotChecks,
  branchProof,
};

await mkdir(artifacts, { recursive: true });
await writeFile(path.join(artifacts, 'validation-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Validation receipt: ${receipt.acceptance}`);
if (process.env.CI && receipt.acceptance !== 'PASS') process.exitCode = 1;
