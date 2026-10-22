# ResinDB Pro validation contract

Version `3.2.0` is accepted only when the exact `main` tree passes every documented gate.

## Required gates

```bash
npm ci
npm run validate:docs
npm run validate:source
npm run validate:data
npm run lint
npm run typecheck
npm run test
npm run test:unit
npm run test:science
npm run test:coverage
npm run build
npm run smoke
npm run test:ui
npm run audit:prod
npm run audit:all
npm run report:receipt
npm run report:validation
npm run report:pdf
```

The release must keep resin records under root `data/`, validate JSON envelopes, schemas, stable identifiers, references and SHA-256 digests, and prove catalog sentinels are absent from JavaScript.

Each current README embeds exactly one locale-matched AI PNG and two locale-matched SVG diagrams. The explicit historical archive retains eight UI screenshots and four conceptual SVGs. `npm run validate:docs` checks links, inventories, PNG signatures, UTF-8, CJK font fallbacks, accessible SVG metadata and absence of active SVG content. Historical screenshots are not current runtime evidence.

Chromium evidence must cover dashboard, empty state, product details, scientific analysis, dependency-network interaction, English dark theme and mobile layout without browser console errors.

Permanent CI is read-only, runs on `main`, pins third-party Actions by commit SHA, uses the repository Node version, uploads coverage, audit JSON, build metrics, HTML/PDF reports and UI evidence, and proves the remote has exactly one branch named `main`. Coverage must instrument every production TypeScript file; the report may not extrapolate from only imported files. Test counts are read from Vitest JSON rather than hard-coded. Temporary migration workflows, triggers, patch payloads and diagnostic receipts are forbidden in the final tree.

## Stage-one toolchain portability

Documentation visuals and repository hygiene checks must run with Node.js only. The final tree must contain no Python tooling under `scripts/`, and CI must not invoke `python` or `python3`. The existing twelve archived image assets remain unchanged; current language-specific images are separately inventoried. No transport payload or generated test evidence belongs in the released source tree.

## Numerical and browser acceptance

Invalid quantities must not be revived by raw values, edit/import/export paths must preserve metadata, formula output units must agree with propagated dimensions, and empty TOPSIS criteria must produce no ranking. Actual canvas evidence must show visible plotted points, finite paired cohorts, readable labels and adequate viewport size. Worker cancellation must invalidate queued callbacks and clear stale cohort results.

Run native receipt/image negative contracts with `node --test scripts/tests/*.node.mjs`. A release receipt requires current exact-commit CI/branch proof; do not manufacture one from local or historical results.
