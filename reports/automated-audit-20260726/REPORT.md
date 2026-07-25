# ResinDB Pro automated repository audit

- Result: **SUCCESS**
- Validated commit: `db657442a65d6da300d92331c159e031fd09235b`
- Runtime: `v22.23.1` / `10.9.8` / `Linux`
- Remote branches: `main`
- Tracked files: **257**

## Command status

| Check | Exit code |
|---|---:|
| `audit-prod` | `0` |
| `build` | `0` |
| `git-diff-check` | `0` |
| `lint` | `0` |
| `npm-ci` | `0` |
| `smoke` | `0` |
| `test-coverage` | `0` |
| `test-science` | `0` |
| `test-ui` | `0` |
| `test-unit` | `0` |
| `test` | `0` |
| `typecheck` | `0` |

## Static risk scan

- Matches: **20**

```text
src/lib/adapters/PolymerDataValidator.ts:27:      console.warn(`[Polymer Validator Catch] Failed to clone record. Ignored.`, error);
src/lib/adapters/PolymerDataValidator.ts:66:            console.warn(`[Polymer Validator Alert] Grade ${cleanedRecord.grade} density is ${numVal} g/cm³, which exceeds international physical limits (0.8 - 3.0). Removed.`);
src/lib/adapters/PolymerDataValidator.ts:148:            console.warn(`[Polymer Validator Alert] Tensile yield strength value ${numVal} MPa out of typical polymer limits, removed.`);
src/lib/adapters/PolymerDataValidator.ts:161:            console.warn(`[Polymer Validator Alert] Flexural modulus ${numVal} MPa out of typical physical range for organic plastics, removed.`);
src/lib/adapters/PolymerDataValidator.ts:174:            console.warn(`[Polymer Validator Alert] Izod impact strength ${numVal} kJ/m² is out of typical range, removed.`);
src/lib/adapters/PolymerDataValidator.ts:187:      console.error(`🔴 [Polymer Validator BLOCKED] Grade ${cleanedRecord.grade} has fewer than 2 valid core properties (current: ${validCount}). Meltdown line triggered; this incomplete record was automatically rejected.`);
src/lib/adapters/UniversalStorageBridge.ts:29:      console.error("Failed to read lab records from storage:", e);
src/lib/adapters/UniversalStorageBridge.ts:40:      console.error("[Polymer Validator Rejected] Save operation aborted. Record is lacking minimum core physical properties.");
src/lib/adapters/UniversalStorageBridge.ts:53:      console.error("Failed to save lab record to storage:", e);
src/lib/adapters/UniversalStorageBridge.ts:67:      console.error("Failed to delete lab record:", e);
src/lib/adapters/UniversalStorageBridge.ts:98:      console.error("Failed to read open market records:", e);
src/lib/adapters/UniversalStorageBridge.ts:109:      console.error("[Polymer Validator Rejected] Open Market Save aborted. Minimum property-count validation failed.");
src/lib/adapters/UniversalStorageBridge.ts:122:      console.error("Failed to save open market record:", e);
src/components/modals/BatchEditModal.tsx:73:          console.error("Failed to parse batch edit draft", e);
src/components/modals/QaReportModal.tsx:90:      console.error(err);
src/data/resinData.ts:76:    console.warn(`[ResinDB data fallback] ${kind}`, error);
tests/science/formulaEngine.test.ts:70:      "eval('console.log(1)')",
scripts/run-test-files.mjs:11:  console.error('Usage: node scripts/run-test-files.mjs <file-or-directory> [...]');
scripts/run-test-files.mjs:26:  console.error(`No test files found under: ${roots.join(', ')}`);
scripts/run-test-files.mjs:43:    console.error(result.error);
```

## Residue candidates

- Candidates: **0**
