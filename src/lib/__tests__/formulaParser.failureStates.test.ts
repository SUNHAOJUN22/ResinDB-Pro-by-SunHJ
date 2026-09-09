import { describe, expect, it } from 'vitest';
import { FormulaEngine } from '@/lib/formulaParser';
import type { FormulaConfig, Product } from '@/types/index';

const product = (properties: Product['properties']): Product => ({
  id: 'P-1', gradeName: 'Example', manufacturerId: 'M-1', manufacturer: 'M',
  categoryIds: ['C-1'], createdAt: '2026-08-12', updatedAt: '2026-08-12', properties,
});

describe('FormulaEngine structured failure states', () => {
  it('returns UNKNOWN for a missing dependency instead of zero', () => {
    const engine = new FormulaEngine();
    const formulas: FormulaConfig[] = [{ id: 'F-1', name: 'Specific', expression: "props['A'] / props['B']", unit: 'MPa' }];
    const result = engine.compileResultGraph(formulas)(product({ A: { value: 5 } }));
    expect(result['F-1'].status).toBe('UNKNOWN');
    expect(result['F-1'].value).toBeNull();
    expect(engine.compileGraph(formulas)(product({ A: { value: 5 } }))).not.toHaveProperty('F-1');
  });

  it('keeps a real zero as OK', () => {
    const engine = new FormulaEngine();
    const result = engine.compileResultGraph([
      { id: 'F-0', name: 'Zero', expression: "props['A'] - props['A']", unit: 'MPa' },
    ])(product({ A: { value: 5 } }));
    expect(result['F-0']).toMatchObject({ status: 'OK', value: 0 });
  });

  it('returns INVALID for domain/non-finite errors', () => {
    const engine = new FormulaEngine();
    const result = engine.compileResultGraph([
      { id: 'F-DIV', name: 'Div', expression: "props['A'] / props['B']", unit: '1' },
    ])(product({ A: { value: 1 }, B: { value: 0 } }));
    expect(result['F-DIV'].status).toBe('INVALID');
    expect(result['F-DIV'].value).toBeNull();
  });

  it('returns INVALID for a cycle and for missing output units', () => {
    const engine = new FormulaEngine();
    const cycle = engine.compileResultGraph([
      { id: 'F-A', name: 'A', expression: "props['B'] + 1", unit: '1' },
      { id: 'F-B', name: 'B', expression: "props['A'] + 1", unit: '1' },
    ])(product({}));
    expect(cycle['F-A'].status).toBe('INVALID');
    expect(cycle['F-B'].status).toBe('INVALID');

    engine.clearCache();
    const noUnit = engine.compileResultGraph([
      { id: 'F-U', name: 'NoUnit', expression: "props['A'] + 1" },
    ])(product({ A: { value: 1 } }));
    expect(noUnit['F-U']).toMatchObject({ status: 'INVALID', value: null, reason: 'MISSING_OUTPUT_UNIT' });
  });
});

