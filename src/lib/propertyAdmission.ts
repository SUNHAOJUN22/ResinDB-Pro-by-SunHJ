import type { Product, PropertyValue, RawQuantity } from '@/types/index';
import { canonicalizeCoreProperty, parseFiniteReal, resolveCorePropertyKey, verifyCoreQuantityRecord } from '@/lib/quantityRecord';

/** An explicit rejection is authoritative; raw text must never resurrect it. */
export function admittedPropertyValue(property: PropertyValue | undefined, key: string): number | null {
  if (!property) return null;
  if (!propertyQuantityMatchesDeclaration(key, property)) return null;
  if (property.quantity !== undefined) {
    const canonical = property.quantity?.status === 'VALID' ? property.quantity.canonical : undefined;
    return canonical && Number.isFinite(canonical.value) ? canonical.value : null;
  }
  return parseFiniteReal(property.value);
}

type ClearedCondition = 'temperature' | 'load';

function rawDeclaration(property: PropertyValue, clearedConditions: ReadonlySet<ClearedCondition> = new Set()): RawQuantity {
  // Conditions present only in the original quantity record remain declarations.
  // An explicitly cleared top-level field still overrides the original value.
  const raw: RawQuantity = { ...property.quantity?.raw, value: property.value };
  for (const key of ['unit', 'method', 'standard', 'temperature', 'temp', 'load', 'sampleId', 'batchId', 'referenceId', 'sourceUrl'] as const) {
    if (Object.hasOwn(property, key)) Object.assign(raw, { [key]: property[key] });
  }
  if (clearedConditions.has('temperature')) {
    delete raw.temperature;
    delete raw.temp;
  }
  if (clearedConditions.has('load')) delete raw.load;
  if (raw.conditions && clearedConditions.size > 0) {
    const conditions = { ...raw.conditions };
    for (const condition of clearedConditions) delete conditions[condition];
    raw.conditions = conditions;
  }
  return raw;
}

function sameMeasurementField(field: 'temperature' | 'temp' | 'load', declared: unknown, persisted: unknown): boolean {
  if (Object.is(declared, persisted)) return true;
  const declaredNumber = parseFiniteReal(declared);
  const persistedNumber = parseFiniteReal(persisted);
  return declaredNumber !== null && declaredNumber === persistedNumber;
}

function propertyMetadataMatchesRaw(property: PropertyValue, raw: RawQuantity): boolean {
  for (const field of ['method', 'standard'] as const) {
    if (Object.hasOwn(property, field) && raw[field] !== undefined && !Object.is(property[field], raw[field])) return false;
  }

  const rawTemperature = raw.temperature ?? raw.temp ?? raw.conditions?.temperature;
  const rawLoad = raw.load ?? raw.conditions?.load;
  for (const field of ['temperature', 'temp'] as const) {
    if (Object.hasOwn(property, field) && property[field] !== undefined && rawTemperature !== undefined
        && !sameMeasurementField(field, property[field], rawTemperature)) return false;
  }
  if (Object.hasOwn(property, 'load') && property.load !== undefined && rawLoad !== undefined
      && !sameMeasurementField('load', property.load, rawLoad)) return false;

  for (const field of ['sampleId', 'batchId', 'referenceId', 'sourceUrl'] as const) {
    if (Object.hasOwn(property, field) && raw[field] !== undefined && !Object.is(property[field], raw[field])) return false;
  }
  return true;
}

