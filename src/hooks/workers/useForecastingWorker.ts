import { useState, useCallback, useRef, useEffect } from 'react';
import { Product } from '@/types/index';
import { ForecastingWorkerMessage, ForecastingWorkerResponse } from '@/workers/forecastingWorker';

export function useForecastingWorker() {
  const [isProjecting, setIsProjecting] = useState(false);
  const [forecastResult, setForecastResult] = useState<Required<ForecastingWorkerResponse>['payload'] | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../workers/forecastingWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<ForecastingWorkerResponse>) => {
      setIsProjecting(false);
      const data = e.data;
      if (data.type === 'ERROR' || data.error) {
        setForecastError(data.error || 'Error running materials forecasting process.');
      } else if (data.type === 'FORECAST_RESULT' && data.payload) {
        setForecastResult(data.payload);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runCalculatedForecast = useCallback((
    products: Product[],
    propertyKey: string,
    algorithm: ForecastingWorkerMessage['payload']['algorithm'],
    condition: ForecastingWorkerMessage['payload']['condition'],
    stressFactor: number,
    alpha?: number,
    beta?: number
  ) => {
    if (!workerRef.current) return;
    setIsProjecting(true);
    setForecastError(null);

    const msg: ForecastingWorkerMessage = {
      type: 'RUN_FORECAST',
      payload: {
        products,
        propertyKey,
        algorithm,
        condition,
        stressFactor,
        alpha,
        beta
      }
    };
    workerRef.current.postMessage(msg);
  }, []);

  return {
    isProjecting,
    forecastResult,
    forecastError,
    runCalculatedForecast
  };
}