describe('FormulaEngine plan and result isolation', () => {
  it('recompiles edited formulas while preserving previously compiled executors', () => {
    const engine = new FormulaEngine();
    const formulas: FormulaConfig[] = [{ id: 'F-1', name: 'Derived', expression: "p['A'] * 2", unit: '1' }];
    const original = engine.compilePropertyGraph(formulas);
    expect(original({ A: 3 })).toEqual({ 'F-1': 6 });
    formulas[0].expression = "p['A'] * 3";
    const updated = engine.compilePropertyGraph(formulas);
    expect(updated({ A: 3 })).toEqual({ 'F-1': 9 });
    expect(original({ A: 3 })).toEqual({ 'F-1': 6 });
    expect(engine.compilePropertyGraph(formulas.map((formula) => ({ ...formula })))).toBe(updated);
  });

  it('recompiles changed identifiers, units and formula-array membership', () => {
    const engine = new FormulaEngine();
    const formulas: FormulaConfig[] = [{ id: 'F-1', name: 'Derived', expression: "p['A']", unit: '1' }];
    engine.compilePropertyResultGraph(formulas);
    formulas[0].id = 'F-2';
    formulas[0].name = 'Renamed';
    formulas[0].unit = 'MPa';
    formulas.push({ id: 'F-3', name: 'Next', expression: "p['Renamed'] * 2", unit: 'MPa' });
    const result = engine.compilePropertyResultGraph(formulas)({ A: 3 });
    expect(result).not.toHaveProperty('F-1');
    expect(result['F-2']).toMatchObject({ status: 'OK', value: 3, unit: 'MPa' });
    expect(result['F-3']).toMatchObject({ status: 'OK', value: 6 });
    formulas.pop();
    expect(engine.compilePropertyGraph(formulas)({ A: 3 })).toEqual({ 'F-2': 3 });
  });

  it('recovers from an invalid plan after an in-place cycle correction', () => {
    const engine = new FormulaEngine();
    const formulas: FormulaConfig[] = [{ id: 'F-1', name: 'Derived', expression: "p['Derived'] + 1", unit: '1' }];
    const invalid = engine.compilePropertyResultGraph(formulas);
    expect(invalid({})['F-1'].status).toBe('INVALID');
    formulas[0].expression = "p['A'] + 1";
    const corrected = engine.compilePropertyResultGraph(formulas);
    expect(corrected({ A: 3 })['F-1']).toMatchObject({ status: 'OK', value: 4 });
    expect(invalid({})['F-1'].dependencies).toEqual(['Derived']);
  });

  it.each([
    [{}, 'UNKNOWN'],
    [{ A: 0 }, 'INVALID'],
  ] as [Record<string, number>, 'UNKNOWN' | 'INVALID'][])('removes a previous numeric result on a failed evaluation: %s', (input, status) => {
    const engine = new FormulaEngine();
    const formulas: FormulaConfig[] = [{ id: 'F-1', name: 'Inverse', expression: "1 / p['A']", unit: '1' }];
    const execute = engine.compilePropertyGraph(formulas);
    const buffer: Record<string, number> = { unrelated: 77 };
    expect(execute({ A: 2 }, buffer)).toBe(buffer);
    expect(buffer['F-1']).toBe(0.5);
    expect(execute(input, buffer)).toBe(buffer);
    expect(buffer).toEqual({ unrelated: 77 });
    expect(engine.compilePropertyResultGraph(formulas)(input)['F-1'].status).toBe(status);
    expect(execute({ A: 4 }, buffer)['F-1']).toBe(0.25);
  });

  it('clears owned numeric entries when the whole graph is invalid', () => {
    const engine = new FormulaEngine();
    const execute = engine.compilePropertyGraph([
      { id: 'F-1', name: 'Cycle', expression: "p['Cycle']", unit: '1' },
    ]);
    const buffer = { 'F-1': 42, unrelated: 7 };
    expect(execute({}, buffer)).toBe(buffer);
    expect(buffer).toEqual({ unrelated: 7 });
  });

  it.each([
    { id: 'F-1', name: 'Derived', expression: "1 / p['A']", unit: '1' },
    { id: 'F-1', name: 'Derived', expression: "p['Missing']", unit: '1' },
    { id: 'F-1', name: 'Derived', expression: 'sqrt(', unit: '1' },
    { id: 'F-1', name: 'Derived', expression: "p['A']" },
  ])('does not use stale input values after upstream failure: $expression', (upstream) => {
    const engine = new FormulaEngine();
    const input = { A: 0, Derived: 9, Next: 99 };
    const result = engine.compilePropertyResultGraph([
      upstream,
      { id: 'F-2', name: 'Next', expression: "p['Derived'] * 2", unit: '1' },
      { id: 'F-3', name: 'Last', expression: "p['Next'] + 1", unit: '1' },
    ])(input);
    expect(result['F-1'].status).not.toBe('OK');
    expect(result['F-2']).toMatchObject({ status: 'UNKNOWN', value: null });
    expect(result['F-3']).toMatchObject({ status: 'UNKNOWN', value: null });
    expect(input).toEqual({ A: 0, Derived: 9, Next: 99 });
  });

  it('publishes fresh derived values after successful upstream evaluation', () => {
    const result = new FormulaEngine().compilePropertyResultGraph([
      { id: 'F-1', name: 'Derived', expression: "p['A'] * 2", unit: '1' },
      { id: 'F-2', name: 'Next', expression: "p['Derived'] + 1", unit: '1' },
    ])({ A: 0, Derived: 9 });
    expect(result['F-1']).toMatchObject({ status: 'OK', value: 0 });
    expect(result['F-2']).toMatchObject({ status: 'OK', value: 1 });
  });

  it.each(['OK', 'UNKNOWN', 'INVALID'] as const)('isolates dependency metadata returned for %s', (status) => {
    const execute = new FormulaEngine().compilePropertyResultGraph([
      { id: 'F-1', name: 'Derived', expression: "1 / p['A']", unit: '1' },
    ]);
    const input: Record<string, number> = status === 'UNKNOWN' ? {} : { A: status === 'OK' ? 2 : 0 };
    const first = execute(input);
    expect(first['F-1'].status).toBe(status);
    first['F-1'].dependencies.length = 0;
    expect(execute({})['F-1']).toMatchObject({ status: 'UNKNOWN', dependencies: ['A'] });
    expect(execute({ A: 4 })['F-1']).toMatchObject({ status: 'OK', value: 0.25, dependencies: ['A'] });
  });
});
