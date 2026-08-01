import { describe, expect, it } from 'vitest';
import { isOutsideViewport } from '@/components/charts/ScientificEChart';

function rectangle(top: number, right: number, bottom: number, left: number) {
  return { top, right, bottom, left };
}

describe('scientific chart viewport guard', () => {
  it('detects charts that are fully outside each viewport edge', () => {
    expect(isOutsideViewport(rectangle(-300, 800, 0, 100), 1_600, 1_000)).toBe(true);
    expect(isOutsideViewport(rectangle(1_000, 800, 1_300, 100), 1_600, 1_000)).toBe(true);
    expect(isOutsideViewport(rectangle(100, 0, 500, -400), 1_600, 1_000)).toBe(true);
    expect(isOutsideViewport(rectangle(100, 1_900, 500, 1_600), 1_600, 1_000)).toBe(true);
  });

  it('does not scroll a chart that is visible or partially visible', () => {
    expect(isOutsideViewport(rectangle(100, 900, 700, 100), 1_600, 1_000)).toBe(false);
    expect(isOutsideViewport(rectangle(-200, 900, 100, 100), 1_600, 1_000)).toBe(false);
    expect(isOutsideViewport(rectangle(900, 900, 1_200, 100), 1_600, 1_000)).toBe(false);
  });
});
