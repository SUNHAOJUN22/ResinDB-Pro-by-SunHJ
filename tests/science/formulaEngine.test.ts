import { describe, expect, test } from 'vitest';
import { FormulaEngine } from '../../src/lib/formulaParser';
import { FormulaConfig, Product } from '../../src/types/index';

function createProduct(properties: Product['properties']): Product {
  return {
    id: 'p1',
    gradeName: 'TestPP',
    manufacturer: 'TestMaker',
    manufacturerId: 'm1',
    categoryIds: ['cat1'],
    createdAt: '2026-06-17',
    updatedAt: '2026-06-17',
    properties,
  };
}

describe('FormulaEngine scientific calculations and parser safety', () => {
  const engine = new FormulaEngine();

  describe('dependency extraction', () => {
    test('extracts multiple bracket dependencies', () => {
      const dependencies = engine.extractDependencies(
        "Props['密度'] * 100 + props['MFR'] / Props['弯曲模量']",
      );
      expect(dependencies).toEqual(['密度', 'MFR', '弯曲模量']);
    });

    test('returns an empty list when no property references exist', () => {
      expect(engine.extractDependencies('Math.sqrt(100) * 4.2')).toEqual([]);
    });
  });

  describe('formula-editor preview normalization', () => {
    test('converts property brackets to internal dictionary accesses', () => {
      expect(engine.sanitize("Props['Density'] * props['MFR']")).toBe(
        "(p['Density'] || 0) * (p['MFR'] || 0)",
      );
    });

    test('adds Math prefixes to supported bare functions', () => {
      expect(engine.sanitize("sqrt(pow(Props['Density'], 2) + abs(-4))")).toBe(
        "Math.sqrt(Math.pow((p['Density'] || 0), 2) + Math.abs(-4))",
      );
    });
  });

  describe('topological ordering', () => {
    test('sorts formulas by dependency hierarchy', () => {
      const formulas: FormulaConfig[] = [
        { id: 'f1', name: 'VolumeScore', expression: "Props['Density'] * 10", unit: '' },
        { id: 'f2', name: 'CompositeScore', expression: "Props['VolumeScore'] + Props['Density']", unit: '' },
      ];

      expect(engine.buildTopologicalOrder(formulas).map((formula) => formula.id)).toEqual(['f1', 'f2']);
    });

    test('rejects cyclical references', () => {
      const formulas: FormulaConfig[] = [
        { id: 'f1', name: 'A', expression: "Props['B'] * 2", unit: '' },
        { id: 'f2', name: 'B', expression: "Props['A'] + 1", unit: '' },
      ];
      expect(() => engine.buildTopologicalOrder(formulas)).toThrow('Cyclic dependency detected');
    });
  });

  describe('parser security boundary', () => {
    test.each([
      'window.alert(1)',
      "eval('console.log(1)')",
      "fetch('http://attacker.example')",
      "Props['__proto__']",
      'globalThis.constructor',
    ])('rejects dangerous expression: %s', (expression) => {
      expect(engine.validate(expression)).toContain('Security violation');
    });

    test.each([
      '{}',
      'Math.random()',
      "Props['Density'].constructor('return 1')()",
      "Props['Density'] ? 1 : 0",
    ])('rejects syntax outside the numeric grammar: %s', (expression) => {
      expect(engine.validate(expression)).not.toBeNull();
    });

    test('accepts supported arithmetic and white-listed functions', () => {
      expect(engine.validate("Props['密度'] * 1.5 + sqrt(10)")).toBeNull();
      expect(engine.validate('max(1, 2, 3) + 2^3 + Math.PI')).toBeNull();
    });
  });

  describe('compiled execution plan', () => {
    test('computes dependent formulas in sequence', () => {
      const formulas: FormulaConfig[] = [
        { id: 'f1', name: 'DoubleDensity', expression: "Props['密度'] * 2", unit: '' },
        { id: 'f2', name: 'TripleDensity', expression: "Props['DoubleDensity'] + Props['密度']", unit: '' },
      ];

      const results = engine.compileGraph(formulas)(
        createProduct({ 密度: { value: 0.9, unit: 'g/cm³' } }),
      );
      expect(results.f1).toBeCloseTo(1.8);
      expect(results.f2).toBeCloseTo(2.7);
    });

    test('normalizes non-finite results to zero', () => {
      const formulas: FormulaConfig[] = [
        { id: 'division', name: 'Division', expression: '1 / 0', unit: '' },
        { id: 'sqrt', name: 'Sqrt', expression: 'sqrt(-1)', unit: '' },
      ];
      expect(engine.compileGraph(formulas)(createProduct({}))).toEqual({ division: 0, sqrt: 0 });
    });
  });
});

describe('logical fallback operators and isolated formula failures', () => {
  const logicalEngine = new FormulaEngine();

  test('supports || and && with numeric short-circuit semantics', () => {
    const executor = logicalEngine.compileGraph([
      { id: 'or', name: 'Fallback', expression: "(props['A'] || props['B'] || 0) / 2", unit: '' },
      { id: 'and', name: 'Guarded', expression: "props['A'] && props['B']", unit: '' },
    ]);

    const result = executor({
      id: 'logical',
      gradeName: 'Logical',
      manufacturer: 'Test',
      categoryIds: [],
      properties: { A: { value: 0, unit: '' }, B: { value: 10, unit: '' } },
      createdAt: '',
      updatedAt: '',
    });

    expect(result.or).toBe(5);
    expect(result.and).toBe(0);
  });

  test('isolates a malformed formula without blocking valid formulas', () => {
    const executor = logicalEngine.compileGraph([
      { id: 'bad', name: 'Malformed', expression: "props['A'] + )", unit: '' },
      { id: 'good', name: 'Valid', expression: "props['A'] * 2", unit: '' },
    ]);

    const result = executor({
      id: 'fault-tolerance',
      gradeName: 'Fault tolerance',
      manufacturer: 'Test',
      categoryIds: [],
      properties: { A: { value: 4, unit: '' } },
      createdAt: '',
      updatedAt: '',
    });

    expect(result.bad).toBe(0);
    expect(result.good).toBe(8);
  });
});
