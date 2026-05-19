import { useState, useCallback, useRef, useEffect } from 'react';
import { PronyMessage, PronyResponse } from '@/workers/pronyWorker';

export function usePronyWorker() {
    const [isCalculating, setIsCalculating] = useState(false);
    const [result, setResult] = useState<PronyResponse['payload'] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../../workers/pronyWorker.ts', import.meta.url), {
            type: 'module'
        });

        workerRef.current.onmessage = (e: MessageEvent<PronyResponse>) => {
            setIsCalculating(false);
            if (e.data.type === 'ERROR') {
                setError(e.data.error || 'Unknown error');
            } else if (e.data.type === 'PRONY_RESULT') {
                setResult(e.data.payload || null);
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const runProny = useCallback((data: { omega: number; storage: number; loss: number }[], numTerms: number) => {
        if (!workerRef.current) return;
        setIsCalculating(true);
        setError(null);
        setResult(null);

        const msg: PronyMessage = {
            type: 'RUN_PRONY',
            payload: { data, numTerms }
        };
        workerRef.current.postMessage(msg);
    }, []);

    return {
        isCalculating,
        result,
        error,
        runProny
    };
}
