import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CorrelationMatrix } from '@/components/charts/CorrelationMatrix';
import type { Product } from '@/types/index';

type WorkerFixture = { onmessage: ((event: MessageEvent) => void) | null; onerror: (() => void) | null; postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> };
let workers: WorkerFixture[];
const data = (id: string): Product[] => [{ id, properties: { a: { value: 1 }, b: { value: 2 } } } as Product];
const result = (value: number) => ({ data: { type: 'SPEARMAN_RESULT', payload: { keys: ['a', 'b'], matrix: [[1, value], [value, 1]], diagnostics: { constantKeys: [] } } } } as MessageEvent);
beforeEach(() => {
  workers = [];
  vi.stubGlobal('Worker', vi.fn(function () {
    const worker = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() };
    workers.push(worker); return worker;
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('correlation display is bound to the current request', () => {
  it('clears old results when a new computation fails', () => {
    const view = render(<CorrelationMatrix data={data('first')} keys={['a', 'b']} />);
    act(() => workers[0].onmessage!(result(0.75)));
    expect(view.container.textContent).toContain('0.75');
    view.rerender(<CorrelationMatrix data={data('second')} keys={['a', 'b']} />);
    act(() => workers.at(-1)!.onmessage!({ data: { type: 'ERROR', payload: { message: 'Insufficient observations' } } } as MessageEvent));
    expect(view.container.textContent).not.toContain('0.75');
  });
  it('discards late responses from an older data generation', () => {
    const view = render(<CorrelationMatrix data={data('first')} keys={['a', 'b']} />);
    const older = workers[0].onmessage!;
    view.rerender(<CorrelationMatrix data={data('second')} keys={['a', 'b']} />);
    act(() => workers.at(-1)!.onmessage!(result(0.25)));
    act(() => older(result(0.75)));
    expect(view.container.textContent).toContain('0.25');
    expect(view.container.textContent).not.toContain('0.75');
  });
  it('clears an old matrix when the new dataset cannot be submitted', () => {
    const view = render(<CorrelationMatrix data={data('first')} keys={['a', 'b']} />);
    act(() => workers[0].onmessage!(result(0.75)));
    view.rerender(<CorrelationMatrix data={[]} keys={['a', 'b']} />);
    expect(view.container.textContent).not.toContain('0.75');
  });
});
