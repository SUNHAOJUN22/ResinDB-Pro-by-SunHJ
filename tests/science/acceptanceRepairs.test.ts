import { describe, expect, it } from 'vitest';
import { parseFiniteReal, canonicalizeCoreProperty } from '@/lib/quantityRecord';
import { admittedPropertyValue, patchProperty } from '@/lib/propertyAdmission';
import { FormulaEngine } from '@/lib/formulaParser';
import { calculateTopsisDetailed } from '@/lib/topsisAnalyzer';
import { evaluateFilterGroup } from '@/lib/filterUtils';
import { nativeImportRecord, mergedImportGovernance } from '@/lib/importProductRecord';
import { defaultFormulas, migrateDefaultFormulas } from '@/lib/defaultFormulaMigration';
import { materialEngine } from '@/lib/materialScience';
import type { Product } from '@/types/index';

const product = (properties: Product['properties']): Product => ({ id: 'p', gradeName: 'A', manufacturerId: 'm', manufacturer: 'M', categoryIds: [], createdAt: '2026-10-22', updatedAt: '2026-10-22', properties });
const evaluate = (expression: string, unit: string, properties: Product['properties']) => new FormulaEngine().compileResultGraph([{ id: 'f', name: 'Derived', expression, unit }])(product(properties)).f;

describe('acceptance repair boundaries', () => {
  it.each(['12abc', '0x10', '1e999', '1e-999', '', 'Infinity'])('rejects the entire malformed numeric declaration %s', input => expect(parseFiniteReal(input)).toBeNull());
  it('retains actual zero and scientific notation', () => { expect(parseFiniteReal('0e-999')).toBe(0); expect(parseFiniteReal('1.25e2')).toBe(125); });
  it('never revives an explicitly rejected quantity', () => {
    const property = { value: 12, unit: 'MPa', quantity: canonicalizeCoreProperty('density', { value: 12, unit: 'MPa' }) };
    expect(admittedPropertyValue(property)).toBeNull();
    expect(evaluateFilterGroup(product({ density: property }), { id: 'g', type: 'group', logic: 'AND', conditions: [{ id: 'c', field: 'density', operator: 'gt', value: 1 }] })).toBe(false);
  });
  it('preserves declaration metadata and rebuilds canonical values after edits', () => {
    const original = { value: 1000, unit: 'kg/m³', method: 'ISO 1183', load: 'declared', sampleId: 'sample', batchId: 'batch', provenanceRefs: ['source'], quantity: canonicalizeCoreProperty('density', { value: 1000, unit: 'kg/m³' }, ['source']) };
    expect(patchProperty('density', original, {})).toEqual(original);
    expect(patchProperty('density', original, { value: 1200 })).toMatchObject({ sampleId: 'sample', batchId: 'batch', load: 'declared', quantity: { status: 'VALID', canonical: { value: 1.2 } } });
    expect(patchProperty('density', original, { unit: undefined }).quantity?.status).toBe('UNKNOWN');
  });
  it('retains conditions stored only inside the original raw declaration during edits', () => {
    const original = { value: 2, quantity: canonicalizeCoreProperty('mfr', { value: 2, unit: 'g/10 min', method: 'ISO 1133', conditions: { temperature: '190 °C', load: '2.16 kg' } }) };
    const updated = patchProperty('mfr', original, { value: 3 });
    expect(updated.quantity).toMatchObject({ status: 'VALID', canonical: { value: 3 }, raw: { conditions: { temperature: '190 °C', load: '2.16 kg' } } });
  });
  it('converts compatible declared units before arithmetic', () => {
    expect(evaluate("p['a'] + p['b']", 'GPa', { a: { value: 25, unit: 'MPa' }, b: { value: 0.1, unit: 'GPa' } })).toMatchObject({ status: 'OK', value: 0.125, scope: 'DIMENSION_CHECKED' });
  });
  it('rejects incompatible sums and output dimensions', () => {
    expect(evaluate("p['a'] + p['b']", 'MPa', { a: { value: 1, unit: 'MPa' }, b: { value: 1, unit: 'g/cm³' } }).status).toBe('INVALID');
    expect(evaluate("p['a']", '1', { a: { value: 1, unit: 'MPa' } }).status).toBe('INVALID');
  });
  it('requires dimensionless transcendental arguments and a declared output unit', () => {
    expect(evaluate("log(p['a'])", '1', { a: { value: 1, unit: 'MPa' } }).status).toBe('INVALID');
    expect(evaluate("p['a']", '', { a: { value: 1 } }).status).toBe('INVALID');
  });
  it('identifies legacy numeric-only calculations and mixed-input unknowns', () => {
    expect(evaluate("p['a'] * 2", 'MPa', { a: { value: 3 } })).toMatchObject({ status: 'OK', value: 6, scope: 'NUMERIC_ONLY' });
    expect(evaluate("p['a'] * p['b']", 'MPa', { a: { value: 3, unit: 'MPa' }, b: { value: 2 } }).status).toBe('UNKNOWN');
  });
  it('rejects underflowing literals and dimensioned operations', () => {
    expect(evaluate('1e-999', '1', {}).status).toBe('INVALID');
    expect(evaluate("p['a'] * p['b']", '1', { a: { value: 1e-200, unit: '1' }, b: { value: 1e-200, unit: '1' } }).status).toBe('INVALID');
  });
  it('keeps TOPSIS invariant to a common extreme weight scale', () => {
    const rows = [{ id: 'a', x: -1e308, y: 1 }, { id: 'b', x: 0, y: 2 }, { id: 'c', x: 1e308, y: 3 }];
    const rank = (weight: number) => calculateTopsisDetailed(rows, [{ key: 'x', isLowBest: false, weight }, { key: 'y', isLowBest: true, weight }], (row, key) => row[key as 'x' | 'y']);
    expect([...rank(1e308).scores.values()]).toEqual([...rank(1).scores.values()]);
    expect([...rank(1e308).scores.values()].every(Number.isFinite)).toBe(true);
  });
  it('does not rank an empty criterion set', () => {
    const result = calculateTopsisDetailed([{ id: 'a' }], [], () => 1);
    expect(result.scores.size).toBe(0); expect(result.alternatives[0]).toMatchObject({ eligible: false, score: null, coverage: 0 });
  });
  it('keeps bounds finite at floating-point extremes', () => {
    for (const [values, logarithmic] of [[[Number.MAX_VALUE], false], [[Number.MIN_VALUE], true], [[-Number.MAX_VALUE, Number.MAX_VALUE], false]] as [number[], boolean][]) {
      const bounds = materialEngine.calculateBounds(values, logarithmic);
      expect(Number.isFinite(bounds.min) && Number.isFinite(bounds.max)).toBe(true);
      if (logarithmic) expect(bounds.min).toBeGreaterThan(0);
    }
  });
  it('preserves structured native records and rejects malformed records', () => {
    const record = product({ density: { value: 1, unit: 'g/cm³', sampleId: 's' } });
    expect(nativeImportRecord({ RecordJSON: JSON.stringify(record) })).toEqual(record);
    expect(() => nativeImportRecord({ ...record, properties: { density: { value: false } } })).toThrow();
    expect(() => nativeImportRecord({ RecordJSON: '{bad' })).toThrow();
  });
  it('never weakens merged confidentiality or fabricates release status', () => {
    const a = { sourceType: 'MEASURED', recordStatus: 'MEASURED', confidentiality: 'RESTRICTED', license: 'private', provenanceRefs: ['a'] } as const;
    const result = mergedImportGovernance({ ...a, provenanceRefs: [...a.provenanceRefs] }, undefined);
    expect(result).toMatchObject({ confidentiality: 'RESTRICTED', recordStatus: 'NOT_FOR_RELEASE', sourceType: 'UNKNOWN', provenanceRefs: ['a'] });
  });
  it('ships executable default formulas without fabricated missing-value fallbacks', () => {
    expect(defaultFormulas().every(formula => !formula.expression.includes('||'))).toBe(true);
    expect(migrateDefaultFormulas([])).toEqual([]);
    const custom = { id: 'f_default_spec_strength', name: 'Custom', expression: '1', unit: '1' };
    expect(migrateDefaultFormulas([custom])[0]).toBe(custom);
  });
});


