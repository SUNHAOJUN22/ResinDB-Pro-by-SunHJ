import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Product } from '@/types/index';
import type { HistoryWorkerResponse } from '@/workers/historyWorker';

const mocks = vi.hoisted(() => ({ restoreSnapshot: vi.fn(async () => undefined), addToast: vi.fn() }));
vi.mock('@/lib/adapters', () => ({ default: { restoreSnapshot: mocks.restoreSnapshot } }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: mocks.addToast }) }));
import { useHistory } from '@/hooks/app/useHistory';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('quarantines historical quantities before restoring the live UI, preserving snapshot provenance', async () => {
  const worker = { onmessage: null as ((event: MessageEvent<HistoryWorkerResponse>) => Promise<void>) | null, postMessage: vi.fn(), terminate: vi.fn() };
  vi.stubGlobal('Worker', vi.fn(function () { return worker; }));
  const snapshot: Product[] = [{
    id: 'history-density', gradeName: 'Saved synthetic example', manufacturerId: 'lab', manufacturer: 'Lab',
    categoryIds: [], createdAt: '2026-10-24', updatedAt: '2026-10-24',
    properties: { density: { value: 900, unit: 'kg/m³', quantity: {
      raw: { value: 900, unit: 'kg/m³' }, canonical: { value: 900, unit: 'g/cm³', dimension: 'mass_density' },
      status: 'VALID', reasonCodes: [], provenanceRefs: ['synthetic-example'],
    } } },
    governance: { sourceType: 'SYNTHETIC', recordStatus: 'NOT_FOR_RELEASE', confidentiality: 'INTERNAL', license: 'test', provenanceRefs: [] },
  }];
  const original = structuredClone(snapshot);
  const setProducts = vi.fn();
  const hook = renderHook(() => useHistory([], setProducts));
  await act(async () => {
    await worker.onmessage!({ data: { type: 'SNAPSHOT_DATA', payload: { id: 'saved', snapshot } } } as MessageEvent<HistoryWorkerResponse>);
  });
  expect(mocks.restoreSnapshot).toHaveBeenCalledWith(snapshot);
  expect(setProducts).toHaveBeenCalledOnce();
  const restored = setProducts.mock.calls[0][0] as Product[];
  expect(restored[0].properties.density.quantity?.status).toBe('INVALID');
  expect(restored[0].properties.density.quantity?.canonical).toBeUndefined();
  expect(restored[0].governance).toEqual(original[0].governance);
  expect(snapshot).toEqual(original);
  hook.unmount();
});
