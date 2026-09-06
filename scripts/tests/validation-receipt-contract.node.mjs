import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  REQUIRED_CORE_GATES, noHighAuditFindings, validateBranchProof,
  validBuildBudgets, validCiContext, validCoreGates, validTestEvidence,
} from '../validation-receipt-contract.mjs';

const sha = 'a'.repeat(40);
const proof = `${sha}\trefs/heads/main\n`;
const context = {schemaVersion: 3, repository: 'owner/repo', sha, ref: 'refs/heads/main', runId: 1, runAttempt: 1};

test('single-main proof binds the exact commit, including CRLF transport', () => {
  assert.equal(validateBranchProof(proof, sha), true);
  assert.equal(validateBranchProof(proof.replace('\n', '\r\n'), sha), true);
  assert.equal(validateBranchProof(proof, 'b'.repeat(40)), false);
});
for (const invalid of ['', null, `${sha} refs/heads/dev`, `${sha} refs/tags/main`, `${sha} refs/heads/main extra`, proof + proof, proof + `${sha} refs/heads/work\n`, 'refs/heads/main']) {
  test(`invalid branch proof fails closed: ${JSON.stringify(invalid)}`, () => {
    assert.equal(validateBranchProof(invalid, sha), false);
  });
}
test('manual-main and push-main use the same permanent branch gate', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Prove main is the sole remote branch\n\s+if: github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /validateBranchProof/);
  assert.doesNotMatch(workflow, /wc -l < artifacts\/branch-proof/);
});
test('context binds repository, exact SHA and ref independently of the receipt', () => {
  assert.equal(validCiContext(context, {sha, repository: 'owner/repo', ref: context.ref}), true);
  assert.equal(validCiContext({...context, ref: 'refs/pull/45/merge'}), true);
  assert.equal(validCiContext(context, {sha: 'b'.repeat(40)}), false);
  assert.equal(validCiContext(context, {repository: 'other/repo'}), false);
  assert.equal(validCiContext(context, {ref: 'refs/pull/45/merge'}), false);
});
for (const delta of [{}, {sha: 'local-worktree'}, {runId: true}, {runAttempt: 0}, {ref: ''}, {repository: 'local'}, {schemaVersion: '3'}]) {
  test(`malformed or incomplete CI context: ${JSON.stringify(delta)}`, () => {
    assert.equal(validCiContext(Object.keys(delta).length ? {...context, ...delta} : {}), false);
  });
}
test('PASS text cannot replace complete core gate evidence', () => {
  const base = {schemaVersion: 1, status: 'PASS', gates: [...REQUIRED_CORE_GATES]};
  assert.equal(validCoreGates(base, false), true);
  assert.equal(validCoreGates(base, true), false);
  assert.equal(validCoreGates({...base, gates: [...base.gates, 'single-main-branch']}, true), true);
  assert.equal(validCoreGates({...base, gates: []}, false), false);
  assert.equal(validCoreGates({...base, gates: [...base.gates, base.gates[0]]}, false), false);
  for (const omitted of REQUIRED_CORE_GATES) {
    assert.equal(validCoreGates({...base, gates: base.gates.filter((gate) => gate !== omitted)}, false), false, omitted);
  }
});
test('explicit integer zero is the only passing high/critical audit count', () => {
  assert.equal(noHighAuditFindings({metadata: {vulnerabilities: {high: 0, critical: 0}}}), true);
  for (const invalid of [undefined, null, false, '0', -1, 0.5, NaN, Infinity, 1]) {
    assert.equal(noHighAuditFindings({metadata: {vulnerabilities: {high: invalid, critical: 0}}}), false);
    assert.equal(noHighAuditFindings({metadata: {vulnerabilities: {high: 0, critical: invalid}}}), false);
  }
  assert.equal(noHighAuditFindings({metadata: {vulnerabilities: {}}}), false);
});
test('test totals reconcile without Boolean or string coercion', () => {
  const valid = {success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0};
  assert.equal(validTestEvidence(valid), true);
  for (const delta of [{success: 'false'}, {numTotalTests: true}, {numPassedTests: 1}, {numFailedTests: '0'}, {numTotalTests: 0}, {numTotalTests: NaN}]) {
    assert.equal(validTestEvidence({...valid, ...delta}), false);
  }
});
test('missing build budgets are rejected rather than crashing or coercing', () => {
  const valid = {entry: {gzipBytes: 10}, echarts: {bytes: 20}, budgets: {entryGzipBytes: 10, echartsRawBytes: 20}};
  assert.equal(validBuildBudgets(valid), true);
  for (const invalid of [null, {}, {...valid, budgets: undefined}, {...valid, entry: {gzipBytes: true}}, {...valid, entry: {gzipBytes: 11}}, {...valid, echarts: {bytes: '20'}}, {...valid, budgets: {entryGzipBytes: Infinity, echartsRawBytes: 20}}]) {
    assert.equal(validBuildBudgets(invalid), false);
  }
});
