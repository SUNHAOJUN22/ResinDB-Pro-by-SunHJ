# ResinDB Pro final validation report

- Result: **SUCCESS**
- Version: `3.0.0`
- Validated input commit: `2ad01c7b38a5d4d9dac076025c217fa2d3413c8e`
- Runtime: `v22.23.1` / `10.9.8` / `Linux`
- Remote branches: `main`
- Tests passed: **79**

## Validation status

| Gate | Exit code |
|---|---:|
| `audit-prod` | `0` |
| `build` | `0` |
| `document-drift` | `0` |
| `git-diff-check` | `0` |
| `lint` | `0` |
| `npm-ci` | `0` |
| `only-main` | `0` |
| `residue-check` | `0` |
| `smoke` | `0` |
| `test-coverage` | `0` |
| `test-science` | `0` |
| `test-ui` | `0` |
| `test-unit` | `0` |
| `test` | `0` |
| `typecheck` | `0` |

## Coverage

| Metric | Percent |
|---|---:|
| Statements | 70.04% |
| Branches | 44.75% |
| Functions | 70.75% |
| Lines | 71.37% |

## Generated README visuals

- `resindb-ai-platform-overview.svg`
- `resindb-ai-workflow.svg`
- `resindb-data-lifecycle.svg`
- `resindb-scientific-engine.svg`
- `resindb-knowledge-network.svg`
- `resindb-quality-gates.svg`
- `resindb-local-first-privacy.svg`
- `resindb-research-workflow.svg`

## Removed migration and diagnostic residue

- `.github/.resindb-main-update/`
- `.github/.resindb-v310-patch/`
- `.github/apply-resindb-main-update-retry.trigger`
- `.github/apply-resindb-main-update.trigger`
- `.github/apply-v310-patch.trigger`
- `.github/finalize-resindb-main-update.trigger`
- `.github/workflows/apply-resindb-main-update-retry.yml`
- `.github/workflows/apply-resindb-main-update.yml`
- `.github/workflows/apply-v310-patch.yml`
- `.github/workflows/diagnose-v310-patch.yml`
- `.github/workflows/finalize-resindb-main-update.yml`
- `.github/workflows/repository-audit-20260726.yml`
- `.github/audit-trigger-20260726.txt`
- `.github/workflows/finalize-repository-20260726.yml`
- `.github/finalize-repository-20260726.trigger`
- `docs/MIGRATION_v3.1.0.md`
- `docs/RELEASE_NOTES_v3.1.0.md`
- `reports/patch-diagnostic.json`
- `reports/release-baseline-v3.1.0.json`
- `reports/automated-audit-20260726/`
- `scripts/generate-release-evidence.py`

## Interpretation

This report records deterministic command results for the cleaned candidate tree before it was committed to `main`. README architecture claims were checked against version `3.0.0`; hand-authored SVG diagrams are explanatory assets, while Chromium PNG files remain the UI test evidence.
