import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormulaEngine } from '@/lib/formulaParser';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import type { FormulaConfig, Product } from '@/types/index';
import type { MonteCarloResponse } from '@/workers/monteCarloWorker';

afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('@/compute/random'); });
const material = (properties: Product['properties']): Product => ({
  id: 'sample', gradeName: 'Sample', manufacturer: 'Lab', manufacturerId: 'lab', categoryIds: [],
  createdAt: '2026-10-21', updatedAt: '2026-10-21', properties,
});
const formula = (expression: string, unit: string): FormulaConfig => ({ id: 'target', name: 'Target', expression, unit });
async function simulate(product: Product, formulas: FormulaConfig[], variances: Record<string, number> = {}, iterations = 32) {
  vi.resetModules();
  const replies: MonteCarloResponse[] = [];
  const scope: { onmessage?: (event: MessageEvent) => void; postMessage: (message: MonteCarloResponse) => void } = {
    postMessage: message => { if (message.type === 'SIMULATION_COMPLETE' || message.type === 'ERROR') replies.push(message); },
  };
  vi.stubGlobal('self', scope);
  await import('@/workers/monteCarloWorker');
  scope.onmessage!({ data: { type: 'RUN_SIMULATION', payload: { targetFormulaId: 'target', product, formulas, variances, iterations, seed: 'same-samples' } } } as MessageEvent);
  vi.unstubAllGlobals();
  expect(replies).toHaveLength(1);
  return replies[0];
}
function complete(response: MonteCarloResponse) {
  expect(response.type).toBe('SIMULATION_COMPLETE');
  expect(response.payload).toBeDefined();
  const payload = response.payload!;
  expect([payload.stats.mean, payload.stats.stdDev, payload.stats.p5, payload.stats.p95, ...payload.results].every(Number.isFinite)).toBe(true);
  expect(payload.stats.kde.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  return payload;
}

describe('real Monte Carlo worker unit and finite-statistics contract', () => {
  it.each([
    ['density', material({ 密度: { value: 0.958, unit: 'g/cm³' } }), formula("props['密度']", 'kg/m³'), 958],
    ['stress', material({ stress: { value: 51, unit: 'MPa' } }), formula("props['stress']", 'GPa'), 0.051],
  ] as const)('matches deterministic TEST with zero input variance for %s', async (_, sample, target, expected) => {
    const exact = new FormulaEngine().compileResultGraph([target])(sample).target;
    expect(exact).toMatchObject({ status: 'OK', value: expected, scope: 'DIMENSION_CHECKED' });
    const payload = complete(await simulate(sample, [target]));
    expect(payload.stats.mean).toBeCloseTo(expected, 12);
    expect(payload.stats.stdDev).toBe(0);
    expect(payload.results.every(value => value === expected)).toBe(true);
  });

  it('uses declared units across derived formula dependencies', async () => {
    const sample = material({ density: { value: 0.958, unit: 'g/cm³' } });
    const formulas = [
      { id: 'converted', name: 'Converted', expression: "props['density']", unit: 'kg/m³' },
      formula("props['Converted'] + props['density']", 'g/cm³'),
    ];
    const payload = complete(await simulate(sample, formulas));
    const exact = new FormulaEngine().compileResultGraph(formulas)(sample).target;
    expect(exact).toMatchObject({ status: 'OK', value: 1.916 });
    expect(payload.stats.mean).toBeCloseTo(1.916, 12);
  });

  it('perturbs admitted canonical values without stale quantity metadata or source mutation', async () => {
    const raw = { value: 958, unit: 'kg/m³' };
    const sample = material({ density: { ...raw, sampleId: 'lab-sample', quantity: canonicalizeCoreProperty('density', raw, ['source-1']) } });
    const original = structuredClone(sample);
    const grams = complete(await simulate(sample, [formula("props['density']", 'g/cm³')], { density: 5 }, 64));
    const kilograms = complete(await simulate(sample, [formula("props['density']", 'kg/m³')], { density: 5 }, 64));
    expect(grams.stats.stdDev).toBeGreaterThan(0);
    for (let i = 0; i < grams.results.length; i++) expect(kilograms.results[i]).toBeCloseTo(grams.results[i] * 1000, 10);
    expect(kilograms.stats.mean).toBeCloseTo(grams.stats.mean * 1000, 10);
    expect(kilograms.stats.stdDev).toBeCloseTo(grams.stats.stdDev * 1000, 10);
    expect(sample).toEqual(original);
    expect(kilograms.performance).toMatchObject({ workObjectReused: true, numericPropertyDictionaryReused: true, formulaResultObjectReused: true, typedResultBuffer: true });
  });

  it('does not revive a rejected quantity or incompatible output unit', async () => {
    const invalid = material({ density: { value: 0.958, unit: 'g/cm³', quantity: { raw: { value: 0.958 }, status: 'UNKNOWN', reasonCodes: ['MISSING_UNIT'], provenanceRefs: [] } } });
    expect(await simulate(invalid, [formula("props['density']", 'kg/m³')])).toMatchObject({ type: 'ERROR' });
    const typed = material({ density: { value: 0.958, unit: 'g/cm³' } });
    expect(await simulate(typed, [formula("props['density']", 'MPa')])).toMatchObject({ type: 'ERROR' });
  });

  it('keeps a representable extreme constant mean, deviation and KDE finite', async () => {
    const payload = complete(await simulate(material({}), [formula('1e308', '1')]));
    expect(payload.stats.mean).toBe(1e308);
    expect(payload.stats.stdDev).toBe(0);
    expect(payload.stats.kde.some(point => point.y > 0)).toBe(true);
  });

  it('reports an error instead of COMPLETE when the required KDE domain is unrepresentable', async () => {
    const response = await simulate(material({}), [formula(String(Number.MAX_VALUE), '1')]);
    expect(response).toMatchObject({ type: 'ERROR', error: expect.stringContaining('KDE') });
    expect(response.payload).toBeUndefined();
  });

  it('rejects normalization underflow instead of erasing a finite residual to zero', async () => {
    // Control only the draw sequence; the real worker's expression, admission,
    // reductions and completion/error protocol are exercised unchanged.
    vi.doMock('@/compute/random', async () => {
      const actual = await vi.importActual<typeof import('@/compute/random')>('@/compute/random');
      const draws = [1e308, -1e308, 1e-300];
      return { ...actual, createSeededRandom: () => ({ ...actual.createSeededRandom('extreme-draws'), normal: () => draws.shift()! }) };
    });
    const response = await simulate(material({ x: { value: 1, unit: '1' } }), [formula("props['x']", '1')], { x: 1 }, 3);
    expect(response).toMatchObject({ type: 'ERROR', error: expect.stringContaining('underflow') });
    expect(response.payload).toBeUndefined();
  });

  it('reuses sampled result containers and never retains a stale value after a failed draw', () => {
    const engine = new FormulaEngine();
    const sample = material({ density: { value: 958, unit: 'kg/m³', quantity: canonicalizeCoreProperty('density', { value: 958, unit: 'kg/m³' }) } });
    const evaluate = engine.compileSampledPropertyGraph([formula("props['density']", 'kg/m³')], sample);
    const properties = engine.createPropertyDictionary(sample);
    const results: Record<string, number> = {};
    expect(evaluate(properties, results)).toBe(results);
    expect(results.target).toBeCloseTo(958, 12);
    properties.density = 1;
    expect(evaluate(properties, results)).toBe(results);
    expect(results.target).toBe(1000);
    properties.density = NaN;
    expect(evaluate(properties, results)).toBe(results);
    expect(results).not.toHaveProperty('target');
  });
});
