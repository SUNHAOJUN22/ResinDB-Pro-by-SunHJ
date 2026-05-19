import { useState, useCallback, useRef, useEffect } from 'react';
import { KineticsMessage, KineticsResponse } from '@/workers/kineticsWorker';

export function useKineticsWorker() {
    const [isCalculating, setIsCalculating] = useState(false);
    const [result, setResult] = useState<KineticsResponse['payload'] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/kineticsWorker.ts', import.meta.url), {
            type: 'module'
        });

        workerRef.current.onmessage = (e: MessageEvent<KineticsResponse>) => {
            setIsCalculating(false);
            if (e.data.type === 'ERROR') {
                setError(e.data.error || 'Unknown error in Kinetics worker');
            } else if (e.data.type === 'KINETICS_RESULT') {
                setResult(e.data.payload || null);
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const runAnalysis = useCallback((data: { beta: number; tp: number }[], isoTemp: number) => {
        if (!workerRef.current) return;
        setIsCalculating(true);
        setError(null);
        setResult(null);

        const msg: KineticsMessage = {
            type: 'RUN_KINETICS',
            payload: { data, isoTemp }
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
