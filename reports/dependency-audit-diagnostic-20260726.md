# ResinDB Pro dependency audit diagnostic

- Commit: `fe10d5bcf9fe174f362d672974d5e874231efa86`
- Runtime: `v22.23.1` / `10.9.8`

## All dependencies

- Exit code: `1`
- Counts: `{"critical": 0, "high": 1, "info": 0, "low": 0, "moderate": 0, "total": 1}`

### `brace-expansion`

- Severity: `high`
- Direct: `False`
- Range: `<=5.0.7`
- Fix available: `true`
- Via dependencies: `none`
- Advisory: brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups | https://github.com/advisories/GHSA-3jxr-9vmj-r5cp | range `<1.1.16`
- Advisory: brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash | https://github.com/advisories/GHSA-mh99-v99m-4gvg | range `<=5.0.7`

## Production dependencies

- Exit code: `0`
- Counts: `{"critical": 0, "high": 0, "info": 0, "low": 0, "moderate": 0, "total": 0}`

- No vulnerabilities reported.
