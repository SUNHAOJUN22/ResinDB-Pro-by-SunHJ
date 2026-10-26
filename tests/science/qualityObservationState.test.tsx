// @vitest-environment node
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataQualityMonitor } from '@/components/features/Analytics/DataQualityMonitor';
import type { Product } from '@/types/index';
import type { QualityWorkerResponse } from '@/workers/dataQualityWorker';

const state = vi.hoisted(() => ({ result: null as unknown }));
vi.mock('@/hooks/workers/useDataQualityWorker', () => ({
  useDataQualityWorker: () => ({ isAnomalizing: false, result: state.result, error: null, runQualityCheck: vi.fn() }),
}));
function output(products: Product[] = []) {
  return renderToStaticMarkup(<DataQualityMonitor products={products} />).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
}
afterEach(() => vi.unstubAllGlobals());

describe('quality state must describe the available observations', () => {
  it('does not claim great quality when no analysis result exists', () => {
    state.result = null;
    const text = output();
    expect(text).not.toContain('Great Quality');
    expect(text).toContain('not assessed');
    expect(text).not.toContain('100%');
  });
  it('reports every expected observation missing as 100 percent missing', async () => {
    const products: Product[] = [1, 2, 3].map(i => ({
      id: `empty-${i}`, gradeName: `Missing fixture ${i}`, manufacturer: 'fixture',
      manufacturerId: 'fixture', categoryIds: [], createdAt: '', updatedAt: '',
      properties: { Density: { value: 'UNKNOWN' }, 'Tensile Strength': { value: 'UNKNOWN' } },
    }));
    const replies: QualityWorkerResponse[] = [];
    const scope: { onmessage?: (event: MessageEvent) => void; postMessage: (message: QualityWorkerResponse) => void } = {
      postMessage: message => replies.push(message),
    };
    vi.resetModules();
    vi.stubGlobal('self', scope);
    await import('@/workers/dataQualityWorker');
    scope.onmessage!({ data: { type: 'RUN_MONITOR', payload: { allProducts: products } } } as MessageEvent);
    const response = replies.at(-1);
    expect(response?.type).toBe('QUALITY_MONITOR_RESULT');
    if (response?.type !== 'QUALITY_MONITOR_RESULT') throw new Error('Unexpected worker failure');
    expect(response.payload.totalValuesChecked).toBe(0);
    expect(response.payload.totalMissingCount).toBe(6);
    state.result = response.payload;
    const text = output(products);
    expect(text).toMatch(/Missing Values Rate\s*100(?:\.0)?%/);
  });
});
