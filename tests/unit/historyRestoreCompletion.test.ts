import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryWorkerMessage, HistoryWorkerResponse } from '@/workers/historyWorker';

const mocks = vi.hoisted(() => ({ restore: vi.fn(async () => undefined), toast: vi.fn() }));
vi.mock('@/lib/adapters', () => ({ default: { restoreSnapshot: mocks.restore } }));
vi.mock('@/contexts/ToastContext', () => ({ useToasts: () => ({ addToast: mocks.toast }) }));
import { useHistory } from '@/hooks/app/useHistory';

let messages: HistoryWorkerMessage[];
let worker: { onmessage: ((event: MessageEvent<HistoryWorkerResponse>) => void) | null; onerror: (() => void) | null; postMessage: (message: HistoryWorkerMessage) => void; terminate: () => void };
beforeEach(() => {
  vi.clearAllMocks(); messages = [];
  worker = { onmessage: null, onerror: null, terminate: vi.fn(), postMessage: message => {
    messages.push(message);
    if (message.type === 'PUSH_SNAPSHOT') queueMicrotask(() => worker.onmessage?.({ data: { type: 'HISTORY_UPDATED', requestId: (message as any).requestId, payload: { history: [] } } } as MessageEvent<HistoryWorkerResponse>));
  } };
  vi.stubGlobal('Worker', vi.fn(function () { return worker; }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('history restore request identity and persistence completion', () => {
  it('waits for the requested snapshot and real persistence before resolving', async () => {
    let finishWrite!: () => void;
    mocks.restore.mockImplementationOnce(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    const setProducts = vi.fn();
    const hook = renderHook(() => useHistory([], setProducts));
    let finished = false;
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.restoreSnapshot('saved').then(() => { finished = true; }); });
    await act(async () => { await Promise.resolve(); });
    const finishedBeforeSnapshot = finished;
    const request = messages.find(message => message.type === 'GET_SNAPSHOT')!;
    await act(async () => { worker.onmessage!({ data: { type: 'SNAPSHOT_DATA', requestId: (request as any).requestId, payload: { id: 'saved', snapshot: [] } } } as MessageEvent<HistoryWorkerResponse>); await Promise.resolve(); });
    const finishedBeforePersistence = finished;
    await act(async () => { finishWrite(); await pending; });
    expect(finishedBeforeSnapshot).toBe(false);
    expect(finishedBeforePersistence).toBe(false);
    expect(setProducts).toHaveBeenCalledOnce();
    expect(finished).toBe(true);
  });
  it('does not execute a restore for an unsolicited snapshot response', async () => {
    renderHook(() => useHistory([], vi.fn()));
    await act(async () => { worker.onmessage!({ data: { type: 'SNAPSHOT_DATA', payload: { id: 'not-requested', snapshot: [] } } } as MessageEvent<HistoryWorkerResponse>); });
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});
