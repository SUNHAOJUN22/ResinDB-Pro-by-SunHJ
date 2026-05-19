import { useState, useCallback, useRef, useEffect } from 'react';
import { MahalanobisMessage, MahalanobisResponse } from '@/workers/mahalanobisWorker';

export function useMahalanobisWorker() {
    const [isCalculating, setIsCalculating] = useState(false);
    const [result, setResult] = useState<MahalanobisResponse['payload'] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../../workers/mahalanobisWorker.ts', import.meta.url), {
            type: 'module'
        });

        workerRef.current.onmessage = (e: MessageEvent<MahalanobisResponse>) => {
            setIsCalculating(false);
            if (e.data.type === 'ERROR') {
                setError(e.data.error || 'Unknown error in Mahalanobis worker');
            } else if (e.data.type === 'MAHALANOBIS_RESULT') {
                setResult(e.data.payload!);
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const runAnalysis = useCallback((data: (Record<string, number> & { _id: string, name: string })[], features: string[], alpha: number = 0.05) => {
        if (!workerRef.current) return;
        setIsCalculating(true);
        setError(null);
        setResult(null);

        const msg: MahalanobisMessage = {
            type: 'CALCULATE_MAHALANOBIS',
            payload: { data, features, alpha }
        };
        workerRef.current.postMessage(msg);
    }, []);

    return {
        isCalculating,
        result,
        error,
        runAnalysis
    };
}
