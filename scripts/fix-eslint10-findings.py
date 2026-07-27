#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{relative}: expected exactly one replacement anchor, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/components/charts/ScientificChart.tsx",
    '''    } catch (err: unknown) {
      throw new Error(
        err instanceof Error ? err.message : "Failed to generate visualization",
      );
    }
''',
    '''    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate visualization";
      throw new Error(message, { cause: error });
    }
''',
)

replace_once(
    "src/components/features/Analytics/ResinCapacityForecast.tsx",
    '''    let confidenceScore = 96.2;
    if (projectionType === 'moving_average') {
      confidenceScore = 98.4 - (rollingWindow * 0.6);
    } else {
      confidenceScore = 95.8 - (Math.abs(growthMultiplier - 1) * 3);
    }
''',
    '''    const confidenceScore = projectionType === 'moving_average'
      ? 98.4 - (rollingWindow * 0.6)
      : 95.8 - (Math.abs(growthMultiplier - 1) * 3);
''',
)

replace_once(
    "src/components/features/Dashboard/ChemicalSimilaritySearch.tsx",
    "        let similarityScore = 0;\n",
    "        let similarityScore: number;\n",
)

replace_once(
    "src/components/features/Product/DependencyHeatmap.tsx",
    "    let val: number | null = null;\n",
    "    let val: number | null;\n",
)

replace_once(
    "src/components/modals/BulkReorderModal.tsx",
    '''      let aVal: string | number = "";
      let bVal: string | number = "";
''',
    '''      let aVal: string | number;
      let bVal: string | number;
''',
)

replace_once(
    "src/components/modals/QaReportModal.tsx",
    'import React, { useState, useRef } from "react";\n',
    'import React, { useEffect, useState, useRef } from "react";\n',
)
replace_once(
    "src/components/modals/QaReportModal.tsx",
    '''  const [inspector, setInspector] = useState(currentUser?.name || currentUser?.email || "Lab Analyst Code-Y");
  const [reportNo, setReportNo] = useState(`QA-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState("");
''',
    '''  const [inspector, setInspector] = useState(currentUser?.name || currentUser?.email || "Lab Analyst Code-Y");
  const [reportNo, setReportNo] = useState("QA-PENDING");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setReportNo(`QA-${Date.now().toString().slice(-6)}`);
  }, []);
''',
)

replace_once(
    "src/hooks/app/useDatabase.ts",
    "import { useState, useMemo, useDeferredValue, useEffect, useCallback, useRef } from 'react';\n",
    "import { useState, useMemo, useDeferredValue, useEffect, useCallback, useRef } from 'react';\n",
)
replace_once(
    "src/hooks/app/useDatabase.ts",
    '''  const columnManagement = useColumns(allProducts);
  const { columns } = columnManagement;
  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const resolvePropKey = useCallback(
    (label: string): string | null => {
      const cleanLabel = label.toLowerCase();
      const directMatch = columnsRef.current.find(
        (c) => c.key.toLowerCase() === cleanLabel || tProp(c.label).toLowerCase() === cleanLabel,
      );
      if (directMatch) return directMatch.key;
      const reverseKey = Object.keys(propertyMap).find(
        (key) => key.toLowerCase() === cleanLabel || propertyMap[key].toLowerCase() === cleanLabel,
      );
      return reverseKey || null;
    },
    [tProp],
  );
''',
    '''  const columnManagement = useColumns(allProducts);
  const { columns } = columnManagement;
  const propertyKeyLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const column of columns) {
      lookup.set(column.key.toLowerCase(), column.key);
      lookup.set(tProp(column.label).toLowerCase(), column.key);
    }
    for (const [key, translatedLabel] of Object.entries(propertyMap)) {
      lookup.set(key.toLowerCase(), key);
      lookup.set(translatedLabel.toLowerCase(), key);
    }
    return lookup;
  }, [columns, tProp]);

  const resolvePropKey = useCallback(
    (label: string): string | null => propertyKeyLookup.get(label.toLowerCase()) ?? null,
    [propertyKeyLookup],
  );
''',
)
replace_once(
    "src/hooks/app/useDatabase.ts",
    "        let matches = false;\n",
    "        let matches: boolean;\n",
)

replace_once(
    "src/lib/adapters/IndexedDBProductAdapter.ts",
    '''      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}. This may be caused by Private Browsing mode or insufficient disk space.`);
''',
    '''      throw new Error(
        `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}. This may be caused by Private Browsing mode or insufficient disk space.`,
        { cause: error },
      );
''',
)

replace_once(
    "src/lib/adapters/RemoteAPIProductAdapter.ts",
    '''        throw new Error(`Remote API request timed out after ${DEFAULT_TIMEOUT_MS} ms`);
''',
    '''        throw new Error(`Remote API request timed out after ${DEFAULT_TIMEOUT_MS} ms`, { cause: error });
''',
)
for old, new in (
    (
        '''      throw new Error(`Remote create failed; no local write was applied: ${describeError(error)}`);
''',
        '''      throw new Error(`Remote create failed; no local write was applied: ${describeError(error)}`, { cause: error });
''',
    ),
    (
        '''      throw new Error(`Remote update failed; no local write was applied: ${describeError(error)}`);
''',
        '''      throw new Error(`Remote update failed; no local write was applied: ${describeError(error)}`, { cause: error });
''',
    ),
    (
        '''      throw new Error(
        `Remote batch update failed; no local write was applied: ${describeError(error)}`,
      );
''',
        '''      throw new Error(
        `Remote batch update failed; no local write was applied: ${describeError(error)}`,
        { cause: error },
      );
''',
    ),
    (
        '''      throw new Error(
        `Remote batch create failed; no local write was applied: ${describeError(error)}`,
      );
''',
        '''      throw new Error(
        `Remote batch create failed; no local write was applied: ${describeError(error)}`,
        { cause: error },
      );
''',
    ),
    (
        '''      throw new Error(`Remote delete failed; no local write was applied: ${describeError(error)}`);
''',
        '''      throw new Error(`Remote delete failed; no local write was applied: ${describeError(error)}`, { cause: error });
''',
    ),
    (
        '''      throw new Error(
        `Remote snapshot restore failed; no local write was applied: ${describeError(error)}`,
      );
''',
        '''      throw new Error(
        `Remote snapshot restore failed; no local write was applied: ${describeError(error)}`,
        { cause: error },
      );
''',
    ),
):
    replace_once("src/lib/adapters/RemoteAPIProductAdapter.ts", old, new)

replace_once(
    "src/services/aiService.ts",
    '''      throw new Error(`AI API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
''',
    '''      throw new Error(`AI API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`, { cause: error });
''',
)

replace_once(
    "src/utils/polymerPhysics.ts",
    '''  let hardness = "D60";
  if (density < 0.88) {
    hardness = `A${Math.round(50 + density * 30)}`; // elastomer/synthetic rubber
  } else {
    hardness = `D${Math.round(40 + (density - 0.88) * 180 + tensileYield * 0.4)}`;
  }
''',
    '''  const hardness = density < 0.88
    ? `A${Math.round(50 + density * 30)}` // elastomer/synthetic rubber
    : `D${Math.round(40 + (density - 0.88) * 180 + tensileYield * 0.4)}`;
''',
)

print("applied ESLint 10 semantic remediation and O(1) property-key lookup")
