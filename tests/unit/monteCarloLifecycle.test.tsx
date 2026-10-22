import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormulaEditorModal } from '@/components/modals/FormulaEditorModalLegacy';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useMonteCarlo } from '@/hooks/math/useMonteCarlo';
import { sharedWorkerPool } from '@/compute/workerPool';
import { FormulaEngine } from '@/lib/formulaParser';
import type { FormulaConfig, Product } from '@/types/index';

// The worker pool and hooks are real. Only the asynchronous browser transport
// and chart drawing are replaced, so delayed responses exercise cancellation.
const chart = vi.hoisted(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }));
vi.mock('@/lib/echarts', () => ({
  init: () => chart,
  getInstanceByDom: () => undefined,
  graphic: { LinearGradient: class {} },
}));

class DelayedWorker {
  static instances: DelayedWorker[] = [];
  terminated = false;
  readonly posts: unknown[] = [];
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  constructor() { DelayedWorker.instances.push(this); }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (!listener) return;
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (listener) this.listeners.get(type)?.delete(listener);
  }
  postMessage(message: unknown) { this.posts.push(message); }
  terminate() { this.terminated = true; }
  finish(mean = 777) {
    const event = new MessageEvent('message', { data: {
      type: 'SIMULATION_COMPLETE', payload: {
        stats: { mean, stdDev: 1, p5: mean - 1, p95: mean + 1, kde: [{ x: mean, y: 1 }] },
        reproducibility: { seed: 'old-seed' },
      },
    } });
    for (const listener of [...(this.listeners.get('message') ?? [])]) {
      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    }
  }
}
const product = (): Product => ({
  id: 'sample-a', gradeName: 'A', manufacturer: 'Lab', manufacturerId: 'lab',
  categoryIds: [], createdAt: '2026-10-21', updatedAt: '2026-10-21',
  properties: { density: { value: 1000, unit: 'kg/m³' } },
});
const definitions = (): FormulaConfig[] => [{ id: 'base', name: 'Base density', expression: "props['density']", unit: 'kg/m³' }];

beforeEach(() => {
  DelayedWorker.instances = [];
  vi.stubGlobal('Worker', DelayedWorker);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  localStorage.clear(); localStorage.setItem('resindb-language', 'en');
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  sharedWorkerPool.disposeKey('SIMULATION_COMPLETE');
  vi.unstubAllGlobals();
});

describe('Monte Carlo result ownership', () => {
  it('reset invalidates an already resolved task before its queued callback can publish', async () => {
    const { result } = renderHook(useMonteCarlo);
    act(() => result.current.runSimulation('base', definitions(), product(), { density: 5 }));
    await act(async () => {
      DelayedWorker.instances[0].finish();
      result.current.resetSimulation();
      await Promise.resolve();
    });
    expect(result.current.simulationStats).toBeNull();
    expect(result.current.reproducibility).toBeNull();
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('clears completed statistics immediately when a new simulation starts', async () => {
    const { result } = renderHook(useMonteCarlo);
    act(() => result.current.runSimulation('base', definitions(), product(), { density: 5 }));
    await act(async () => { DelayedWorker.instances[0].finish(1000); await Promise.resolve(); });
    expect(result.current.simulationStats?.mean).toBe(1000);
    act(() => result.current.runSimulation('base', definitions(), product(), { density: 10 }));
    expect(result.current.simulationStats).toBeNull();
    expect(result.current.reproducibility).toBeNull();
    expect(result.current.isSimulating).toBe(true);
  });

  it.each(['expression', 'unit', 'dependency', 'sample identity', 'sample content', 'variance', 'close'] as const)(
    'does not accept a delayed result after the editor changes %s', async (change) => {
      let sample = product(); let formulas = definitions(); let isOpen = true;
      const view = () => <LanguageProvider><FormulaEditorModal isOpen={isOpen} onClose={vi.fn()} formulas={formulas}
        onAdd={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} allProducts={[sample]} /></LanguageProvider>;
      const mounted = render(view());
      const expressionInput = screen.getByPlaceholderText("props['Density'] * 0.1");
      const unitInput = screen.getByPlaceholderText('e.g. MPa, g/cm³');
      fireEvent.change(expressionInput, { target: { value: "p[\"Base density\"]" } });
      fireEvent.change(unitInput, { target: { value: 'kg/m³' } });
      fireEvent.click(screen.getByRole('button', { name: /^test$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Monte Carlo Uncertainty Simulator/i }));
      fireEvent.click(screen.getByRole('button', { name: /Run 5000 random samples/i }));
      const oldWorker = DelayedWorker.instances.at(-1)!;
      expect(oldWorker.posts).toHaveLength(1);
      const request = oldWorker.posts[0] as { payload: { targetFormulaId: string; formulas: FormulaConfig[]; product: Product } };
      const exact = new FormulaEngine().compileResultGraph(request.payload.formulas)(request.payload.product)[request.payload.targetFormulaId];
      expect(exact).toMatchObject({ status: 'OK', value: 1000, unit: 'kg/m³' });
      expect(screen.getByRole('button', { name: /Simulating/ })).toBeDisabled();

      if (change === 'expression') fireEvent.change(expressionInput, { target: { value: '2 * p["Base density"]' } });
      else if (change === 'unit') fireEvent.change(unitInput, { target: { value: 'g/cm³' } });
      else if (change === 'variance') fireEvent.change(screen.getByRole('slider'), { target: { value: '9' } });
      else {
        if (change === 'dependency') formulas = [{ ...formulas[0], expression: "2 * props['density']" }];
        if (change === 'sample identity') sample = { ...sample, id: 'sample-b' };
        if (change === 'sample content') sample.properties.density.value = 2000;
        if (change === 'close') isOpen = false;
        mounted.rerender(view());
      }
      expect(oldWorker.terminated).toBe(true);
      await act(async () => { oldWorker.finish(); await Promise.resolve(); });
      if (change === 'close') { isOpen = true; mounted.rerender(view()); }
      fireEvent.click(screen.getByRole('button', { name: /^test$/i }));
      expect(screen.queryByText(/μ = 777\.00/)).toBeNull();
      expect(screen.getByRole('button', { name: /Run 5000 random samples/i })).not.toBeDisabled();
    },
  );
});
