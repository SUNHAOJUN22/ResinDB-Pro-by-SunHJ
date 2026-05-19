import { expect, test, describe } from 'vitest';
import { materialEngine } from '../../src/lib/materialScience';

describe('Material Engine - Units & Conversions', () => {
    test('calculatePearson works correctly', () => {
        const points: [number, number][] = [
            [1, 2], [2, 4], [3, 6], [4, 8]
        ];
        const pearson = materialEngine.calculatePearson(points);
        expect(pearson).toBeCloseTo(1, 4);
    });

    test('parseRheologyData handles valid inputs', () => {
        const dataStr = '1.0,100;10.0,50';
        const parsed = materialEngine.parseRheologyData(dataStr);
        expect(parsed).toEqual([
            { rate: 1.0, visc: 100 },
            { rate: 10.0, visc: 50 },
        ]);
    });
});
