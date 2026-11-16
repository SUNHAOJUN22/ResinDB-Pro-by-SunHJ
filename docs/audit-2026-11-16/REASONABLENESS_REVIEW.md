# Scientific computation review — 2026-11-16

## Scope and baseline

Baseline: `d336994b86a4f783c5f863d67759e1d7aab39326` on `main`.
This review concentrates on core mathematical reasonableness beyond the prior
radar admission and overflow-aggregation repairs.

Assessed paths include covariance PCA, K-Means normalization/initialization/
assignment/model selection, standardized cosine similarity and missingness,
the device calibration hook and worker, backend/profile selection and migration,
and shared quantity/property admission. The calibration path transports the
declared workload and explicit backend/fallback options; accepted device-local
profiles remain bounded by environment, kernel/protocol and expiry checks.
Canonical comparison admission and the prior declaration-identity checks remain
in place. The repair does not reinterpret physical units or evidence provenance.

## Reproduced defects and repairs

| Severity | Reproduced behavior | Repair |
| --- | --- | --- |
| P1 | A singleton cluster received silhouette 1 instead of 0. For `[0, 0.1, 0.2, 10]`, the cohort score was inflated by 0.25. | Give singleton observations zero contribution while retaining them in the average. A separate pairwise reference checks the result. |
| P1 | A constant cohort advertised two clusters and duplicate centroids even though every assignment belonged to one group. | Keep exactly constant columns constant during averaging; when no feature varies, report one cluster and no silhouette. |
| P1 | Finite global rescaling could collapse K-Means or remove every active similarity feature. Similarity even rejected varying values at `1e-20` because its variance tolerance had a unit-dependent absolute floor. | Form means and variances in per-column power-of-two units. The similarity near-constant check now operates in those same dimensionless units. |
| P1 | PCA erased components at tiny scales, overflowed energy at large scales, and allowed a huge constant column to hide a small varying column. | Use the existing finite compensated mean, center first, then apply one common power-of-two factor to the residual matrix. Restore original units in projected scores. |

The singleton convention is independently documented by the primary
[scikit-learn silhouette implementation](https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/metrics/cluster/_unsupervised.py),
which maps singleton silhouettes to zero. The regression computes distances and
cluster averages directly, rather than duplicating the worker's accumulation.

PCA retains covariance semantics: it does not standardize each feature to unit
variance. Its common working scale preserves component directions and relative
variance. The K-Means and similarity worker model versions advance to 4.0.1 and
4.1.1 so changed numerical behavior remains distinguishable in evidence.

Before repair, the initial PCA/clustering slice reproduced **10 failures among
18 tests**; a further constant-cohort case reproduced the false two-cluster
report. The final maintained regressions add small/large scale transformations,
non-singleton controls, constant decimal/extreme cohorts, and the huge-constant
PCA column case. The broader targeted worker slice passes **34 tests**.

An independent NumPy 2.3.5 SVD probe used seed `20261116`, 64 deterministic
centered matrices with distinct singular values, and three global scales
(`1`, `1e-250`, `1e250`). All **192 cases passed**. Maximum loading error was
`1.54e-11`; maximum rescaled score error was `4.53e-11`. The maintained analytic
PCA controls and scale tests require no additional runtime dependency.

## Validation

Validation uses Node 22.23.3 and the unchanged package lock.

| Gate | Observed result |
| --- | --- |
| Complete regression and coverage regression | 1,194 passed across 140 files; no failed or skipped cases |
| Isolated unit suite | 482 passed across 86 files |
| Isolated scientific/worker suite | 538 passed across 45 files |
| Whole-production-source coverage | All 274 production files; lines 67.95%, statements 65.96%, branches 50.85%, functions 54.32% |
| Receipt, README-image and owned-process Node contracts | 113 passed |
| Documentation/source/AI-egress/data/compute/scientific-UI validators | Passed |
| ESLint and TypeScript | Passed, including a final rerun after the constant-cohort correction |
| Production build, external-data and build-budget contracts | Passed |
| HTTP production smoke and K-Means benchmark smoke | Passed |
| Frozen dependency installation and graph | `npm ci` and `npm ls --all` passed |
| Production and complete dependency audits | Actual info/low/moderate/high/critical/total counts are all zero in both audits |

The isolated and coverage suites rerun corresponding cases; their counts are
not additional unique tests. Coverage is measured over the complete declared
production source set and remains partial; a passing gate is not full coverage.
New tests and this report were staged before regenerating the Unicode inventory:
554 tracked text files, zero findings. A second generation left the tracked tree
unchanged, and the inventory check passed.

### Browser boundary

The standard local Chromium runner reaches the production preview, but Chromium
cannot create its process-singleton Unix socket (`Operation not permitted`).
It exits before a CDP session or browser assertion can run. The bounded startup
retries do not change this environment restriction. This gate is blocked locally,
not skipped or reported as passing; the exact published commit's standard GitHub
workflow must provide the browser interaction and screenshot evidence.

## Reproduction

```bash
npm ci
npm ls --all
npx vitest run tests/science/clusteringNumericalReasonableness.test.ts \
  tests/unit/pca.test.ts --pool=forks --maxWorkers=1
npm run validate
npm run benchmark:kmeans:smoke
npm run test:unit
npm run test:science
npm run test:coverage
npm run test:ui
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
node scripts/validate-repository-unicode.mjs --check
```

## Limits

These are binary64 numerical algorithms. The repair prevents avoidable range
failures and preserves scale semantics; it does not promise exact real-number
arithmetic or representable scores when the mathematical result exceeds the
binary64 range. Nearly degenerate PCA directions and clustering ties remain
sensitive to floating-point rounding. Approximate sampled silhouette,
mean-imputation policy and relative PCA rank truncation retain their declared
semantics. Software tests do not establish material suitability or replace
source, unit, condition and scientific validation of imported measurements.
