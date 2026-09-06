/** Pure, fail-closed predicates shared by CI and the validation receipt. */
export const REQUIRED_CORE_GATES = Object.freeze([
  'docs', 'unicode-integrity', 'source-hygiene', 'governed-data',
  'compute-surface', 'scientific-ui', 'lint', 'typescript', 'regression',
  'isolated-unit', 'isolated-science-workers', 'whole-source-coverage',
  'build', 'http-smoke', 'chromium-ui', 'production-audit', 'complete-audit',
  'deterministic-exact-tracked-tree', 'receipt-contract',
  'dependency-graph', 'tracked-source-fixed-point',
]);

const commitPattern = /^[0-9a-f]{40}$/;
const count = (value) => Number.isSafeInteger(value) && value >= 0;

export function validateBranchProof(proof, expectedSha) {
  if (typeof proof !== 'string' || !commitPattern.test(expectedSha ?? '')) return false;
  const lines = proof.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) return false;
  const fields = lines[0].split(/\s+/);
  return fields.length === 2 && fields[0] === expectedSha && fields[1] === 'refs/heads/main';
}

export function validCiContext(context, expected = {}) {
  return context?.schemaVersion === 3
    && typeof context.repository === 'string'
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.repository)
    && typeof context.sha === 'string' && commitPattern.test(context.sha)
    && typeof context.ref === 'string'
    && (context.ref === 'refs/heads/main' || /^refs\/pull\/[1-9][0-9]*\/merge$/.test(context.ref))
    && count(context.runId) && context.runId > 0
    && count(context.runAttempt) && context.runAttempt > 0
    && ['repository', 'sha', 'ref'].every((key) =>
      expected[key] === undefined || expected[key] === context[key]);
}

export function validCoreGates(report, branchRequired) {
  if (report?.schemaVersion !== 1 || report.status !== 'PASS' || !Array.isArray(report.gates)) return false;
  const gates = new Set(report.gates);
  return gates.size === report.gates.length
    && report.gates.every((gate) => typeof gate === 'string')
    && REQUIRED_CORE_GATES.every((gate) => gates.has(gate))
    && (!branchRequired || gates.has('single-main-branch'));
}

export function noHighAuditFindings(audit) {
  const summary = audit?.metadata?.vulnerabilities;
  return count(summary?.high) && count(summary?.critical)
    && summary.high === 0 && summary.critical === 0;
}

export function validTestEvidence(tests) {
  return tests?.success === true
    && count(tests.numTotalTests) && tests.numTotalTests > 0
    && tests.numFailedTests === 0
    && tests.numPassedTests === tests.numTotalTests;
}

export function validBuildBudgets(build) {
  return count(build?.entry?.gzipBytes) && build.entry.gzipBytes > 0
    && count(build?.echarts?.bytes) && build.echarts.bytes > 0
    && count(build?.budgets?.entryGzipBytes) && build.budgets.entryGzipBytes > 0
    && count(build?.budgets?.echartsRawBytes) && build.budgets.echartsRawBytes > 0
    && build.entry.gzipBytes <= build.budgets.entryGzipBytes
    && build.echarts.bytes <= build.budgets.echartsRawBytes;
}
