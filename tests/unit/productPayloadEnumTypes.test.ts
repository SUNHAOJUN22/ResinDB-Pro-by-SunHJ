import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteAPIProductAdapter } from '@/lib/adapters/RemoteAPIProductAdapter';
import { nativeImportRecord } from '@/lib/importProductRecord';

function product(status: unknown = 'UNKNOWN', governance: Record<string, unknown> = {}) {
  return {
    id: 'enum-fixture',
    gradeName: 'Boundary fixture',
    manufacturerId: 'fixture-manufacturer',
    manufacturer: 'Fixture',
    categoryIds: ['root_plastic'],
    properties: {
      Density: {
        value: 0.95,
        unit: 'g/cm3',
        quantity: {
          raw: { value: 0.95, unit: 'g/cm3' },
          status,
          reasonCodes: [],
          provenanceRefs: [],
        },
      },
    },
    governance: {
      sourceType: 'IMPORTED',
      recordStatus: 'NOT_FOR_RELEASE',
      confidentiality: 'PUBLIC',
      license: 'fixture-only',
      provenanceRefs: [],
      ...governance,
    },
    createdAt: '2026-11-21',
    updatedAt: '2026-11-21',
  };
}

const arrayEnums = [
  { field: 'quantity.status', payload: () => product(['VALID']) },
  { field: 'governance.sourceType', payload: () => product('UNKNOWN', { sourceType: ['IMPORTED'] }) },
  { field: 'governance.recordStatus', payload: () => product('UNKNOWN', { recordStatus: ['NOT_FOR_RELEASE'] }) },
  { field: 'governance.confidentiality', payload: () => product('UNKNOWN', { confidentiality: ['PUBLIC'] }) },
];

function serveProducts(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([payload]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })));
  return new RemoteAPIProductAdapter('https://api.example.test', false);
}

describe('Product enum types at JSON boundaries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(arrayEnums)('rejects an array in $field through RecordJSON import', ({ payload }) => {
    const row = { RecordJSON: JSON.stringify(payload()) };
    expect(() => nativeImportRecord(row)).toThrow(/invalid Product payload/);
  });

  it.each(arrayEnums)('rejects an array in $field through the remote JSON response', async ({ payload }) => {
    await expect(serveProducts(payload()).readAuthoritative()).rejects.toThrow(/invalid Product payload/);
  });

  it('preserves valid string enums through RecordJSON import', () => {
    const payload = product();
    expect(nativeImportRecord({ RecordJSON: JSON.stringify(payload) })).toEqual(payload);
  });

  it('preserves valid string enums through the remote JSON response', async () => {
    const payload = product();
    await expect(serveProducts(payload).readAuthoritative()).resolves.toEqual([payload]);
  });

  it('continues requiring canonical data for the actual VALID string', () => {
    expect(() => nativeImportRecord({ RecordJSON: JSON.stringify(product('VALID')) }))
      .toThrow(/invalid Product payload/);
  });
});
