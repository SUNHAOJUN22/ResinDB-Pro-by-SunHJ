import { logger } from '@/lib/logger';
import { verifyPropertyQuantities } from '@/lib/propertyAdmission';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Product } from '@/types/index';
import { HistoryRecord } from '@/lib/adapters/types';
import api from '@/lib/adapters';
import { useToasts } from '@/contexts/ToastContext';
import type { HistoryWorkerMessage, HistoryWorkerResponse } from '@/workers/historyWorker';

interface HistoryRequest {
  expected: HistoryWorkerResponse['type'];
  snapshotId?: string;
  resolve: (response: HistoryWorkerResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useHistory(
  allProducts: Product[],
  setAllProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  persistRestore?: (snapshot: Product[], saveUndo: (confirmed: Product[]) => Promise<void>) => Promise<void>,
  confirmedSnapshot?: () => Product[],
) {
  const [history, setHistory] = useState<Omit<HistoryRecord, 'snapshot'>[]>([]);
  const { addToast } = useToasts();
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<string, HistoryRequest>());
  const sequence = useRef(0);
  const allProductsRef = useRef(allProducts);
  useEffect(() => { allProductsRef.current = allProducts; }, [allProducts]);

  const request = useCallback((message: HistoryWorkerMessage, expected: HistoryWorkerResponse['type']): Promise<HistoryWorkerResponse> => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error('History worker is unavailable'));
    const requestId = `history-${++sequence.current}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.current.delete(requestId);
        reject(new Error('History request timed out'));
      }, 30_000);
      pending.current.set(requestId, {
        expected, snapshotId: message.type === 'GET_SNAPSHOT' ? message.payload.id : undefined,
        resolve, reject, timer,
      });
      try { worker.postMessage({ ...message, requestId }); }
      catch (error) {
        clearTimeout(timer);
        pending.current.delete(requestId);
        reject(error);
      }
    });
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/historyWorker.ts', import.meta.url), { type: 'module' });
    const requests = pending.current;
    const rejectPending = (message: string) => {
      for (const item of requests.values()) { clearTimeout(item.timer); item.reject(new Error(message)); }
      requests.clear();
    };
    worker.onmessage = (event: MessageEvent<HistoryWorkerResponse>) => {
      const response = event.data;
      if (response.type === 'HISTORY_UPDATED') setHistory(response.payload.history);
      const item = response.requestId ? requests.get(response.requestId) : undefined;
      // An unsolicited snapshot is data, never permission to overwrite storage.
      if (!item || !response.requestId) return;
      clearTimeout(item.timer);
      requests.delete(response.requestId);
      if (response.type === 'ERROR') item.reject(new Error(response.payload.message));
      else if (response.type !== item.expected
        || (response.type === 'SNAPSHOT_DATA' && response.payload.id !== item.snapshotId)) item.reject(new Error('History response identity mismatch'));
      else item.resolve(response);
    };
    worker.onerror = () => rejectPending('History worker failed');
    workerRef.current = worker;
    worker.postMessage({ type: 'GET_HISTORY' } satisfies HistoryWorkerMessage);
    return () => {
      workerRef.current = null;
      rejectPending('History worker closed');
      worker.terminate();
    };
  }, []);

  const pushToHistory = useCallback((description: string, snapshot: Product[]) => {
    void request({ type: 'PUSH_SNAPSHOT', payload: { description, snapshot } }, 'HISTORY_UPDATED').catch(error => {
      logger.error('History snapshot was not recorded', error);
      addToast('error', `History snapshot was not recorded: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [request, addToast]);

  const restoreSnapshot = useCallback(async (recordId: string): Promise<void> => {
    try {
      const response = await request({ type: 'GET_SNAPSHOT', payload: { id: recordId } }, 'SNAPSHOT_DATA');
      if (response.type !== 'SNAPSHOT_DATA') throw new Error('History response identity mismatch');
      const saveUndo = async (snapshot: Product[]) => {
        await request({ type: 'PUSH_SNAPSHOT', payload: { description: 'Undo to: previous state', snapshot } }, 'HISTORY_UPDATED');
      };
      const snapshot = response.payload.snapshot;
      if (persistRestore) await persistRestore(snapshot, saveUndo);
      else {
        await saveUndo(confirmedSnapshot?.() ?? allProductsRef.current);
        await api.restoreSnapshot(snapshot);
        setAllProducts(snapshot.map(product => ({ ...product, properties: verifyPropertyQuantities(product.properties) })));
      }
      addToast('success', 'Restored successfully');
    } catch (error) {
      logger.error(error);
      addToast('error', `Failed to restore: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [request, persistRestore, confirmedSnapshot, setAllProducts, addToast]);

  return { history, pushToHistory, restoreSnapshot };
}
