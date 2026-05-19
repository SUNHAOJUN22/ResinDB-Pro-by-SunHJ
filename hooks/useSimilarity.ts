import { useState, useCallback, useEffect, useRef } from 'react';
import { Product } from '../types';
import type { SimilarityMessage, SimilarityResponse, SimilarityNode, SimilarityEdge } from '../lib/similarityWorker';

export function useSimilarityWorker() {
  const [nodes, setNodes] = useState<SimilarityNode[]>([]);
  const [edges, setEdges] = useState<SimilarityEdge[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../lib/similarityWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e: MessageEvent<SimilarityResponse>) => {
      const res = e.data;
      if (res.type === 'SIMILARITY_CALCULATED' && res.payload) {
        setNodes(res.payload.nodes);
        setEdges(res.payload.edges);
        setIsCalculating(false);
      } else if (res.type === 'ERROR') {
        setIsCalculating(false);
        console.error("SimilarityWorker Error:", res.error);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const calculateSimilarity = useCallback((products: Product[], features: string[], threshold: number) => {
    if (workerRef.current && products.length > 0 && features.length >= 2) {
      setIsCalculating(true);
      workerRef.current.postMessage({
        type: 'CALCULATE_SIMILARITY',
        payload: { products, features, threshold }
      } as SimilarityMessage);
    } else {
        setNodes([]);
        setEdges([]);
    }
  }, []);

  return {
    nodes,
    edges,
    isCalculating,
    calculateSimilarity
  };
}
