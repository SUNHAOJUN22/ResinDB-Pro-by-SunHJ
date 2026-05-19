import { useState, useCallback, useRef, useEffect } from 'react';
import type { CopulaMessage, CopulaResponse } from '@/workers/copulaWorker';

export function useCopulaWorker() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [copulaResult, setCopulaResult] = useState<CopulaResponse['payload'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/copulaWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<CopulaResponse>) => {
      const res = e.data;
      if (res.type === 'COPULA_RESULT') {
        setCopulaResult(res.payload || null);
        setError(null);
        setIsCalculating(false);
      } else if (res.type === 'ERROR') {
        setError(res.error || 'Unknown error');
        setIsCalculating(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const calculateCopula = useCallback((data: { x: number; y: number }[]) => {
    if (!workerRef.current) return;
    setIsCalculating(true);
    setError(null);
    workerRef.current.postMessage({
      type: 'CALCULATE_COPULA',
      payload: { data }
    } as CopulaMessage);
  }, []);

  const getJointFailureProb = useCallback((thresholdX: number, thresholdY: number) => {
    if (!copulaResult) return null;
    const { sortedX, sortedY, grid } = copulaResult;
    
    // Find u and v for thresholds
    let uIdx = 0;
    while(uIdx < sortedX.length && sortedX[uIdx] <= thresholdX) uIdx++;
    const u = uIdx / sortedX.length;
    
    let vIdx = 0;
    while(vIdx < sortedY.length && sortedY[vIdx] <= thresholdY) vIdx++;
    const v = vIdx / sortedY.length;
    
    // Integrate copula PDF numerically from grid (Riemann sum approximation)
    // grid is 50x50, step is 1/50 = 0.02
    // We sum up C_uv * du * dv where u_grid <= u and v_grid <= v
    let sum = 0;
    const du = 1/50;
    const dv = 1/50;
    
    for (const point of grid) {
        if (point.u <= u && point.v <= v) {
            sum += point.z * du * dv;
        }
    }
    
    return sum; // Joint probability
  }, [copulaResult]);

  return { isCalculating, copulaResult, error, calculateCopula, getJointFailureProb };
}
