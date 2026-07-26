# ResinDB Pro final dependency remediation report

- Result: **FAILURE**
- Validated input commit: `9f588d27f99070bc087aefd9f1991f6275eaa182`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **None**
- Tests passed: **None**
- Deterministic README visuals: **14**

## Dependency remediation

- Vulnerable package: `brace-expansion` in the development toolchain.
- Remediation: `npm audit fix --package-lock-only --ignore-scripts`.
- `package.json` unchanged: **False**
- Before, all dependencies: `{"critical": 0, "high": 1, "info": 0, "low": 0, "moderate": 0, "total": 1}`
- Before, production dependencies: `{"critical": 0, "high": 0, "info": 0, "low": 0, "moderate": 0, "total": 0}`
- After, all dependencies: `{}`
- After, production dependencies: `{}`

## Gate status

| Gate | Exit code |
|---|---:|
| `git-diff-check` | `0` |
| `lockfile-remediation` | `1` |
| `npm-ci` | `1` |
| `only-main` | `0` |
| `prepare` | `0` |
| `visuals-generate` | `0` |

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

## Final documentation proof

- Result: **FAILURE**
- `validate-docs`: `1`
