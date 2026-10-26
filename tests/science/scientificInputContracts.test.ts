// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product, PropertyValue } from '@/types/index';
import { extractArrheniusLifetimePoints } from '@/lib/arrheniusInput';
import { filterAnalysisProducts } from '@/lib/analysisFilters';
import { admittedPropertyValue } from '@/lib/propertyAdmission';

function lifetime(value: number, unit: string, hours: number, temperatureC: number): PropertyValue {
  const raw = {
    value, unit, method: 'tensile-retention aging protocol', sampleId: `specimen-${temperatureC}`,
    batchId: 'batch-1', referenceId: 'independent-fixture',
    conditions: {
      observationKind: 'time-to-failure', temperatureC,
      failureCriterion: '50% tensile retention', agingSeriesId: 'aging-series-1',
    },
  };
  return { value, unit, method: raw.method, quantity: {
    raw, canonical: { value: hours, unit: 'h', dimension: 'time' },
    status: 'VALID', reasonCodes: [], provenanceRefs: ['independent-fixture'],
  } };
}

function product(properties: Product['properties'], id = 'aging-product'): Product {
  return { id, gradeName: 'controlled fixture', manufacturerId: 'fixture', manufacturer: 'fixture',
    categoryIds: [], createdAt: '', updatedAt: '', properties };
}

