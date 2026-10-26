import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import { buildSpearmanPayload } from '@/lib/spearmanPayload';
import { IndexedDBProductAdapter } from '@/lib/adapters/IndexedDBProductAdapter';
import { UniversalStorageBridge } from '@/lib/adapters/UniversalStorageBridge';
import type { Product } from '@/types/index';
import type { SimilarityMessage, SimilarityResponse } from '@/workers/similarityWorker';

function product(id: string, density: number, unit = 'kg/m³'): Product {
  return {
    id, gradeName: id, manufacturer: 'Lab', manufacturerId: 'lab', categoryIds: [],
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    properties: { density: { value: density, unit, quantity: canonicalizeCoreProperty('density', { value: density, unit }, [`sample-${id}`]) } },
  };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('canonical observation admission at actual consumers', () => {
  it.each([
    ['density', 900, 'kg/m³', 0.9],
    ['mfr', 2, 'g/10 min', 2],
    ['tensileYield', 25, 'MPa', 25],
    ['flexuralModulus', 1200, 'MPa', 1200],
  ] as const)('retains the canonical %s property key through the material bridge', (key, value, unit, expected) => {
    const sample = product('a', 900);
    const raw = { value, unit, method: key === 'mfr' ? 'ISO 1133' : 'Declared method', temperature: 190, load: 2.16 };
    sample.properties = { [key]: { ...raw, quantity: canonicalizeCoreProperty(key, raw, ['source-a']) } };
    const record = UniversalStorageBridge.productToRecord(sample, 'my_lab');
    expect(record.properties[key]?.canonical?.value).toBe(expected);
    expect(record.properties[key]?.raw).toMatchObject(raw);
    expect(record.properties[key]?.provenanceRefs).toEqual(['source-a']);
  });
  it('passes density in canonical units to the real Spearman payload builder', () => {
    const rows = [product('a', 900), product('b', 1.2, 'g/cm³'), product('c', 1000)];
    expect(buildSpearmanPayload(rows, ['density']).map(row => row.values.density)).toEqual([0.9, 1.2, 1]);
  });
  it('omits UNKNOWN, contradictory, and incompatible condition observations from Spearman', () => {
    const rows = [product('a', 900), product('b', 1000), product('c', 1100)];
    rows[0].properties.density.quantity!.status = 'UNKNOWN';
    rows[1].properties.density.quantity!.canonical!.value = 7;
    rows[2].properties.density.quantity!.raw.temperature = 23;
    expect(buildSpearmanPayload(rows, ['density']).slice(0, 2).map(row => row.values)).toEqual([{}, {}]);
    rows.forEach((row, index) => {
      const raw = { value: index + 1, unit: 'g/10 min', method: 'ISO 1133', temperature: index === 0 ? 190 : 230, load: 2.16 };
      row.properties.mfr = { ...raw, quantity: canonicalizeCoreProperty('mfr', raw) };
    });
    expect(buildSpearmanPayload(rows, ['mfr']).map(row => row.values)).toEqual([{}, {}, {}]);
  });
  it('preserves explicit MFR condition clearing across batch persistence and cache', async () => {
    const sample = product('a', 900);
    const raw = { value: 2, unit: 'g/10 min', conditions: { temperature: 190, load: 2.16 }, method: 'ISO 1133' };
    sample.properties.mfr = { value: 2, unit: 'g/10 min', quantity: canonicalizeCoreProperty('mfr', raw) };
    let saved = structuredClone(sample);
    const store = { get: vi.fn(async () => structuredClone(saved)), put: vi.fn(async (row: Product) => { saved = structuredClone(row); }) };
    const adapter = Object.assign(new IndexedDBProductAdapter(), {
      simulateLatency: async () => undefined,
      getDB: async () => ({ getAll: async () => [saved], transaction: () => ({ store, done: Promise.resolve() }) }),
    });
    await adapter.search('', null);
    await adapter.batchUpdate(['a'], { _propertyUpdates: { mfr: { value: 2, temperature: undefined } } });
    expect(saved.properties.mfr.quantity?.status).toBe('UNKNOWN');
    expect(saved.properties.mfr.quantity?.canonical).toBeUndefined();
    expect((await adapter.search('', null))[0].properties.mfr).toEqual(saved.properties.mfr);
    expect(sample.properties.mfr.quantity?.status).toBe('VALID');
  });
  it('rejects unvalidated quantities in the actual similarity worker', async () => {
    const rows = [product('a', 900), product('b', 1000), product('c', 1100)];
    rows.forEach((row, index) => {
      row.properties.flexural = { value: index + 1, unit: 'MPa' };
      row.properties.density.quantity!.status = 'UNKNOWN';
      delete row.properties.density.quantity!.canonical;
    });
    const responses: SimilarityResponse[] = [];
    const scope = { onmessage: null as ((event: MessageEvent<SimilarityMessage>) => void) | null, postMessage: (message: SimilarityResponse) => responses.push(message) };
    vi.stubGlobal('self', scope);
    await import('@/workers/similarityWorker');
    scope.onmessage!({ data: { type: 'CALCULATE_SIMILARITY', payload: { products: rows, features: ['density', 'flexural'], threshold: -1 } } } as MessageEvent<SimilarityMessage>);
    const response = responses.find(row => row.type === 'SIMILARITY_CALCULATED');
    expect(response?.payload?.edges).toEqual([]);
    expect(response?.payload?.diagnostics.excludedFeatureNames).toContain('density');
  });

  it('reads actual storage on refresh and leaves the prior confirmed snapshot stable', async () => {
    let stored = product('a', 900);
    const adapter = Object.assign(new IndexedDBProductAdapter(), {
      simulateLatency: async () => undefined,
      getDB: async () => ({ getAll: async () => [structuredClone(stored)] }),
    });
    const previous = await adapter.search('', null);
    stored = product('a', 1200);
    const refreshed = await adapter.readAuthoritative();
    expect(refreshed[0].properties.density.quantity?.canonical?.value).toBe(1.2);
    expect(previous[0].properties.density.quantity?.canonical?.value).toBe(0.9);
    expect(await adapter.search('', null)).toEqual(refreshed);
  });

  it('recovers the analytic Spearman value for equivalent mixed-unit density measurements', async () => {
    const rows = [product('a', 900), product('b', 1.2, 'g/cm³'), product('c', 1000)];
    [1, 3, 2].forEach((rank, index) => { rows[index].properties.reference = { value: rank }; });
    const replies: any[] = [];
    const scope = { onmessage: null as ((event: MessageEvent) => void) | null, postMessage: (message: unknown) => replies.push(message) };
    vi.stubGlobal('self', scope);
    await import('@/workers/spearmanWorker');
    scope.onmessage!({ data: { type: 'COMPUTE_SPEARMAN', payload: { data: buildSpearmanPayload(rows, ['density', 'reference']), keys: ['density', 'reference'] } } } as MessageEvent);
    // Independent ranks [1, 3, 2] equal the reference: sum(d_i²)=0, rho=1.
    expect(replies.at(-1)).toMatchObject({ type: 'SPEARMAN_RESULT', payload: { matrix: [[1, 1], [1, 1]] } });
  });

  it('returns analytic collinear cosine values after mixed-unit admission', async () => {
    const rows = [product('a', 900), product('b', 1, 'g/cm³'), product('c', 1100), product('d', 1.2, 'g/cm³')];
    rows.forEach((row, index) => { row.properties.flexuralModulus = { value: (index + 1) * 1000, unit: 'MPa', method: 'ISO 178' }; });
    const replies: any[] = [];
    const scope = { onmessage: null as ((event: MessageEvent) => void) | null, postMessage: (message: unknown) => replies.push(message) };
    vi.stubGlobal('self', scope);
    await import('@/workers/similarityWorker');
    scope.onmessage!({ data: { type: 'CALCULATE_SIMILARITY', payload: { products: rows, features: ['density', 'flexuralModulus'], threshold: -1 } } } as MessageEvent);
    const edges = replies.at(-1).payload.edges as { source: string; target: string; value: number }[];
    // Both canonical columns have ranks [1,2,3,4] and proportional centered
    // vectors. The first two row vectors are collinear in the same direction.
    expect(edges.find(edge => edge.source === 'a' && edge.target === 'b')?.value).toBeCloseTo(1, 14);
    expect(edges.find(edge => edge.source === 'a' && edge.target === 'd')?.value).toBeCloseTo(-1, 14);
  });

  it('updates the experimental lab mirror only after a scoped edit commits', async () => {
    const sample = { ...product('a', 900), isExperimental: true };
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    const put = vi.fn(async () => undefined);
    const adapter = Object.assign(new IndexedDBProductAdapter(), {
      simulateLatency: async () => undefined,
      getDB: async () => ({ transaction: () => ({ store: { get: async () => sample, put }, done }) }),
    });
    const mirror = vi.spyOn(UniversalStorageBridge, 'saveLabRecord').mockImplementation(() => undefined);
    const writing = adapter.batchUpdate(['a'], { _propertyUpdates: { density: 1200 } });
    await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
    expect(mirror).not.toHaveBeenCalled();
    finish(); await writing;
    expect(mirror).toHaveBeenCalledOnce();
    expect(mirror.mock.calls[0][0].properties.density?.canonical?.value).toBe(1.2);
  });
});
