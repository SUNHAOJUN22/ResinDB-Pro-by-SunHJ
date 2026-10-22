import type { Product, DataGovernanceMetadata } from '@/types/index';
import { parseProductPayload } from '@/lib/productPayload';

/** Structured imports fail closed instead of silently falling back to flattened cells. */
export function nativeImportRecord(row: Record<string, unknown>): Product | null {
  if (Object.hasOwn(row, 'RecordJSON')) return parseProductPayload(JSON.parse(String(row.RecordJSON)), 'RecordJSON', 'Import');
  if (Object.hasOwn(row, 'properties')) return parseProductPayload(row, 'native record', 'Import');
  if (Object.hasOwn(row, 'PropertiesJSON')) {
    return parseProductPayload({
      id: row.ID, gradeName: row.Grade, manufacturer: row.Manufacturer,
      manufacturerId: row.ManufacturerId ?? 'm-import', categoryIds: String(row.Category ?? '').split('|').filter(Boolean),
      createdAt: row.Created ?? row.Updated, updatedAt: row.Updated,
      properties: JSON.parse(String(row.PropertiesJSON)),
      ...(row.GovernanceJSON ? { governance: JSON.parse(String(row.GovernanceJSON)) } : {}),
    }, 'structured CSV', 'Import');
  }
  return null;
}

export function mergedImportGovernance(left?: DataGovernanceMetadata, right?: DataGovernanceMetadata): DataGovernanceMetadata {
  const levels = { PUBLIC: 0, INTERNAL: 1, UNKNOWN: 2, RESTRICTED: 3 } as const;
  const confidentiality = [left?.confidentiality ?? 'UNKNOWN', right?.confidentiality ?? 'UNKNOWN']
    .sort((a, b) => levels[b] - levels[a])[0];
  return {
    sourceType: left?.sourceType === right?.sourceType && left ? left.sourceType : 'UNKNOWN',
    recordStatus: 'NOT_FOR_RELEASE', confidentiality,
    license: [...new Set([left?.license ?? 'UNKNOWN', right?.license ?? 'UNKNOWN'])].join(' | '),
    provenanceRefs: [...new Set([...(left?.provenanceRefs ?? []), ...(right?.provenanceRefs ?? [])])],
  };
}