function validSeries(): Product {
  // Each expected hour value is supplied independently, not calculated by the converter under test.
  return product({
    'failure-time-110C': lifetime(120, 'min', 2, 110),
    'failure-time-130C': lifetime(3600, 's', 1, 130),
    'failure-time-150C': lifetime(0.5, 'h', 0.5, 150),
    'failure-time-170C': lifetime(1 / 96, 'd', 0.25, 170),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('explicit Arrhenius lifetime input contract', () => {
  it('converts declared time units to hours without changing observations or source records', () => {
    const source = validSeries();
    const snapshot = structuredClone(source);
    const result = extractArrheniusLifetimePoints(source);
    expect(result.points).toEqual([
      { tempC: 110, time: 2 }, { tempC: 130, time: 1 },
      { tempC: 150, time: 0.5 }, { tempC: 170, time: 0.25 },
    ]);
    expect(result.sourceKeys).toEqual(Object.keys(source.properties));
    expect(result).toMatchObject({ failureCriterion: '50% tensile retention', seriesId: 'aging-series-1', method: 'tensile-retention aging protocol' });
    expect(source).toEqual(snapshot);
  });

  it('preserves the original two-distinct-temperature mathematical input capability', () => {
    const source = validSeries();
    delete source.properties['failure-time-150C'];
    delete source.properties['failure-time-170C'];
    expect(extractArrheniusLifetimePoints(source).points).toHaveLength(2);
  });

  it.each([
    { name: 'OIT assay', key: 'OIT_110C', unit: 'min' },
    { name: 'temperature-tagged strength', key: 'Strength_110C', unit: 'MPa' },
  ])('does not infer a failure-time observation from $name', ({ key, unit }) => {
    const source = product({ [key]: { value: 50, unit }, [`${key}-2`]: { value: 25, unit } });
    expect(() => extractArrheniusLifetimePoints(source)).toThrow();
  });

  it.each([
    { name: 'UNKNOWN quantity', mutate: (p: PropertyValue) => { p.quantity!.status = 'UNKNOWN'; } },
    { name: 'INVALID quantity', mutate: (p: PropertyValue) => { p.quantity!.status = 'INVALID'; } },
    { name: 'wrong physical dimension', mutate: (p: PropertyValue) => { p.quantity!.canonical!.dimension = 'pressure'; } },
    { name: 'wrong stored canonical value', mutate: (p: PropertyValue) => { p.quantity!.canonical!.value = 120; } },
    { name: 'displayed/raw disagreement', mutate: (p: PropertyValue) => { p.value = 1200; } },
    { name: 'missing failure criterion', mutate: (p: PropertyValue) => { delete p.quantity!.raw.conditions!.failureCriterion; } },
    { name: 'different test series', mutate: (p: PropertyValue) => { p.quantity!.raw.conditions!.agingSeriesId = 'other-series'; } },
    { name: 'different failure criterion', mutate: (p: PropertyValue) => { p.quantity!.raw.conditions!.failureCriterion = '20% retention'; } },
    { name: 'different method', mutate: (p: PropertyValue) => { p.method = 'different protocol'; p.quantity!.raw.method = p.method; } },
    { name: 'absolute zero', mutate: (p: PropertyValue) => { p.quantity!.raw.conditions!.temperatureC = -273.15; } },
    { name: 'contradictory OIT method', mutate: (p: PropertyValue) => { p.method = 'oxidation induction time assay'; p.quantity!.raw.method = p.method; } },
  ])('rejects $name instead of mixing it into a scientific fit', ({ mutate }) => {
    const source = validSeries();
    mutate(source.properties['failure-time-110C']);
    expect(() => extractArrheniusLifetimePoints(source)).toThrow();
  });

  it('cannot promote explicitly mislabelled OIT into a lifetime observation', () => {
    const source = validSeries();
    source.properties.OIT_110C = source.properties['failure-time-110C'];
    delete source.properties['failure-time-110C'];
    expect(() => extractArrheniusLifetimePoints(source)).toThrow(/OIT|induction/i);
  });

  it('keeps hour-valued extrapolation consistent with an independent analytic lifetime curve', async () => {
    // The oracle is t_hours = exp(4000/T_K - 10), independent of the worker OLS.
    const temperatures = [110, 130, 150];
    const source = product(Object.fromEntries(temperatures.map(tempC => {
      const hours = Math.exp(4000 / (tempC + 273.15) - 10);
      return [`failure-time-${tempC}C`, lifetime(hours * 60, 'min', hours, tempC)];
    })));
    const points = extractArrheniusLifetimePoints(source).points;
    const replies: Array<{ type: string; payload?: { equation: { m: number; b: number } }; error?: string }> = [];
    const scope: { onmessage?: (event: MessageEvent) => void; postMessage: (value: typeof replies[number]) => void } = {
      postMessage: value => replies.push(value),
    };
    vi.resetModules();
    vi.stubGlobal('self', scope);
    await import('@/workers/arrheniusWorker');
    scope.onmessage!({ data: { type: 'CALCULATE_ARRHENIUS', payload: { points } } } as MessageEvent);
    const result = replies.at(-1);
    expect(result?.type, result?.error).toBe('ARRHENIUS_RESULT');
    const equation = result!.payload!.equation;
    const expected = Math.exp(4000 / 298.15 - 10);
    const actual = Math.exp(equation.m / 298.15 + equation.b);
    expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-10);
  });
});

describe('analysis filters share the plot observation contract', () => {
  const density = product({
    density: {
      value: 900, unit: 'kg/m3', quantity: {
        raw: { value: 900, unit: 'kg/m3' }, status: 'VALID', reasonCodes: [], provenanceRefs: [],
        canonical: { value: 0.9, unit: 'g/cm³', dimension: 'mass_density' },
      },
    },
  }, 'canonical-density');
  const accessor = (p: Product, key: string) => admittedPropertyValue(p.properties[key], key) ?? NaN;

  it('selects canonical density 0.9 within 0.8–1.0 instead of filtering raw 900', () => {
    expect(filterAnalysisProducts([density], { density: { min: '0.8', max: '1.0' } }, accessor)).toEqual([density]);
  });
  it('uses the same formula accessor and preserves finite formula values with blank bounds', () => {
    const formula = vi.fn((p: Product, key: string) => key === 'formula_density_index' ? accessor(p, 'density') * 100 : accessor(p, key));
    expect(filterAnalysisProducts([density], { formula_density_index: { min: '', max: '' } }, formula)).toEqual([density]);
    expect(filterAnalysisProducts([density], { formula_density_index: { min: '89', max: '91' } }, formula)).toEqual([density]);
    expect(formula).toHaveBeenCalledWith(density, 'formula_density_index');
  });
  it('excludes invalid observations and nonfinite formula results without zero substitution', () => {
    const invalid = structuredClone(density);
    invalid.properties.density.quantity!.status = 'INVALID';
    expect(filterAnalysisProducts([invalid], { density: { min: '', max: '' } }, accessor)).toEqual([]);
    expect(filterAnalysisProducts([density], { formula_invalid: { min: '', max: '' } }, () => NaN)).toEqual([]);
  });
  it('does not treat malformed or reversed filter bounds as an unrestricted cohort', () => {
    expect(filterAnalysisProducts([density], { density: { min: 'invalid', max: '' } }, accessor)).toEqual([]);
    expect(filterAnalysisProducts([density], { density: { min: '2', max: '1' } }, accessor)).toEqual([]);
  });
});
