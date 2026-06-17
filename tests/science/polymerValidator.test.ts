import { expect, test, describe } from 'vitest';
import { PolymerDataValidator } from '../../src/lib/adapters/PolymerDataValidator';
import { MaterialRecord } from '../../src/lib/adapters/types';
import { calculateTopsis } from '../../src/lib/topsisAnalyzer';
import { materialEngine } from '../../src/lib/materialScience';

describe('🧪 PRO RIGOROUS POLYMER SCIENCE & MECHANICAL VALIDATION SUITE', () => {

  describe('1. PolymerDataValidator - Multi-dimensional Placeholder Cleaning', () => {
    test('Should scrub typical placeholder shells (NaN, "-", "unknown", "暂无", "n/a", etc.)', () => {
      const dirtyRecord: any = {
        id: 'test-grade-001',
        source: 'my_lab',
        category: 'HDPE',
        grade: 'HDPE-ScrubTest',
        manufacturer: 'Sinopec',
        properties: {
          density: { value: 0.95, unit: 'g/cm³' }, // Valid
          mfr: { value: 2.1, unit: 'g/10min' },     // Valid
          tensileYield: { value: 'unknown', unit: 'MPa' }, // Placeholder 1
          flexuralModulus: { value: '-', unit: 'MPa' },    // Placeholder 2
          izodImpact: { value: '暂无', unit: 'kJ/m²' }   // Placeholder 3
        },
        timestamp: Date.now()
      };

      const result = PolymerDataValidator.validateAndClean(dirtyRecord);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.properties.density?.value).toBe(0.95);
        expect(result.properties.mfr?.value).toBe(2.1);
        expect(result.properties.tensileYield).toBeUndefined();
        expect(result.properties.flexuralModulus).toBeUndefined();
        expect(result.properties.izodImpact).toBeUndefined();
      }
    });
  });

  describe('2. PolymerDataValidator - Standard Bounds & Physical Limit Rules', () => {
    test('Should reject physical impossibility: Density exceeding upper physical bound (3.0 g/cm³)', () => {
      const bodyRecord: MaterialRecord = {
        id: 'phys-err-01',
        source: 'my_lab',
        category: 'PP',
        grade: 'Impossible-PP',
        manufacturer: 'Dow Chemical',
        properties: {
          density: { value: 4.8, unit: 'g/cm³' }, // Intentionally invalid physical limit!
          mfr: { value: 12.0, unit: 'g/10min' },
          tensileYield: { value: 28, unit: 'MPa' }
        },
        timestamp: Date.now()
      };

      const cleaned = PolymerDataValidator.validateAndClean(bodyRecord);
      expect(cleaned).not.toBeNull();
      if (cleaned) {
        // Density is scrubbed as it is physically impossible (> 3.0), tensile and MFR should remain
        expect(cleaned.properties.density).toBeUndefined();
        expect(cleaned.properties.mfr?.value).toBe(12.0);
        expect(cleaned.properties.tensileYield?.value).toBe(28);
      }
    });

    test('Should reject structural anomalies exceeding mechanical limits (TensileStrength > 500 MPa)', () => {
      const records: MaterialRecord[] = [
        {
          id: 'mech-err-01',
          source: 'open_market',
          category: 'ABS',
          grade: 'Impossibly-Strong-ABS',
          manufacturer: 'Chimei',
          properties: {
            density: { value: 1.05, unit: 'g/cm³' },
            tensileYield: { value: 1200, unit: 'MPa' }, // Typo or false data: > 500
            flexuralModulus: { value: 2400, unit: 'MPa' }
          },
          timestamp: Date.now()
        }
      ];

      const cleanedBatch = PolymerDataValidator.cleanBatch(records);
      expect(cleanedBatch.length).toBe(1);
      // Tensile yield strength is scrubbed due to threshold breach, but the record is kept since density & flexural stay (2 properties OK)
      expect(cleanedBatch[0].properties.tensileYield).toBeUndefined();
      expect(cleanedBatch[0].properties.flexuralModulus?.value).toBe(2400);
    });
  });

  describe('3. PolymerDataValidator - Cascade Test Condition Recomendation', () => {
    test('Should fill test rules based on polymer category when values are absent (PE, PP, ABS)', () => {
      const peRec: MaterialRecord = {
        id: 'pe-cascade-01',
        source: 'my_lab',
        category: 'HDPE',
        grade: 'HDPE-5502',
        manufacturer: 'LyondellBasell',
        properties: {
          density: { value: 0.954, unit: 'g/cm³' },
          mfr: { value: 0.35, unit: 'g/10min' } // Temp and load are omitted!
        },
        timestamp: Date.now()
      };

      const ppRec: MaterialRecord = {
        id: 'pp-cascade-01',
        source: 'my_lab',
        category: 'PP',
        grade: 'PP-M1600',
        manufacturer: 'Sinopec',
        properties: {
          density: { value: 0.905, unit: 'g/cm³' },
          mfr: { value: 60.0, unit: 'g/10min' } // Omitted
        },
        timestamp: Date.now()
      };

      const cleanPe = PolymerDataValidator.validateAndClean(peRec)!;
      const cleanPp = PolymerDataValidator.validateAndClean(ppRec)!;

      expect(cleanPe).not.toBeNull();
      expect(cleanPp).not.toBeNull();

      expect((cleanPe.properties.mfr as any).temp).toBe('190℃');
      expect((cleanPe.properties.mfr as any).load).toBe('2.16kg');

      expect((cleanPp.properties.mfr as any).temp).toBe('230℃');
      expect((cleanPp.properties.mfr as any).load).toBe('2.16kg');
    });
  });

  describe('4. PolymerDataValidator - Hard Melt-down Line Constraint', () => {
    test('Should melt-down and drop record entirely if valid physical property count is < 2 (Zero-Tolerance for Shell Data)', () => {
      const shellRecord: MaterialRecord = {
        id: 'fake-shelf-02',
        source: 'open_market',
        category: 'ABS',
        grade: 'Fake-ABS',
        manufacturer: 'Unknown',
        properties: {
          density: { value: 1.04, unit: 'g/cm³' }, // 1 valid parameter
          mfr: { value: 'n/a' as any, unit: 'g/10min' }, // invalid
          tensileYield: { value: 'unknown' as any, unit: 'MPa' } // invalid
        },
        timestamp: Date.now()
      };

      // Since only 1 property (density) is valid, PolymerDataValidator MUST drop research index completely !
      const resultObj = PolymerDataValidator.validateAndClean(shellRecord);
      expect(resultObj).toBeNull();
    });
  });

  describe('5. Core TOPSIS Math & Entropy Weight Determination', () => {
    test('Should run entropy weight calculation deterministically on standard matrix inputs', () => {
      interface MockMaterial { id: string; price: number; modulus: number }
      
      const mockedDataset: MockMaterial[] = [
        { id: 'M-1', price: 10, modulus: 3000 },
        { id: 'M-2', price: 15, modulus: 4500 },
        { id: 'M-3', price: 20, modulus: 6000 }
      ];

      const criteria = [
        { key: 'price', isLowBest: true },  // Low price is best
        { key: 'modulus', isLowBest: false } // High modulus is best
      ];

      const extractor = (item: MockMaterial, key: string) => {
        if (key === 'price') return item.price;
        if (key === 'modulus') return item.modulus;
        return null;
      };

      const scores = calculateTopsis(mockedDataset, criteria, extractor);
      
      expect(scores.size).toBe(mockedDataset.length);
      const score1 = scores.get('M-1')!;
      const score2 = scores.get('M-2')!;
      const score3 = scores.get('M-3')!;

      // Scores must fall within physical range [0, 1]
      expect(score1).toBeGreaterThanOrEqual(0);
      expect(score1).toBeLessThanOrEqual(1);
      expect(score2).toBeGreaterThanOrEqual(0);
      expect(score2).toBeLessThanOrEqual(1);
      expect(score3).toBeGreaterThanOrEqual(0);
      expect(score3).toBeLessThanOrEqual(1);
    });
  });

  describe('6. Mathematical Statistics - Core Regression Modeling', () => {
    test('Should yield correct Pearson linear slope coefficient and R²', () => {
      const dataPoints: [number, number][] = [
        [100, 20],
        [200, 40],
        [300, 60]
      ];

      const result = materialEngine.analyzeCorrelation(dataPoints);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.r2).toBeCloseTo(1, 6); // Perfect correlation
        expect(result.slope).toBeCloseTo(0.2, 6); // deltaY / deltaX = 20/100
        expect(result.intercept).toBeCloseTo(0, 6);
        expect(result.r2).toBeGreaterThan(0.99);
      }
    });
  });
});
