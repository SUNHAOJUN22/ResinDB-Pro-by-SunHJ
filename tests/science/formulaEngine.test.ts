import { expect, test, describe } from 'vitest';
import { FormulaEngine } from '../../src/lib/formulaParser';
import { FormulaConfig, Product } from '../../src/types/index';

describe('🧪 FormulaEngine Scientific Calculations & Safety Sandbox Suite', () => {
  const engine = new FormulaEngine();

  describe('1. Dependency Extraction', () => {
    test('Should extract multiple nested bracket dependencies', () => {
      const expr = "Props['密度'] * 100 + props['MFR'] / Props['弯曲模量']";
      const deps = engine.extractDependencies(expr);
      expect(deps).toEqual(['密度', 'MFR', '弯曲模量']);
    });

    test('Should return empty array when no bracket properties exist', () => {
      const expr = "Math.sqrt(100) * 4.2";
      const deps = engine.extractDependencies(expr);
      expect(deps).toEqual([]);
    });
  });

  describe('2. Expression Sanitization', () => {
    test('Should convert Props brackets to internal dictionary accesses', () => {
      const expr = "Props['Density'] * props['MFR']";
      const sanitized = engine.sanitize(expr);
      expect(sanitized).toBe("(p['Density'] || 0) * (p['MFR'] || 0)");
    });

    test('Should append Math prefix to standard mathematical functions', () => {
      const expr = "sqrt(pow(Props['Density'], 2) + abs(-4))";
      const sanitized = engine.sanitize(expr);
      expect(sanitized).toBe("Math.sqrt(Math.pow((p['Density'] || 0), 2) + Math.abs(-4))");
    });
  });

  describe('3. Topological Sort & Cyclic Detection', () => {
    test('Should correctly sort formulas by dependency hierarchy', () => {
      const formulas: FormulaConfig[] = [
        { id: 'f1', name: 'VolumeScore', expression: "Props['Density'] * 10", unit: '' },
        { id: 'f2', name: 'CompositeScore', expression: "Props['VolumeScore'] + Props['Density']", unit: '' }
      ];

      const sorted = engine.buildTopologicalOrder(formulas);
      expect(sorted.map(s => s.id)).toEqual(['f1', 'f2']);
    });

    test('Should throw error when cyclical reference is detected', () => {
      const formulas: FormulaConfig[] = [
        { id: 'f1', name: 'A', expression: "Props['B'] * 2", unit: '' },
        { id: 'f2', name: 'B', expression: "Props['A'] + 1", unit: '' }
      ];

      expect(() => engine.buildTopologicalOrder(formulas)).toThrow('Cyclic dependency detected');
    });
  });

  describe('4. Sandbox Security & Script Injection Guard', () => {
    test('Should reject dangerous global objects (window, document, eval, fetch)', () => {
      const dangerous1 = "window.alert(1)";
      const dangerous2 = "eval('console.log(1)')";
      const dangerous3 = "fetch('http://attacker.com')";
      const dangerous4 = "Props['__proto__']";

      expect(engine.validate(dangerous1)).toContain('Security violation');
      expect(engine.validate(dangerous2)).toContain('Security violation');
      expect(engine.validate(dangerous3)).toContain('Security violation');
      expect(engine.validate(dangerous4)).toContain('Security violation');
    });

    test('Should accept valid mathematical equations', () => {
      const valid = "Props['密度'] * 1.5 + sqrt(10)";
      expect(engine.validate(valid)).toBeNull();
    });
  });

  describe('5. Execution & Compilation Plan', () => {
    test('Should compute multiple dependent formulas in sequence', () => {
      const formulas: FormulaConfig[] = [
        { id: 'f1', name: 'DoubleDensity', expression: "Props['密度'] * 2", unit: '' },
        { id: 'f2', name: 'TripleDensity', expression: "Props['DoubleDensity'] + Props['密度']", unit: '' }
      ];

      const product: Product = {
        id: 'p1',
        gradeName: 'TestPP',
        manufacturer: 'TestMaker',
        manufacturerId: 'm1',
        categoryIds: ['cat1'],
        createdAt: '2026-06-17',
        updatedAt: '2026-06-17',
        properties: {
          '密度': { value: 0.9, unit: 'g/cm³' }
        }
      };

      const executor = engine.compileGraph(formulas);
      const results = executor(product);

      expect(results['f1']).toBeCloseTo(1.8);
      expect(results['f2']).toBeCloseTo(2.7);
    });
  });
});
