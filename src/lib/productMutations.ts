import { isEqual } from 'lodash';
import type { Product, ProductUpdates, PropertyValue } from '@/types/index';
import { patchProperty, refreshProperties } from '@/lib/propertyAdmission';

/** One transformation for the optimistic projection, persistent row and cache.
 * In particular, condition clearing must use patchProperty rather than spread:
 * a removed MFR temperature/load must not survive in quantity.raw.conditions.
 */
export function applyProductUpdates(product: Product, updates: ProductUpdates, updatedAt = new Date().toISOString().split('T')[0]): Product {
  if (updates.id !== undefined && updates.id !== product.id) throw new Error('PRODUCT_IDENTITY_CHANGE');
  const { _propertyUpdates, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, properties: replacement, ...fields } = updates;
  let properties = replacement === undefined ? product.properties : refreshProperties(replacement, product.properties);
  if (_propertyUpdates) {
    properties = { ...properties };
    for (const [key, patch] of Object.entries(_propertyUpdates)) {
      properties[key] = patchProperty(key, properties[key], typeof patch === 'object' && patch !== null ? patch : { value: patch });
    }
  }
  return { ...product, ...fields, properties, updatedAt };
}

export function updateFields(updates: ProductUpdates): string[] {
  return [
    ...Object.keys(updates).filter(key => !['_propertyUpdates', 'id', 'createdAt', 'updatedAt'].includes(key)),
    ...Object.keys(updates._propertyUpdates ?? {}).map(key => `properties/${key}`),
  ];
}

/** Capture the original editor base. Replay only the user's changed fields on
 * the current confirmed row; a stale form must not undo another completed edit.
 */
export function productEdit(base: Product, draft: Product) {
  if (base.id !== draft.id) throw new Error('PRODUCT_IDENTITY_CHANGE');
  const fields: Partial<Product> = {};
  const fieldNames = new Set([...Object.keys(base), ...Object.keys(draft)]);
  for (const field of fieldNames) {
    if (['id', 'properties', 'createdAt', 'updatedAt'].includes(field)) continue;
    const key = field as keyof Product;
    if (!isEqual(base[key], draft[key])) Object.assign(fields, { [key]: draft[key] });
  }
  const properties = new Map<string, Partial<PropertyValue> | null>();
  for (const key of new Set([...Object.keys(base.properties), ...Object.keys(draft.properties)])) {
    const original = base.properties[key];
    const edited = draft.properties[key];
    if (isEqual(original, edited)) continue;
    if (!edited) { properties.set(key, null); continue; }
    if (!original) { properties.set(key, edited); continue; }
    const patch: Partial<PropertyValue> = {};
    for (const field of new Set([...Object.keys(original), ...Object.keys(edited)])) {
      const name = field as keyof PropertyValue;
      if (!isEqual(original[name], edited[name])) Object.assign(patch, { [name]: edited[name] });
    }
    properties.set(key, patch);
  }
  const removesProperty = [...properties.values()].some(value => value === null);
  return {
    fields: [...Object.keys(fields), ...(removesProperty ? ['properties'] : [...properties.keys()].map(key => `properties/${key}`))],
    updates(current: Product): ProductUpdates {
      const updatedProperties = { ...current.properties };
      const propertyUpdates: Record<string, PropertyValue> = {};
      for (const [key, patch] of properties) {
        if (patch === null) delete updatedProperties[key];
        else {
          const value = patchProperty(key, current.properties[key], patch);
          updatedProperties[key] = value;
          propertyUpdates[key] = value;
        }
      }
      return {
        ...fields,
        ...(removesProperty ? { properties: updatedProperties } : properties.size ? { _propertyUpdates: propertyUpdates } : {}),
      };
    },
  };
}

export async function awaitAllWrites(writes: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(writes);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) throw failure.reason;
}
