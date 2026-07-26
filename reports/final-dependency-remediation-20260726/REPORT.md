# ResinDB Pro final dependency remediation report

- Result: **FAILURE**
- Validated input commit: `8c25a62542a404f4a649ad0143b79113f7dac836`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **None**
- Tests passed: **None**
- Deterministic README visuals: **14**

## Dependency remediation

- Direct development dependency: `eslint`.
- Upgrade: `9.39.4` → `10.8.0`.
- Resolved vulnerable chain: `eslint` → `minimatch` → `brace-expansion`.
- Application runtime dependencies were unchanged.
- Before, all dependencies: `{"critical": 0, "high": 5, "info": 0, "low": 0, "moderate": 0, "total": 5}`
- After, all dependencies: `{}`
- After, production dependencies: `{}`

## Gate status

| Gate | Exit code |
|---|---:|
| `eslint-upgrade` | `0` |
| `git-diff-check` | `0` |
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
