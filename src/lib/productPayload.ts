import type { Product, PropertyValue } from '@/types/index';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const STRING_PROPERTY_FIELDS = ['unit', 'method', 'sampleId', 'batchId', 'standard', 'referenceId', 'instrument', 'sourceUrl', 'annotation', 'temp'] as const;
const NUMBER_PROPERTY_FIELDS = ['mean', 'stdDev', 'min', 'max', 'count'] as const;

function isPropertyValue(value: unknown): value is PropertyValue {
  if (!isRecord(value)) return false;
  if (typeof value.value !== 'string' && !(typeof value.value === 'number' && Number.isFinite(value.value))) return false;
  if (STRING_PROPERTY_FIELDS.some((field) => value[field] !== undefined && typeof value[field] !== 'string')) return false;
  if (NUMBER_PROPERTY_FIELDS.some((field) => value[field] !== undefined && !(typeof value[field] === 'number' && Number.isFinite(value[field])))) return false;
  if (['temperature', 'load'].some(field => value[field] !== undefined && typeof value[field] !== 'string' && !(typeof value[field] === 'number' && Number.isFinite(value[field])))) return false;
  if (value.provenanceRefs !== undefined && !stringArray(value.provenanceRefs)) return false;
  if (value.quantity !== undefined) {
    const quantity = value.quantity;
    if (!isRecord(quantity) || !isRecord(quantity.raw) || !['VALID', 'UNKNOWN', 'INVALID'].includes(String(quantity.status)) || !stringArray(quantity.reasonCodes) || !stringArray(quantity.provenanceRefs)) return false;
    const canonical = quantity.canonical;
    if (quantity.status === 'VALID' && (!isRecord(canonical) || typeof canonical.value !== 'number' || !Number.isFinite(canonical.value) || typeof canonical.unit !== 'string' || !canonical.unit.trim() || typeof canonical.dimension !== 'string' || !canonical.dimension.trim())) return false;
    if (quantity.status !== 'VALID' && canonical !== undefined) return false;
  }
  return true;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

export function parseProductPayload(payload: unknown, context: string, source = 'Remote API'): Product {
  if (
    !isRecord(payload) ||
    typeof payload.id !== 'string' || !payload.id.trim() ||
    typeof payload.gradeName !== 'string' || !payload.gradeName.trim() ||
    typeof payload.manufacturerId !== 'string' || !payload.manufacturerId.trim() ||
    typeof payload.manufacturer !== 'string' || !payload.manufacturer.trim() ||
    !Array.isArray(payload.categoryIds) ||
    !payload.categoryIds.every((id) => typeof id === 'string') ||
    !isRecord(payload.properties) ||
    !Object.values(payload.properties).every(isPropertyValue) ||
    !isIsoDate(payload.createdAt) ||
    !isIsoDate(payload.updatedAt) ||
    (payload.governance !== undefined && !isGovernance(payload.governance)) ||
    (payload.isExperimental !== undefined && typeof payload.isExperimental !== 'boolean') ||
    (payload.tags !== undefined && (!Array.isArray(payload.tags) || !payload.tags.every((tag) => typeof tag === 'string'))) ||
    (payload.priority !== undefined && !(typeof payload.priority === 'number' && Number.isFinite(payload.priority)))
  ) {
    throw new Error(`${source} returned an invalid Product payload for ${context}`);
  }
  return payload as unknown as Product;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function isGovernance(value: unknown): boolean {
  return isRecord(value)
    && ['DEMO', 'SYNTHETIC', 'REFERENCE', 'MEASURED', 'IMPORTED', 'UNKNOWN'].includes(String(value.sourceType))
    && ['DEMO', 'SYNTHETIC', 'REFERENCE', 'MEASURED', 'IMPORTED', 'NOT_FOR_RELEASE', 'UNKNOWN'].includes(String(value.recordStatus))
    && ['PUBLIC', 'INTERNAL', 'RESTRICTED', 'UNKNOWN'].includes(String(value.confidentiality))
    && typeof value.license === 'string' && stringArray(value.provenanceRefs)
    && (value.lastVerifiedAt === undefined || isIsoDate(value.lastVerifiedAt));
}
