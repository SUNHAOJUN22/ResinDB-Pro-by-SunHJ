import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Product, ProductUpdates } from '@/types/index';
import type { HistoryWorkerMessage, HistoryWorkerResponse } from '@/workers/historyWorker';

const mocks = vi.hoisted(() => ({ search: vi.fn(), batchUpdate: vi.fn(), restoreSnapshot: vi.fn(), toast: vi.fn(), translate: (key: string, fallback?: string) => fallback ?? key }));
vi.mock('@/lib/adapters', () => ({ default: mocks }));
vi.mock('@/hooks/datagrid/useColumns', () => ({ useColumns: () => ({ columns: [] }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: mocks.translate, tProp: mocks.translate, language: 'en' }) }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: mocks.toast }) }));
vi.mock('@/contexts/UIContext', () => ({ useUI: () => ({ setShowSidebar: vi.fn() }) }));
import { DataProvider, useData } from '@/contexts/DataContext';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('backs up the confirmed catalog at the restore barrier after earlier writes settle', async () => {
  let stored: Product[] = [{ id: 'a', gradeName: 'A', manufacturer: 'Initial', manufacturerId: 'lab', categoryIds: [], properties: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' }];
  let finish!: () => void;
  const pendingWrite = new Promise<void>(resolve => { finish = resolve; });
  const messages: HistoryWorkerMessage[] = [];
  vi.stubGlobal('Worker', class {
    onmessage: ((event: MessageEvent<HistoryWorkerResponse>) => void) | null = null;
    postMessage(message: HistoryWorkerMessage) {
      messages.push(structuredClone(message));
      queueMicrotask(() => this.onmessage?.({ data: message.type === 'GET_SNAPSHOT'
        ? { type: 'SNAPSHOT_DATA', requestId: message.requestId, payload: { id: message.payload.id, snapshot: [] } }
        : { type: 'HISTORY_UPDATED', requestId: message.requestId, payload: { history: [] } },
      } as MessageEvent<HistoryWorkerResponse>));
    }
    terminate() {}
  });
  mocks.search.mockImplementation(async () => structuredClone(stored));
  mocks.batchUpdate.mockImplementation(async (_ids: string[], updates: ProductUpdates) => { await pendingWrite; stored = stored.map(row => ({ ...row, ...updates })); });
  mocks.restoreSnapshot.mockImplementation(async (snapshot: Product[]) => { stored = structuredClone(snapshot); });
  const wrapper = ({ children }: { children: React.ReactNode }) => <DataProvider>{children}</DataProvider>;
  const hook = renderHook(() => useData(), { wrapper });
  await waitFor(() => expect(hook.result.current.allProducts).toHaveLength(1));
  let writing!: Promise<void>; let restoring!: Promise<void>;
  act(() => { writing = hook.result.current.handleBatchUpdate(['a'], { manufacturer: 'Confirmed before restore' }); });
  await waitFor(() => expect(mocks.batchUpdate).toHaveBeenCalledOnce());
  act(() => { restoring = hook.result.current.restoreSnapshot('saved'); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const restoresBeforeWrite = mocks.restoreSnapshot.mock.calls.length;
  await act(async () => { finish(); await Promise.all([writing, restoring]); });
  expect(restoresBeforeWrite).toBe(0);
  const undo = messages.find(message => message.type === 'PUSH_SNAPSHOT' && message.payload.description === 'Undo to: previous state');
  expect(undo?.type === 'PUSH_SNAPSHOT' ? undo.payload.snapshot[0].manufacturer : null).toBe('Confirmed before restore');
  expect(hook.result.current.allProducts).toEqual([]);
});
