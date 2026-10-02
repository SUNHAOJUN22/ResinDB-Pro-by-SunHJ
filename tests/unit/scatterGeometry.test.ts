import { describe, expect, it } from 'vitest';
import { QuadTree, scatterFraction } from '@/lib/math/scatterGeometry';

describe('bounded finite scatter geometry', () => {
  it('inserts and queries 120000 coincident points without recursive stack exhaustion', () => {
    const tree = new QuadTree<number>({ x: 0, y: 0, w: 800, h: 600 });
    for (let i = 0; i < 120000; i++) expect(tree.insert({ x: 400, y: 300, data: i })).toBe(true);
    const found = tree.query({ x: 399, y: 299, w: 2, h: 2 });
    expect(found).toHaveLength(120000);
    expect(new Set(found.map((p) => p.data)).size).toBe(120000);
  });

  it('matches brute-force inclusive rectangle queries including split boundaries', () => {
    const tree = new QuadTree<number>({ x: 0, y: 0, w: 10, h: 10 }, 2);
    const points = Array.from({ length: 121 }, (_, i) => ({ x: i % 11, y: Math.floor(i / 11), data: i }));
    for (const p of points) tree.insert(p);
    for (let x = 0; x <= 10; x++) {
      const expected = points.filter((p) => p.x >= x && p.x <= x + 2 && p.y >= 3 && p.y <= 5);
      const actual = tree.query({ x, y: 3, w: 2, h: 2 });
      expect(actual.map((p) => p.data).sort((a, b) => a - b))
        .toEqual(expected.map((p) => p.data).sort((a, b) => a - b));
    }
  });

  it('terminates when subdivision cannot progress and supports degenerate rectangles', () => {
    const tree = new QuadTree<number>({ x: 1e16, y: 1e16, w: 0, h: 0 }, 1);
    for (let i = 0; i < 100; i++) tree.insert({ x: 1e16, y: 1e16, data: i });
    expect(tree.query({ x: 1e16, y: 1e16, w: 0, h: 0 })).toHaveLength(100);
    expect(tree.insert({ x: 0, y: 0, data: 101 })).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite coordinates (%s)', (bad) => {
    const tree = new QuadTree<number>({ x: 0, y: 0, w: 1, h: 1 });
    expect(tree.insert({ x: bad, y: 0, data: 0 })).toBe(false);
    expect(tree.insert({ x: 0, y: bad, data: 0 })).toBe(false);
    expect(tree.query({ x: bad, y: 0, w: 1, h: 1 })).toEqual([]);
    expect(() => scatterFraction(bad, 0, 1)).toThrow(RangeError);
  });

  it('validates rectangles and capacity rather than accepting an invalid index', () => {
    for (const capacity of [0, -1, 1.5, Infinity]) {
      expect(() => new QuadTree({ x: 0, y: 0, w: 1, h: 1 }, capacity)).toThrow(RangeError);
    }
    expect(() => new QuadTree({ x: 0, y: 0, w: -1, h: 1 })).toThrow(RangeError);
    expect(() => new QuadTree({ x: 1e308, y: 0, w: 1e308, h: 1 })).toThrow(RangeError);
    const tree = new QuadTree({ x: 0, y: 0, w: 1, h: 1 });
    expect(tree.query({ x: 0, y: 0, w: -1, h: 1 })).toEqual([]);
  });

  it('projects finite extremes without overflowing and centers constant columns', () => {
    expect(scatterFraction(-1e308, -1e308, 1e308)).toBe(0);
    expect(scatterFraction(0, -1e308, 1e308)).toBe(0.5);
    expect(scatterFraction(1e308, -1e308, 1e308)).toBe(1);
    expect(scatterFraction(5, 5, 5)).toBe(0.5);
    expect(scatterFraction(5, 0, 10)).toBe(0.5);
    expect(scatterFraction(20, 0, 10)).toBe(1);
    expect(() => scatterFraction(0, 1, -1)).toThrow(RangeError);
  });
});
