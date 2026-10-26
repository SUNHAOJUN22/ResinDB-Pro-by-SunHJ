# ResinDB governed data architecture

## 1. Authoritative rule

`data/` is the authoritative, independently versioned ResinDB data layer. Production UI source files must not embed the complete resin catalog. A code commit may change parsers or views, but it must not silently change data meaning.

The canonical persisted representation is **UTF-8 JSON using the ResinDB versioned data envelope**. Spreadsheet files may be used for interchange, but they are not the authoritative repository format because they make schema, provenance, unit and diff review less reliable.

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
    ├── polymerDatabase.json
    ├── myLabUniverse.json
    ├── openMarketUniverse.json
    ├── resin-taxonomy.json
    ├── resin-category-aliases.json
    ├── resin-property-groups.json
    ├── resin-manufacturers.json
    ├── resin-references.json
    └── resin-network.json
```

## 2. Canonical document envelope

Every governed data file uses exactly six top-level fields:

```json
{
  "schemaVersion": "1.0.0",
  "dataKind": "resin-seed-products",
  "sourceType": "curated-demo",
  "recordStatus": "demo",
  "updatedAt": "2026-08-02",
  "data": []
}
```

| Field | Contract |
|---|---|
| `schemaVersion` | Exact data-envelope compatibility version |
| `dataKind` | Stable semantic identity of the payload |
| `sourceType` | Non-empty provenance/source category |
| `recordStatus` | `demo`, `reference`, `measured`, or `imported` |
| `updatedAt` | Real ISO calendar date, `YYYY-MM-DD` |
| `data` | Dataset-specific payload |

Unknown top-level fields are rejected by the JSON Schema and by repository validation.

## 3. Canonical product record

A product/grade record requires:

- stable `id`;
- `gradeName`;
- `manufacturerId` and display `manufacturer`;
- at least one unique category ID;
- `createdAt` and `updatedAt` ISO dates;
- at least one structured property.

A property value is not merely a number. It may include measurement context:

```json
{
  "value": 23.5,
  "unit": "MPa",
  "standard": "ISO 527",
  "temperature": 23,
  "instrument": "Universal testing machine",
  "referenceId": "ref-001",
  "mean": 23.5,
  "stdDev": 0.4,
  "count": 5
}
```

The canonical scalar `value` type is **string or finite number**. Boolean values and non-finite numbers are rejected because current scientific and display contracts are not defined for them.

## 4. Integrity and release manifests

`data/manifest.json` and `data/resins/manifest.json` record:

- file path;
- data kind;
- record status;
- record count where applicable;
- byte length;
- SHA-256 digest.

`npm run data:manifest` regenerates these values. `npm run validate:data` verifies the exact committed bytes and cross-document references.

## 5. Runtime loading

Vite serves `data/` at `/data/` during development and copies it unchanged to `dist/data/` for production. `loadResinDataCatalog()` fetches `/data/resins/*.json` with a bounded timeout and validates:

- canonical envelope version;
- non-empty source type;
- real ISO dates;
- product field and property-value types;
- duplicate identifiers;
- category cycles;
- network and catalog references.

If an external data asset fails, the loader records the exact failure and exposes a deterministic fallback status. Failure is visible and does not masquerade as a complete manufacturer dataset.

## 6. Change policy

1. Do not move governed records into TypeScript constants.
2. Do not edit data and code in a way that hides which layer changed.
3. Regenerate manifests whenever any governed data byte changes.
4. Increment schema versions for incompatible structural changes.
5. Preserve units, standards, temperatures, provenance and record status.
6. Keep `demo`, `reference`, `measured` and `imported` data semantically separate.
7. Never replace missing evidence with a numeric zero.

## 7. Raw/canonical consistency at import and storage boundaries

For a core quantity declared `VALID`, its canonical value, unit and dimension
must agree with a fresh conversion of the preserved `raw` declaration. The
check also reuses the required method and measurement-condition rules. Equivalent
unit typography is accepted; numeric comparison permits only binary64 rounding
noise relative to the quantity, with no absolute physical-scale tolerance.

Structured native imports and remote Product payloads reject conflicting
declarations before admitting them to the application. First writes and unchanged
updates quarantine inconsistent core quantities as `INVALID` with
`CANONICAL_RAW_MISMATCH`, retaining raw declarations and provenance. Historical
IndexedDB reads and restored snapshots apply the same quarantine to their in-memory
cache without rewriting the original stored source records. Formula dependencies
then become unavailable instead of calculating with the conflicting canonical value.
History restoration also checks the live React state, so it cannot bypass the
adapter's checked cache by displaying the unverified snapshot directly.

An existing `UNKNOWN` or `INVALID` quantity is never promoted by this consistency
check. Properties outside the core quantity registry retain their existing
contract. This is a conversion-consistency check, not measurement authentication:
synthetic, inferred, imported, restricted and not-for-release governance metadata
remain unchanged. No source becomes an observed experimental fact because its
units are internally consistent.

## 8. Concurrent mutations and confirmed state

`ProductMutationCoordinator` owns a confirmed storage snapshot and an ordered
list of scoped pending intents. The displayed list is a projection of those
intents. A failed write no longer restores an earlier whole-list copy over
another completed update. Tags, priority changes and editor saves persist only
their intended fields; editor saves carry the original edit base so unrelated
fields changed while the form was open are retained.

Overlapping fields on the same record are serialized through readback. Disjoint
field patches can execute concurrently. Create, delete, import and restore are
catalog barriers. Writes against an identity that is missing or still provisional
are refused. Multi-request tagging/reordering waits for every request to settle
before reconciliation, including partially failed remote batches.

Every settled mutation triggers a read from the write target. IndexedDB rereads
storage rather than treating its search cache as fresh evidence; remote readback
never uses the optional alternative-database read fallback. A read acknowledges
only intents already settled when that read began. Later completions remain
projected until their own readback. A failed readback blocks subsequent writes
until a successful explicit refresh. An HTTP error may still follow a partial
remote write; the display therefore reconciles storage instead of assuming a
transactional rollback.

The public `setAllProducts` setter remains available for UI compatibility. It is
a display override, not a storage commit or a new confirmed snapshot. It must not
be used to persist data. Immutable record identity/creation time are retained in
scoped edits. This coordinator serializes writes within one provider; it is not a
distributed compare-and-swap protocol and does not replace server-side conflict
control between independent clients.

History workers echo request identifiers. Unsolicited or mismatched snapshot
responses cannot execute a restore. A restore waits for its requested snapshot,
then records an undo snapshot from the confirmed state at its catalog barrier,
and awaits persistence and readback before reporting completion. IndexedDB write
helpers observe the separate transaction-completion promise before issuing
requests and abort/drain on request errors while preserving the original error.
Caches and lab mirrors are published only after transaction commit.

## 9. Comparable scientific observations and UI evidence

Comparison percentages, radar axes, numeric reorder presets, Spearman payloads
and similarity matrices consume a numeric observation together with its unit,
dimension and test-condition basis. Supported core quantities use verified
canonical values. Explicit `UNKNOWN`/`INVALID` quantities, contradictory
declarations and incompatible measurement conditions are unavailable to these
consumers. Generic legacy statistical features can remain unitless when all
observed values share that basis; no physical unit is inferred for core fields.

For example, 900 kg/m³ and 0.9 g/cm³ have the same canonical density. A radar chart
requires at least three compatible properties observed for every displayed
product; absent axes are not fabricated as zero. Missing diagnostic targets yield
an incomplete screening statement, and constant Spearman features display N/A.
Similarity admission changes the evidence version to
`zscore-cosine-overlap-canonical-f64-4.0.0`; z-score normalization, overlap policy,
minimum shared-feature requirement, thresholds and binary64 computation remain
unchanged.

Correlation displays and AI insights are bound to the current request/product.
Late or failed computations cannot relabel a previous result as current evidence.
Dashboard refresh counts come from observed successful client refresh events;
latency and governance assessments remain unmeasured/unassessed where no
measurement exists. Product views do not claim external manufacturer-database
verification merely because a record is present. These software checks support
screening; they neither authenticate a measurement nor release an industrial
material or parameter.
