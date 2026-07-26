# ResinDB Pro final dependency remediation report

- Result: **FAILURE**
- Validated input commit: `cd960cc6597c730b7cd499305b8804c97694c08c`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **None**
- Tests passed: **None**
- Deterministic README visuals: **14**

## Dependency remediation

- ESLint: `9.39.4` → `10.8.0`.
- typescript-eslint family: `8.58.2` → `8.65.0`.
- eslint-plugin-react-hooks: `7.0.1` → `7.1.1`.
- eslint-plugin-react-refresh: `0.5.2` → `0.5.3`.
- Resolved vulnerable chain: `eslint` → `minimatch` → `brace-expansion`.
- Application runtime dependencies were unchanged.
- Before, all dependencies: `{"critical": 0, "high": 5, "info": 0, "low": 0, "moderate": 0, "total": 5}`
- After, all dependencies: `{}`
- After, production dependencies: `{}`

## Gate status

| Gate | Exit code |
|---|---:|
| `git-diff-check` | `0` |
| `lint-stack-upgrade` | `1` |
| `npm-ci` | `1` |
| `only-main` | `0` |
| `validate-docs` | `1` |

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