/** A VALID embedded quantity must represent the same measurement shown on the property. */
export function propertyQuantityMatchesDeclaration(key: string, property: PropertyValue): boolean {
  const quantity = property.quantity;
  if (!quantity || quantity.status !== 'VALID' || resolveCorePropertyKey(key) === null) return true;

  const verified = verifyCoreQuantityRecord(key, quantity);
  const declared = canonicalizeCoreProperty(
    key,
    rawDeclaration(property),
    property.provenanceRefs ?? quantity.provenanceRefs,
  );
  const actual = verified.canonical;
  const expected = declared.canonical;
  if (verified.status !== 'VALID' || declared.status !== 'VALID' || !actual || !expected
      || !quantity.raw || !propertyMetadataMatchesRaw(property, quantity.raw)) return false;

  const unitIdentity = (unit: string) => unit.normalize('NFKC').trim().replace(/\s+/g, '').replace(/\^([23])/g, '$1');
  const compatibleValue = Math.abs(actual.value - expected.value)
    <= 8 * Number.EPSILON * Math.max(Math.abs(actual.value), Math.abs(expected.value));
  return compatibleValue
    && unitIdentity(actual.unit) === unitIdentity(expected.unit)
    && actual.dimension === expected.dimension;
}

export function refreshProperty(
  key: string,
  property: PropertyValue,
  previous?: PropertyValue,
  force = false,
  clearedConditions: ReadonlySet<ClearedCondition> = new Set(),
): PropertyValue {
  const raw = rawDeclaration(property, clearedConditions);
  const previousProvenance = previous?.provenanceRefs ?? previous?.quantity?.provenanceRefs;
  const provenance = property.provenanceRefs
    ?? property.quantity?.provenanceRefs
    ?? previousProvenance
    ?? [];
  const unchanged = previous && JSON.stringify(raw) === JSON.stringify(rawDeclaration(previous))
    && JSON.stringify(provenance) === JSON.stringify(previousProvenance);
  if (unchanged && !force) return verifyPropertyQuantity(key, { ...property, ...(previous.quantity ? { quantity: previous.quantity } : {}) });
  if (!previous && property.quantity !== undefined) return verifyPropertyQuantity(key, { ...property });
  if (!resolveCorePropertyKey(key) && property.quantity === undefined && previous?.quantity === undefined) return { ...property };
  return { ...property, quantity: canonicalizeCoreProperty(key, raw, provenance) };
}

function verifyPropertyQuantity(key: string, property: PropertyValue): PropertyValue {
  if (property.quantity === undefined) return property;
  const quantity = verifyCoreQuantityRecord(key, property.quantity);
  const verifiedProperty = quantity === property.quantity ? property : { ...property, quantity };
  if (quantity.status === 'VALID' && !propertyQuantityMatchesDeclaration(key, verifiedProperty)) {
    const rejected = { ...quantity };
    delete rejected.canonical;
    return {
      ...property,
      quantity: {
        ...rejected,
        status: 'INVALID',
        reasonCodes: [...new Set([...quantity.reasonCodes, 'PROPERTY_DECLARATION_MISMATCH'])],
      },
    };
  }
  return verifiedProperty;
}

/** Quarantine inconsistent historical quantities in memory without rewriting
 * source records, inventing legacy metadata, or admitting rejected quantities. */
export function verifyPropertyQuantities(properties: Product['properties']): Product['properties'] {
  return Object.fromEntries(Object.entries(properties).map(([key, property]) => [key, verifyPropertyQuantity(key, property)]));
}

export function refreshProperties(properties: Product['properties'], previous?: Product['properties']): Product['properties'] {
  return Object.fromEntries(Object.entries(properties).map(([key, property]) => [key, refreshProperty(key, property, previous?.[key])]));
}

export function patchProperty(key: string, previous: PropertyValue | undefined, patch: Partial<PropertyValue>, force = false): PropertyValue {
  const clearedConditions = new Set<ClearedCondition>();
  // temperature and temp are aliases; clearing either removes the logical condition.
  if ((Object.hasOwn(patch, 'temperature') && patch.temperature === undefined)
      || (Object.hasOwn(patch, 'temp') && patch.temp === undefined)) clearedConditions.add('temperature');
  if (Object.hasOwn(patch, 'load') && patch.load === undefined) clearedConditions.add('load');
  const updated = refreshProperty(key, { ...(previous ?? { value: '' }), ...patch }, previous ?? { value: '' }, force, clearedConditions);
  if (clearedConditions.has('temperature')) {
    delete updated.temperature;
    delete updated.temp;
  }
  if (clearedConditions.has('load')) delete updated.load;
  return updated;
}
