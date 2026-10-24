import { describe, expect, it, vi } from 'vitest';
import { nativeImportRecord } from '@/lib/importProductRecord';
import { parseProductPayload } from '@/lib/productPayload';
import { refreshProperties } from '@/lib/propertyAdmission';
import { IndexedDBProductAdapter } from '@/lib/adapters/IndexedDBProductAdapter';
import { FormulaEngine } from '@/lib/formulaParser';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import type { Product } from '@/types/index';

function product(): Product {
  return {
    id: 'density-integrity', gradeName: 'Recorded sample', manufacturer: 'Lab',
    manufacturerId: 'lab', categoryIds: [], createdAt: '2026-10-24', updatedAt: '2026-10-24',
    properties: { density: { value: 900, unit: 'kg/m³', quantity: canonicalizeCoreProperty('density', { value: 900, unit: 'kg/m³' }, ['measurement-1']) } },
  };
}

function inconsistent(): Product {
  const result = product();
  result.properties.density.quantity!.canonical!.value = 900;
  return result;
}

const evaluate = (sample: Product) => new FormulaEngine().compileResultGraph([
  { id: 'density-copy', name: 'Density copy', expression: "p['density']", unit: 'g/cm³' },
])(sample)['density-copy'];

describe('raw and canonical quantity integrity through real data boundaries', () => {
  it('rejects inconsistent native and remote payloads before formula admission', () => {
    const sample = inconsistent();
    expect(() => nativeImportRecord(sample as unknown as Record<string, unknown>)).toThrow(/quantity/i);
    expect(() => parseProductPayload(sample, 'search[0]')).toThrow(/quantity/i);
  });

  it('quarantines a first-write canonical value inconsistent with its raw measurement', () => {
    const sample = inconsistent();
    const snapshot = structuredClone(sample);
    const properties = refreshProperties(sample.properties);
    expect(properties.density.quantity).toMatchObject({ status: 'INVALID', reasonCodes: expect.arrayContaining(['CANONICAL_RAW_MISMATCH']) });
    expect(properties.density.quantity?.canonical).toBeUndefined();
    expect(evaluate({ ...sample, properties })).toMatchObject({ status: 'UNKNOWN', value: null });
    expect(sample).toEqual(snapshot);
  });

  it('does not preserve an old inconsistent quantity during an unrelated update', () => {
    const sample = inconsistent();
    const properties = refreshProperties(sample.properties, sample.properties);
    expect(properties.density.quantity?.status).toBe('INVALID');
    expect(evaluate({ ...sample, properties }).status).toBe('UNKNOWN');
  });

  it('quarantines historical cache reads without rewriting stored source records', async () => {
    const sample = inconsistent();
    const snapshot = structuredClone(sample);
    const db = { getAll: vi.fn(async () => [sample]), put: vi.fn() };
    const adapter = Object.assign(new IndexedDBProductAdapter(), { simulateLatency: async () => undefined, getDB: async () => db });
    const [loaded] = await adapter.search('', null);
    expect(loaded.properties.density.quantity?.status).toBe('INVALID');
    expect(evaluate(loaded).status).toBe('UNKNOWN');
    expect(db.put).not.toHaveBeenCalled();
    expect(sample).toEqual(snapshot);
  });

  it('quarantines restored cache values while preserving the original snapshot', async () => {
    const sample = inconsistent();
    const snapshot = structuredClone(sample);
    const store = { clear: vi.fn(async () => undefined), add: vi.fn(async () => undefined) };
    const db = { transaction: () => ({ store, done: Promise.resolve() }) };
    const adapter = Object.assign(new IndexedDBProductAdapter(), { simulateLatency: async () => undefined, getDB: async () => db });
    await adapter.restoreSnapshot([sample]);
    const [loaded] = await adapter.search('', null);
    expect(loaded.properties.density.quantity?.status).toBe('INVALID');
    expect(sample).toEqual(snapshot);
  });

  it('preserves valid SI conversions and conservative rejected states', () => {
    const sample = product();
    expect(nativeImportRecord(sample as unknown as Record<string, unknown>)).toEqual(sample);
    expect(evaluate({ ...sample, properties: refreshProperties(sample.properties) })).toMatchObject({ status: 'OK', value: 0.9 });
    for (const status of ['UNKNOWN', 'INVALID'] as const) {
      const quantity = sample.properties.density.quantity!;
      const rejected = { ...quantity, status, canonical: undefined, reasonCodes: ['EXTERNAL_REVIEW_REQUIRED'] };
      const properties = { density: { ...sample.properties.density, quantity: rejected } };
      expect(refreshProperties(properties).density.quantity).toEqual(rejected);
    }
  });

  it('preserves equivalent spellings and does not upgrade synthetic or inferred provenance', () => {
    const sample = product();
    sample.properties.density.quantity!.canonical!.unit = 'g/cm^3';
    sample.governance = { sourceType: 'SYNTHETIC', recordStatus: 'NOT_FOR_RELEASE', confidentiality: 'INTERNAL', license: 'test', provenanceRefs: ['synthetic-input'] };
    const imported = nativeImportRecord(sample as unknown as Record<string, unknown>)!;
    expect(imported.governance).toEqual(sample.governance);
    expect(refreshProperties(imported.properties).density.quantity?.status).toBe('VALID');
    expect(imported.governance?.recordStatus).toBe('NOT_FOR_RELEASE');

    const inferred = product();
    inferred.properties.density.annotation = 'AI-inferred value; unverified';
    inferred.governance = { ...sample.governance, sourceType: 'UNKNOWN', provenanceRefs: ['ai-inference-unverified'] };
    inferred.properties.density.quantity = {
      ...inferred.properties.density.quantity!, status: 'UNKNOWN', canonical: undefined,
      reasonCodes: ['AI_INFERENCE_UNVERIFIED'], provenanceRefs: ['ai-inference-unverified'],
    };
    const admitted = nativeImportRecord(inferred as unknown as Record<string, unknown>)!;
    expect(admitted.governance).toEqual(inferred.governance);
    expect(refreshProperties(admitted.properties).density).toEqual(inferred.properties.density);
    expect(admitted.governance?.sourceType).toBe('UNKNOWN');
  });

  it('rejects canonical unit, dimension and missing-condition mismatches', () => {
    for (const patch of [{ unit: 'kg/m³' }, { dimension: 'pressure' }]) {
      const sample = product();
      Object.assign(sample.properties.density.quantity!.canonical!, patch);
      expect(() => parseProductPayload(sample, 'import')).toThrow(/quantity/i);
    }
    const sample = product();
    const quantity = canonicalizeCoreProperty('mfr', { value: 12, unit: 'g/10 min', method: 'ISO 1133', temperature: 230, load: 2.16 });
    delete quantity.raw.load;
    sample.properties = { mfr: { value: 12, unit: 'g/10 min', quantity } };
    expect(() => parseProductPayload(sample, 'import')).toThrow(/quantity/i);
  });
});
