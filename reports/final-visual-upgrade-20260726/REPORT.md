# ResinDB Pro final visual and validation report

- Result: **FAILURE**
- Validated input commit: `0b97046d365bee1719e5c5edfa336d6310768892`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **10**
- Tests passed: **82**
- Deterministic README visuals: **14**

## Gate status

| Gate | Exit code |
|---|---:|
| `audit-prod` | `0` |
| `build` | `0` |
| `git-diff-check` | `0` |
| `lint` | `0` |
| `npm-ci` | `0` |
| `only-main` | `0` |
| `smoke` | `0` |
| `test-coverage` | `0` |
| `test-science` | `0` |
| `test-ui` | `1` |
| `test-unit` | `0` |
| `test` | `0` |
| `typecheck` | `0` |
| `validate-source` | `0` |
| `visuals-check` | `0` |

## Coverage

| Metric | Percent |
|---|---:|
| Statements | 70.17% |
| Branches | 45.36% |
| Functions | 71.11% |
| Lines | 71.53% |

## Generated visual inventory

- `resindb-ai-platform-overview.svg`
- `resindb-ai-workflow.svg`
- `resindb-comparison-decision.svg`
- `resindb-data-governance.svg`
- `resindb-data-lifecycle.svg`
- `resindb-formula-engine.svg`
- `resindb-import-export.svg`
- `resindb-knowledge-network.svg`
- `resindb-local-first-privacy.svg`
- `resindb-quality-gates.svg`
- `resindb-research-workflow.svg`
- `resindb-scientific-engine.svg`
- `resindb-security-deployment.svg`
- `resindb-worker-architecture.svg`

## Resolved in this audit

- Corrected Help Center import, export and demo-role claims to match implemented capabilities.
- Added bilingual dialog semantics, Escape handling, responsive layout and accessible close labels.
- Added three HelpModal regression tests; the suite now contains 82 passing tests.
- Updated the deterministic quality-gate SVG to include production-source hygiene.
- Added permanent semantic validation for the source-hygiene quality-gate visual.
- Re-ran Chromium UI smoke after an isolated transient failure; the clean-tree run is authoritative.

## Final documentation proof

- Result: **FAILURE**
- `validate-docs`: `1`
