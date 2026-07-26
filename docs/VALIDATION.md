# ResinDB Pro validation contract

This document defines the verifiable release gates for ResinDB Pro `3.0.0` on the sole long-lived branch, `main`.

## Scope

The contract covers the repository as it exists today:

- browser-resident resin records and catalogs under `src/data/`;
- IndexedDB and optional remote REST storage adapters;
- React UI, data views, export flows and feedback diagnostics;
- the whitelist formula engine and scientific Web Workers;
- optional OpenAI-compatible AI integration;
- deterministic README visuals and documentation integrity;
- production build, HTTP smoke, Chromium UI smoke and dependency audit.

It does **not** claim a separate public runtime manifest architecture. Version `3.0.0` imports and validates the maintained catalogs from `src/data/`.

## Required gates

A release candidate must satisfy every gate below without disabling assertions or lowering failure thresholds:

1. `npm ci` succeeds using the committed lockfile on Node.js 22.
2. `npm run validate:docs` confirms all local README links, the exact 14-image inventory, SVG accessibility metadata, deterministic regeneration, version alignment, CI integration, durable-evidence alignment and repository hygiene.
3. `npm run lint` completes with zero ESLint warnings.
4. `npm run typecheck` completes without TypeScript errors.
5. `npm run test` passes the complete Vitest regression suite.
6. `npm run test:unit` passes the isolated unit-test group.
7. `npm run test:science` passes the isolated scientific/data/worker group.
8. `npm run test:coverage` completes and emits a coverage report.
9. `npm run build` produces the Vite production bundle.
10. `npm run smoke` verifies the built application over HTTP.
11. `npm run test:ui` renders the authenticated Dashboard in Chromium, detects browser-console errors, checks preference persistence and saves real screenshots.
12. `npm run audit:prod` finds no high-severity production dependency vulnerability.
13. `git diff --check` reports no whitespace errors.
14. The remote branch inventory contains exactly `main` for a main-branch release.

## Documentation and visual contract

`scripts/generate-readme-visuals.py` owns the complete `docs/assets/resindb-*.svg` inventory. The checked-in files must be byte-for-byte reproducible through:

```bash
npm run visuals:generate
npm run visuals:check
```

Each SVG must contain:

- a root `role="img"`;
- an `aria-labelledby` reference;
- one `<title>`;
- one `<desc>`;
- no dependency on an external image service.

`scripts/validate-repository-docs.py` also rejects:

- a missing or duplicated README reference to any expected visual;
- a broken local README link;
- a README/package/validation version mismatch;
- a permanent CI workflow that omits `npm run validate:docs`;
- stale validation-report links or drift between the fixed summary and `ci-validation-latest.json`;
- reintroduced patch payloads, migration fragments, temporary workflows or diagnostic residue.

The diagrams are explanatory architecture assets. They are not Chromium screenshots and must never be presented as runtime evidence.

## Permanent GitHub Actions gate

`.github/workflows/ci.yml` runs on every push to `main`, every pull request targeting `main`, and manual dispatch. It uses:

- `actions/checkout@v4`;
- `actions/setup-node@v4` with Node.js 22 and npm caching;
- `actions/upload-artifact@v4` for install diagnostics, coverage and UI evidence.

The workflow runs documentation validation, static checks, regression groups, build, browser smoke and security audit as separately named steps so failures remain attributable. Dependency installation and production audit include bounded retries for transient registry failures; test, type, build, documentation and UI failures are never retried into a false pass.

## Current verified baseline

The current committed full-tree audit executed on Linux with Node.js `v22.23.1`, npm `10.9.8` and Python `3.12.3`, verified 14 deterministic README visuals, and recorded zero exit codes for:

| Check | Result |
|---|---|
| npm clean install | passed |
| documentation and visual regeneration | passed |
| ESLint | passed |
| TypeScript | passed |
| complete regression suite | passed |
| unit tests | passed |
| scientific and worker tests | passed |
| coverage generation | passed |
| Vite production build | passed |
| HTTP smoke | passed |
| Chromium UI smoke | passed |
| production dependency audit | passed |
| whitespace check | passed |
| static-risk scan | passed |
| sole remote branch check | passed |

The recorded baseline contains **9 test files and 79 passing tests**. Rounded coverage was:

| Metric | Coverage |
|---|---:|
| Statements | 70.0% |
| Branches | 44.7% |
| Functions | 70.8% |
| Lines | 71.4% |

Exact values from each run remain in the machine-readable validation report rather than being treated as permanent thresholds.

The Chromium smoke test authenticated as Demo Admin, rendered **13 records**, confirmed that the browser console contained no errors, persisted language/theme/palette changes, and generated:

- `ui-smoke-dashboard-zh.png`;
- `ui-smoke-dashboard-en-dark.png`.

## Evidence retention

The repository commits compact durable evidence:

- `reports/final-visual-upgrade-20260726/summary.json`;
- `reports/final-visual-upgrade-20260726/REPORT.md`;
- `reports/ci-validation-latest.json`.

The fixed summary and latest alias must agree on result, repository, version, runtime, remote branches, statuses, test counts, coverage and visual inventory. The result must be `success`, every recorded status must be zero, and the remote branch proof must contain only `main`.

Raw command logs, coverage HTML and Chromium PNG screenshots are generated artifacts excluded by `.gitignore`. GitHub Actions uploads them for the workflow's configured retention period. The committed summary is the durable acceptance record; raw logs and screenshots are time-limited supporting evidence.

## Scientific acceptance rules

Scientific tests exercise the formula parser, material helpers, storage validation and worker matrix. The release gate rejects unhandled exceptions and checks that valid results are finite rather than `NaN` or `Infinity`.

Console output from negative tests is expected when a test deliberately supplies malformed formulas or physically invalid records. The test must still prove that invalid input is isolated or rejected while valid neighboring calculations remain usable.

## Release rule

A release is accepted only when:

- every required gate passes on the exact candidate tree;
- `npm run visuals:check` confirms deterministic, current assets;
- the durable summary and latest alias remain synchronized;
- the repository contains no active migration payload, temporary trigger or self-modifying patch workflow;
- `README.md`, `package.json`, this contract and the implemented data architecture agree;
- the remote branch list contains only `main`.

When a check cannot be executed, the release must be reported as unverified rather than inferred to be successful.
