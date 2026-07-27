# ResinDB Pro performance optimization report

- Result: **FAILURE**
- Validated input commit: `bb27f8ef3b60a2aa1fc9545a4f119c518f7dd200`
- Runtime: `v22.23.1` / `10.9.8` / `Python 3.12.3` / `Linux`
- Remote branches: `main`
- Test files passed: **None**
- Tests passed: **None**
- Deterministic README visuals: **14**

## Measured optimization

| Path | Before ms | After ms | Elapsed change | Before ops/s | After ops/s |
|---|---:|---:|---:|---:|---:|

## Gate status

| Gate | Exit code |
|---|---:|
| `apply-optimization` | `1` |
| `baseline-benchmarks` | `0` |
| `baseline-build` | `0` |
| `git-diff-check` | `0` |
| `npm-ci-baseline` | `0` |
| `npm-ci-final` | `1` |
| `only-main` | `0` |
| `validate-docs` | `1` |
| `visuals-generate` | `1` |

## Decision summary

- Applied only measured, behavior-preserving changes.
- Vite 8/Rolldown is deferred to a dedicated build migration.
- ECharts on-demand imports are deferred until every used series and component is enumerated.
- Transferable buffers are deferred until ownership and detachment behavior are explicit.

See `dependency-update-matrix.md` and `web-research.md` for the update survey.
