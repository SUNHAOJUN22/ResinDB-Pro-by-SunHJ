# ResinDB Pro final current-tree verification report

- Result: **FAILURE**
- Validated input commit: `4e136eec2daf82a5bd752b44701db05bfc3392c3`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **10**
- Tests passed: **82**
- Deterministic README visuals: **14**

## Dependency remediation

- ESLint: `9.39.4` → `10.8.0`.
- typescript-eslint family: `8.58.2` → `8.65.0`.
- eslint-plugin-react-hooks: `7.0.1` → `7.1.1`.
- eslint-plugin-react-refresh: `0.5.2` → `0.5.3`.
- Resolved vulnerable chain: `eslint` → `minimatch` → `brace-expansion`.
- Lockfile rebuilt from the atomically aligned package manifest.
- Application runtime dependencies were unchanged.
- Before, all dependencies: `{"critical": 0, "high": 5, "info": 0, "low": 0, "moderate": 0, "total": 5}`
- After, all dependencies: `{"critical": 0, "high": 0, "info": 0, "low": 0, "moderate": 0, "total": 0}`
- After, production dependencies: `{"critical": 0, "high": 0, "info": 0, "low": 0, "moderate": 0, "total": 0}`

## Gate status

| Gate | Exit code |
|---|---:|
| `audit-all` | `0` |
| `audit-prod` | `0` |
| `build` | `0` |
| `git-diff-check` | `0` |
| `lint` | `2` |
| `npm-ci` | `0` |
| `only-main` | `0` |
| `smoke` | `0` |
| `test-coverage` | `0` |
| `test-science` | `0` |
| `test-ui` | `0` |
| `test-unit` | `0` |
| `test` | `0` |
| `typecheck` | `0` |
| `validate-docs` | `1` |
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
