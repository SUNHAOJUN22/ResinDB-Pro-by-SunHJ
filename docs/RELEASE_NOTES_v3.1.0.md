# ResinDB Pro v3.1.0 release notes

## Architecture

- Resin categories, products and supply-network records are served as versioned runtime JSON assets from `public/data/resin/`.
- `manifest.json` records the SHA-256 digest, byte size, record count, data kind and release status for every asset.
- JSON Schema definitions and semantic validation cover document shape, products, references, duplicate identifiers, hierarchy cycles and scientific ranges.
- Runtime loading uses concurrent requests, timeout handling, deterministic fallback and a visible availability warning instead of silently failing.

## Reliability and performance

- The frontend no longer imports the resin datasets into JavaScript bundles.
- Heavy analytics, document generation and visualization code is loaded on demand.
- Build and coverage metrics are generated in machine-readable form.
- HTTP smoke tests verify the application shell and all manifest-declared assets.

## Verification

- Unit and scientific tests are isolated in CI.
- Chromium validates authentication, dashboard states, product detail, scientific analysis, dependency-map interaction, theme/language persistence and mobile layout.
- Every successful CI run publishes a validation dashboard, logs, metrics, coverage and seven UI screenshots.
- A branch proof gate rejects the build unless the remote has exactly one branch: `main`.

## Documentation

- README was rewritten for installation, data architecture, commands, validation and deployment.
- `docs/DATA_ARCHITECTURE.md` documents the external-data contract.
- `docs/VALIDATION.md` defines the release evidence and acceptance rule.
