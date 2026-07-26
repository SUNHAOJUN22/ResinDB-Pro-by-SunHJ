# ResinDB Pro final dependency remediation report

- Result: **FAILURE**
- Validated input commit: `7a3c9ac17c8dc5e483610f88b268b2a87d6f5d24`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **10**
- Tests passed: **82**
- Deterministic README visuals: **14**

## Dependency remediation

- Vulnerable package: `brace-expansion` in the development toolchain.
- Remediated version: `5.0.8`.
- Remediation command: `npm audit fix --package-lock-only --ignore-scripts`.
- `package.json` application dependency declarations remained unchanged.
- Before, all dependencies: `{"critical": 0, "high": 1, "info": 0, "low": 0, "moderate": 0, "total": 1}`
- Before, production dependencies: `{"critical": 0, "high": 0, "info": 0, "low": 0, "moderate": 0, "total": 0}`
- After, all dependencies: `{"critical": 0, "high": 5, "info": 0, "low": 0, "moderate": 0, "total": 5}`
- After, production dependencies: `{"critical": 0, "high": 0, "info": 0, "low": 0, "moderate": 0, "total": 0}`

## Gate status

| Gate | Exit code |
|---|---:|
| `audit-all` | `1` |
| `audit-prod` | `0` |
| `build` | `0` |
| `git-diff-check` | `0` |
| `lint` | `0` |
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
| Statements | 70.15% |
| Branches | 45.31% |
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
