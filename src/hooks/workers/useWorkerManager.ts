import { useState, useCallback, useRef, useEffect } from 'react';

export interface WorkerHookOptions<TResponsePayload> {
  onSuccess?: (payload: TResponsePayload) => void;
  onError?: (error: string) => void;
}

export function useWorkerManager<TMessage, TResponsePayload>(
  workerFactory: () => Worker,
  successType: string,
  options?: WorkerHookOptions<TResponsePayload>
) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<TResponsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const worker = workerFactory();
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<{ type: string; payload?: TResponsePayload & { message?: string }; error?: string }>) => {
      const res = e.data;
      if (res.type === successType) {
        setResult(res.payload || null);
        setError(null);
        setIsCalculating(false);
        optionsRef.current?.onSuccess?.(res.payload as TResponsePayload);
      } else if (res.type === 'ERROR') {
        const errMsg = res.payload?.message || res.error || 'Unknown error';
        setError(errMsg);
        setIsCalculating(false);
        optionsRef.current?.onError?.(errMsg);
      }
    };

    return () => {
      worker.terminate();
    };
  }, [workerFactory, successType]);

  const postMessage = useCallback((msg: TMessage) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    workerRef.current.postMessage(msg);
  }, []);

  return {
    isCalculating,
    result,
    setResult,
    error,
    setError,
    postMessage,
    workerRef
  };
}

// v3.1.0-sync

// v3.1.0-sync-fixed
