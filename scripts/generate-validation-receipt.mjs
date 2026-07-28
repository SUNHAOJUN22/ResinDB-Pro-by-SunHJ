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

const [tests, coverage, build, ui, prodAudit, fullAudit, ciGates, context] = await Promise.all([
  readJson('test-results.json'),
  readJson('coverage-summary.json'),
  readJson('build-metrics.json'),
  readJson('ui-smoke-manifest.json'),
  readJson('npm-audit-prod.json'),
  readJson('npm-audit-all.json'),
  readJson('ci-gates.json'),
  readJson('ci-context.json', { sha: 'local-worktree', repository: 'local' }),
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

const checks = {
  coreGates: ciGates?.status === 'PASS',
  tests: Boolean(tests?.success) && tests?.numFailedTests === 0 && tests?.numTotalTests > 0,
  wholeSourceCoverage: Boolean(coverage?.scopeComplete) && coverage?.coverageScope === 'all-production-typescript',
  buildBudgets: Boolean(build?.entry && build?.echarts) &&
    build.entry.gzipBytes <= build.budgets.entryGzipBytes &&
    build.echarts.bytes <= build.budgets.echartsRawBytes,
  externalData: Number(build?.externalResinDataBytes ?? 0) > 0,
  uiEvidence: screenshotChecks.length >= 7 && screenshotChecks.every((entry) => entry.exists),
  productionAudit: noHighAuditFindings(prodAudit),
  completeAudit: noHighAuditFindings(fullAudit),
  singleMainBranch: branchProof.split(/\r?\n/).filter(Boolean).length === 1 && /refs\/heads\/main$/.test(branchProof),
};

const receipt = {
  schemaVersion: 1,
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
  uiScenes: screenshotChecks,
  branchProof,
};

await mkdir(artifacts, { recursive: true });
await writeFile(path.join(artifacts, 'validation-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Validation receipt: ${receipt.acceptance}`);
if (process.env.CI && receipt.acceptance !== 'PASS') process.exitCode = 1;
