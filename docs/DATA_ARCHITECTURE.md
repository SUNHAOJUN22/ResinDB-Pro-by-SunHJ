# Governed data architecture

`data/` is the authoritative, independently versioned ResinDB data layer. UI source files never embed the complete resin catalog.

```text
data/
├── manifest.json
├── metadata.json
├── version.json
├── schemas/
│   ├── resin-data-document.schema.json
│   └── resin-product.schema.json
└── resins/
    ├── manifest.json
    └── *.json
```

Vite serves this directory at `/data/` during development and copies it unchanged into `dist/data/` during production builds. The runtime catalog loader fetches `/data/resins/*.json` with a bounded timeout, validates versioned envelopes, checks duplicate identifiers and category cycles, and exposes a coherent fallback status when an asset cannot be loaded.

`npm run data:manifest` regenerates byte counts and SHA-256 values. `npm run validate:data` verifies both manifests, cross-document references and semantic constraints. `npm run verify:external-data` proves data is present in `dist/` and absent from JavaScript bundles.