describe('case-sensitive scientific units', () => {
  it('never interprets milli-pascals as mega-pascals or capital G as grams', () => {
    expect(canonicalizeCoreProperty('tensileYield', { value: 1, unit: 'mPa', method: 'ISO 527' })).toMatchObject({ status: 'INVALID', reasonCodes: ['UNKNOWN_OR_INCOMPATIBLE_UNIT'] });
    expect(canonicalizeCoreProperty('density', { value: 1, unit: 'G/cm³' }).status).toBe('INVALID');
    expect(canonicalizeCoreProperty('tensileYield', { value: 1, unit: 'MPa', method: 'ISO 527' }).canonical?.value).toBe(1);
    expect(canonicalizeCoreProperty('density', { value: 950, unit: 'kg/m^3' }).canonical?.value).toBeCloseTo(0.95, 12);
  });
  it('does not accept a differently cased formula unit or inherited registry field', async () => {
    const { unitDefinition } = await import('@/lib/formula/dimensionedExpression');
    expect(unitDefinition('MPa')?.factor).toBe(1e6);
    expect(unitDefinition('mPa')).toBeUndefined();
    expect(unitDefinition('constructor')).toBeUndefined();
    expect(unitDefinition('K')?.dimension).toEqual([0, 0, 0, 1]);
  });
});
