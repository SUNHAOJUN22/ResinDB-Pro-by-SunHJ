# ResinDB Pro — Final Debug Closure

## Closed defect

The technical-data-sheet radar path no longer converts missing, malformed,
boolean, partial-numeric, or non-finite property values into physical zero.

```text
raw property value
       │
       ▼
parseFiniteNumericValue(...)
       │
       ├── finite number ───────────────► retained, including legitimate 0
       └── missing / malformed / NaN ───► omitted with explicit status
                                              │
                         at least 3 finite dimensions?
                              │                    │
                             yes                  no
                              │                    │
                         render radar     INSUFFICIENT_DATA
                                         no artificial padding
```

`buildFiniteRadarProjection` is the single projection function used by the PDF
report. Preferred dimensions retain their declared order; deterministic finite
fallback properties are appended only when required. The report explicitly
states when finite evidence is insufficient and labels the output as a screening
document rather than a certificate or compliance decision.

## Regression commands

```bash
npm run lint
npm run type-check
npm run test:unit -- --run tests/unit/radarProjection.test.ts
npm run test:all
npm run build
npm run audit:zero-fallbacks
```

## Boundary

This change qualifies software behavior only. It does not certify a material,
laboratory, manufacturer, test method, regulatory status, RoHS/REACH status, or
fitness for use. Missing observations remain missing; they are not measurements
of zero.
