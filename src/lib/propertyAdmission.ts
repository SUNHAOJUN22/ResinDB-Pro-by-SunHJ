import type { Product, PropertyValue, RawQuantity } from '@/types/index';
import { canonicalizeCoreProperty, parseFiniteReal, resolveCorePropertyKey, verifyCoreQuantityRecord } from '@/lib/quantityRecord';

/** An explicit rejection is authoritative; raw text must never resurrect it. */
export function admittedPropertyValue(property: PropertyValue | undefined): number | null {
  if (!property) return null;
  if (property.quantity !== undefined) {
    const canonical = property.quantity?.status === 'VALID' ? property.quantity.canonical : undefined;
    return canonical && Number.isFinite(canonical.value) ? canonical.value : null;
  }
  return parseFiniteReal(property.value);
}

function rawDeclaration(property: PropertyValue): RawQuantity {
  // Conditions present only in the original quantity record remain declarations.
  // An explicitly cleared top-level field still overrides the original value.
  const raw: RawQuantity = { ...property.quantity?.raw, value: property.value };
  for (const key of ['unit', 'method', 'standard', 'temperature', 'temp', 'load', 'sampleId', 'batchId', 'referenceId', 'sourceUrl'] as const) {
    if (Object.hasOwn(property, key)) Object.assign(raw, { [key]: property[key] });
  }
  return raw;
}

export function refreshProperty(key: string, property: PropertyValue, previous?: PropertyValue, force = false): PropertyValue {
  const raw = rawDeclaration(property);
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
  return quantity === property.quantity ? property : { ...property, quantity };
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
  return refreshProperty(key, { ...(previous ?? { value: '' }), ...patch }, previous ?? { value: '' }, force);
}
