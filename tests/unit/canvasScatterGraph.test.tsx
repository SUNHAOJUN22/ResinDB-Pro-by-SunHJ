import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types/index';
import { CanvasScatterGraph } from '@/components/charts/CanvasScatterGraph';

vi.mock('@/components/charts/KMeansBackendCalibrationPanel', () => ({ KMeansBackendCalibrationPanel: () => null }));

let width = 800;
let height = 600;
let resized: (() => void) | undefined;
const context = {
  scale: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
  stroke: vi.fn(), fillText: vi.fn(), save: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
  restore: vi.fn(), arc: vi.fn(), fill: vi.fn(), closePath: vi.fn(), setLineDash: vi.fn(),
  strokeStyle: '', lineWidth: 1, fillStyle: '', font: '', textAlign: '',
};
const product = (id: string): Product => ({
  id, gradeName: id, manufacturer: '__proto__',
  properties: { x: { value: 0 }, y: { value: 0 } },
}) as unknown as Product;

beforeEach(() => {
  width = 800;
  height = 600;
  resized = undefined;
  vi.clearAllMocks();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, width, height,
    toJSON: () => ({}),
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback; }
    observe() { /* The test explicitly advances layout below. */ }
    disconnect() { /* No external resource is retained. */ }
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('scientific scatter display boundaries', () => {
  it('filters x/y as pairs and shows zero-valued tooltips rather than missing data', () => {
    render(<CanvasScatterGraph data={[product('zero'), product('invalid-x'), product('invalid-y')]}
      xKey="x" yKey="y" xLabel="横轴" yLabel="纵轴" xValues={[0, NaN, 1000]} yValues={[0, 1, NaN]} />);
    const canvas = screen.getByRole('img', { name: '横轴 / 纵轴 (1)' });
    expect(context.arc).toHaveBeenCalledTimes(1);
    expect(context.arc).toHaveBeenLastCalledWith(400, 300, 3, 0, Math.PI * 2);
    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 300 });
    expect(screen.getByText('横轴: 0')).toBeTruthy();
    expect(screen.getByText('纵轴: 0')).toBeTruthy();
    expect(context.font).toContain('Noto Sans CJK SC');
  });

  it('redraws constant-valued data after a container resize', () => {
    render(<CanvasScatterGraph data={[product('constant')]} xKey="x" yKey="y" xValues={[7]} yValues={[7]} />);
    width = 500;
    height = 300;
    act(() => { resized?.(); });
    expect(context.arc).toHaveBeenLastCalledWith(250, 150, 3, 0, Math.PI * 2);
  });

  it('draws extreme finite values with prototype-like manufacturer names without non-finite geometry', () => {
    render(<CanvasScatterGraph data={[product('a'), product('b'), product('c')]}
      xKey="x" yKey="y" xValues={[-1e308, 0, 1e308]} yValues={[1e308, 0, -1e308]}
      clusters={{ a: -1, b: 0.5, c: Infinity }} enableConvexHull />);
    expect(context.arc).toHaveBeenCalledTimes(3);
    for (const [x, y] of context.arc.mock.calls) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });
});
