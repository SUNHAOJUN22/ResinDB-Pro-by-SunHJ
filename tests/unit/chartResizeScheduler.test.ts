import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createChartResizeScheduler } from '@/components/charts/chartResizeScheduler';
let pending: Map<number, FrameRequestCallback>;
let sequence: number;
beforeEach(() => {
  pending = new Map(); sequence = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++sequence, callback); return sequence; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
});
afterEach(() => vi.unstubAllGlobals());
function frame() { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(0)); }
function fixture() {
  const bounds = { width: 400, height: 300 };
  const container = { getBoundingClientRect: vi.fn(() => bounds as DOMRect) };
  const chart = { isDisposed: vi.fn(() => false), resize: vi.fn() };
  return { bounds, container, chart, scheduler: createChartResizeScheduler(container, chart) };
}
it('coalesces option, observer and initial resize into one frame and layout read', () => {
  const { scheduler, container, chart } = fixture();
  for (let i = 0; i < 100; i++) scheduler.schedule();
  expect(pending.size).toBe(1); frame();
  expect(container.getBoundingClientRect).toHaveBeenCalledTimes(1);
  expect(chart.resize).toHaveBeenCalledTimes(1);
  scheduler.schedule(); frame();
  expect(chart.resize).toHaveBeenCalledTimes(1);
});
it('relayouts on size changes and explicit font invalidation', () => {
  const { scheduler, bounds, chart } = fixture();
  scheduler.schedule(); frame();
  bounds.width = 600; scheduler.schedule(); frame();
  expect(chart.resize).toHaveBeenCalledTimes(2);
  scheduler.schedule(); scheduler.schedule(true); frame();
  expect(chart.resize).toHaveBeenCalledTimes(3);
});
it('waits for a visible container, then performs the pending forced relayout', () => {
  const { scheduler, bounds, chart } = fixture();
  bounds.width = 0; scheduler.schedule(true); frame();
  expect(chart.resize).not.toHaveBeenCalled();
  bounds.width = 400; scheduler.schedule(); frame();
  expect(chart.resize).toHaveBeenCalledTimes(1);
});
it('cancels an owned frame and ignores later font promises after unmount', () => {
  const { scheduler, container, chart } = fixture();
  scheduler.schedule(); scheduler.dispose(); scheduler.schedule(true); frame();
  expect(pending.size).toBe(0);
  expect(container.getBoundingClientRect).not.toHaveBeenCalled();
  expect(chart.resize).not.toHaveBeenCalled();
});
it('never accesses a disposed chart', () => {
  const { scheduler, chart } = fixture();
  scheduler.schedule(); chart.isDisposed.mockReturnValue(true); frame();
  expect(chart.resize).not.toHaveBeenCalled();
});
