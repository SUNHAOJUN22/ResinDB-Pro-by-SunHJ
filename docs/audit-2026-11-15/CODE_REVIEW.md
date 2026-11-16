# Code review and automated validation — 2026-11-15

## Scope and baseline

Reviewed `main` from `d827bef105a5a99c78f536a1ddb10a8c9c21b0b2`.
The review covered numeric aggregation, measurement admission into radar charts,
unit and test-condition consistency, repository validation, workflow fixed points,
dependency advisories, and the browser test harness. The complete declared source
validators, lint/type checks and automated suites were exercised; manual review
concentrated on the identified scientific-data and execution boundaries.

## Reproduced defects and repairs

| Priority | Defect | Repair |
| --- | --- | --- |
| P1 | Similar-products radar compared raw cells across different units. For example, 900 kg/m³ was ranked above 1.2 g/cm³ because the numeric strings were compared directly. It also revived rejected quantities and mixed incompatible measurement conditions. | Use the same governed comparison observations as the scientific comparison views, including canonical values and compatible conditions. Selected products and the reference population share one admission path. |
| P1 | Single-product radar accepted a `VALID`-labelled canonical quantity even when it contradicted the displayed declaration. | Use the shared property-admission validator, preserving explicit rejection and declaration identity. |
| P2 | Finite numeric inputs could overflow the intermediate compensated sum and produce an incidental NaN mean, including cases whose final sum is representable after cancellation. A scaled candidate repair also erased tiny residuals. | Preserve the normal Neumaier compensated path. On range overflow, seed an integer accumulator in exact binary64 units from the finite pre-overflow sum and compensation, then continue without buffering inputs. Round the total and rational mean separately, including subnormal ties. |
| P2 | Browser smoke fallback handled failed interface enumeration only when choosing URLs, but Vite still bound to all interfaces and repeated the denied operation. Two other smoke scripts had no fallback. | Share interface discovery across all three browser scripts and bind the preview to loopback whenever enumeration is unavailable. Seven tests cover this behavior, normal discovery, host deduplication and invalid ports. |
| CI blocker | The checked-in Unicode inventory did not match the tracked tree, and a one-time repair workflow changed the inventory by deleting itself after generation. | Remove the spent repair workflow, stage the final source inventory, regenerate the Unicode report, and verify that regeneration is a fixed point. |

Eight numeric/measurement regression failures were reproduced on the baseline
before source changes. Independent review then reproduced ten failures in the
scaled overflow candidate, including a lost `1e-100` residual and final-only
compensation overflow. All 17 numeric aggregation cases pass after replacing that
candidate. The browser-runner defect was reproduced by an actual Vite startup
failure, and the repaired runner successfully starts the loopback preview.

An independent Python `Fraction.from_float` oracle checked the actual final
numeric source with deterministic seed `20261115`: 1,294 overflow, cancellation,
and binary64-boundary cases matched exact sums and rational means bit for bit.
Another 800 ordinary-range cases matched the original main implementation bit
for bit. The ordinary path remains compensated floating-point arithmetic; the
fallback preserves the finite compensated state when overflow occurs and does
not claim exact arithmetic for all earlier observations.

The previous remote failures are inspectable in
[the main CI run](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/runs/42769761078)
and [the one-time repair run](https://github.com/SUNHAOJUN22/ResinDB-Pro-by-SunHJ/actions/runs/42769761291).
The first reported 547 versus 549 text files; the repair then deleted its own
workflow and changed the inventory from 549 to 548. The final report here is
computed from the staged tree instead of a hardcoded count.

## Dependency review

The initial audit identified nine affected development-toolchain entries for
[minimatch advisory GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
They came from one deduplicated minimatch 10.2.6 used by ESLint, its configuration
array package, and the TypeScript ESLint parser. No production high or critical
finding was reported in that initial run.

The dependency repair is limited to the override `minimatch: 11.0.1` and its new
support package `@isaacs/nonrecursive-glob-match: 1.1.0`. Because this crosses the
consumers' declared major-version range, the installed consumers were reviewed
for compatibility: they use retained matching and `Minimatch` APIs. ESLint selected
the same 455 file paths before and after the override, with zero errors or warnings
in both runs. `npm ci` and `npm ls --all` passed. Both the complete and production-only
audits report zero vulnerabilities at every severity. The compiler and linter
versions remain pinned; the nine initial affected entries represented propagation
of one advisory, not nine independent production defects.

## Validation

The required Node 22.23.3 runtime was downloaded from nodejs.org and verified
against its published SHA256 manifest. Its archive hash is
`df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de`.
An initial Node 24 run is supplemental; final validation uses pinned Node 22.23.3.

| Gate | Result |
| --- | --- |
| Complete Vitest suite | 1,178 passed across 139 files; zero failures and zero skipped tests. This includes 26 new regression cases. |
| Isolated unit suite | 477 passed across 86 files. |
| Isolated scientific and worker suite | 527 passed across 44 files. |
| Whole-production-source coverage | The same 1,178 tests passed with all 274 production files instrumented; no missing or unexpected production files. |
| Receipt, README-image and owned-process Node contracts | 113 passed. |
| Documentation, source hygiene, AI-egress governance, data, compute surface and scientific-UI validators | All passed. |
| TypeScript and ESLint | Passed; zero lint warnings. |
| Production build, external-data proof and build budgets | Passed, including nine build-budget contract tests. |
| HTTP production smoke and K-Means benchmark smoke | Passed; all three K-Means smoke cases passed. |
| Dependency installation, graph and audits | `npm ci` and `npm ls --all` passed; complete and production-only audits both report zero vulnerabilities. |
| Unicode inventory and staged-tree regeneration | 552 tracked text files; zero findings; regeneration is a fixed point. |

The isolated suites and coverage rerun the corresponding tests; their counts are
not additional unique cases. The independent numerical oracle described above
is separate from the maintained Vitest suite.

Coverage includes all 274 declared production TypeScript files. The measured
line coverage is 67.84% (9,982/14,714) and branch coverage is 50.78%
(7,118/14,018). Statement coverage is 65.86% and function coverage is 54.28%.
Passing these gates does not mean every UI path or every scientific case is covered.

### Browser evidence boundary

The local environment denies the Unix-domain socket used by Chromium's process
singleton, so Chromium exits before it can render the application. This is
separate from the repaired Vite interface-discovery failure. The browser gate is
recorded as blocked locally; it is neither skipped nor relabelled as passed.
The standard GitHub Actions workflow must provide the final Chromium interaction
and screenshot evidence for the published commit.

## Reproduction

```bash
npm ci
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

Run Unicode report generation only after staging additions and deletions. CI
retains the fixed-point source check and does not suppress a stale-report error.
