# ResinDB Pro final visual and validation report

- Result: **SUCCESS**
- Validated input commit: `fb257cfcad6850e387ecc808dee4f18ab049a09f`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **9**
- Tests passed: **79**
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
| `static-risk` | `0` |
| `test-coverage` | `0` |
| `test-science` | `0` |
| `test-ui` | `0` |
| `test-unit` | `0` |
| `test` | `0` |
| `typecheck` | `0` |
| `validate-docs` | `0` |
| `visuals-generate` | `0` |

## Coverage

| Metric | Percent |
|---|---:|
| Statements | 70.02% |
| Branches | 44.75% |
| Functions | 70.75% |
| Lines | 71.37% |

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
## Current evidence-aligned tree verification

- Result: **FAILURE**
- Validated input commit: `624b660318a36f8dd728e934d8aa3a7f0a2bf54c`
- Scope: production source hygiene and complete validate:ci; negative security fixtures remain test-scoped
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`

| Gate | Exit code |
|---|---:|
| `git-diff-check` | `0` |
| `npm-ci` | `0` |
| `only-main` | `0` |
| `validate-ci` | `1` |
| `validate-docs-after-proof` | `1` |
| `validate-source` | `1` |
| `visuals-check` | `0` |
