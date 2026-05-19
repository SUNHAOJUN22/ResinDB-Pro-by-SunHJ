import { Product } from '@/types/index';

export interface SimilarityMessage {
  type: 'CALCULATE_SIMILARITY';
  payload: {
    products: Product[];
    features: string[];
    threshold: number;
  };
}

export interface SimilarityNode {
  id: string;
  name: string;
  category: string;
  value: number; // to size the node roughly
}

export interface SimilarityEdge {
  source: string;
  target: string;
  value: number; // the similarity score
}

export interface SimilarityResponse {
  type: 'SIMILARITY_CALCULATED' | 'ERROR';
  payload?: {
    nodes: SimilarityNode[];
    edges: SimilarityEdge[];
  };
  error?: string;
}

self.onmessage = (e: MessageEvent<SimilarityMessage>) => {
  try {
    const { products, features, threshold } = e.data.payload;

    if (!products.length || features.length < 2) {
      self.postMessage({ type: 'SIMILARITY_CALCULATED', payload: { nodes: [], edges: [] } });
      return;
    }

    const N = products.length;
    const D = features.length;

    // 1. Extract Matrix X
    const X: number[][] = [];
    for (let i = 0; i < N; i++) {
        const row = [];
        for (let j = 0; j < D; j++) {
            const val = parseFloat(String(products[i].properties?.[features[j]]?.value));
            row.push(isNaN(val) ? 0 : val);
        }
        X.push(row);
    }

    // 2. Z-Score Normalization
    const means = new Array(D).fill(0);
    const stds = new Array(D).fill(0);
    
    for (let j = 0; j < D; j++) {
        for (let i = 0; i < N; i++) means[j] += X[i][j];
        means[j] /= N;
        
        for (let i = 0; i < N; i++) stds[j] += Math.pow(X[i][j] - means[j], 2);
        stds[j] = Math.sqrt(stds[j] / (N > 1 ? N - 1 : 1));
        if (stds[j] === 0) stds[j] = 1; // avoid divide by zero
    }
    
    const Z = X.map(row => row.map((val, j) => (val - means[j]) / stds[j]));

    // 3. Calculate Norms for Cosine Similarity
    const norms = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
        let sumSq = 0;
        for (let j = 0; j < D; j++) {
            sumSq += Z[i][j] * Z[i][j];
        }
        norms[i] = Math.sqrt(sumSq);
    }

    // 4. Compute Cosine Similarity Matrix and build edges
    const edges: SimilarityEdge[] = [];
    const nodes: SimilarityNode[] = products.map(p => ({
        id: p.id,
        name: p.gradeName,
        category: p.categoryIds[p.categoryIds.length - 1] || 'Unknown',
        value: 1
    }));

    for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
            if (norms[i] === 0 || norms[j] === 0) continue;
            
            let dotProduct = 0;
            for (let k = 0; k < D; k++) {
                dotProduct += Z[i][k] * Z[j][k];
            }
            
            const sim = dotProduct / (norms[i] * norms[j]);
            if (sim >= threshold) {
                edges.push({
                    source: products[i].id,
                    target: products[j].id,
                    value: sim
                });
                
                // Increase node value (size) based on degrees
                nodes[i].value += 1;
                nodes[j].value += 1;
            }
        }
    }

    self.postMessage({
      type: 'SIMILARITY_CALCULATED',
      payload: { nodes, edges }
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
