import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import type { Product } from '@/types/index';

const SIMILARITY_MODEL_VERSION = 'zscore-cosine-flat-f64-2.0.0';

export interface SimilarityMessage {
  type: 'CALCULATE_SIMILARITY';
  payload: {
    products: Product[];
    features: string[];
    threshold: number;
    maxEdges?: number;
  };
}

export interface SimilarityNode {
  id: string;
  name: string;
  category: string;
  value: number;
}

export interface SimilarityEdge {
  source: string;
  target: string;
  value: number;
}

export interface SimilarityResponse {
  type: 'SIMILARITY_CALCULATED' | 'ERROR';
  payload?: {
    nodes: SimilarityNode[];
    edges: SimilarityEdge[];
    modelVersion: typeof SIMILARITY_MODEL_VERSION;
    diagnostics: {
      products: number;
      features: number;
      pairsEvaluated: number;
      edgesAboveThreshold: number;
      edgesReturned: number;
      maxEdges: number | null;
      truncated: boolean;
      missingValuesImputed: number;
      matrixStorage: 'flat-float64-unit-vectors';
    };
  };
  error?: string;
}

interface IndexedEdge extends SimilarityEdge {
  leftIndex: number;
  rightIndex: number;
}

function validateMaxEdges(maxEdges: number | undefined): number | undefined {
  if (maxEdges === undefined) return undefined;
  if (!Number.isInteger(maxEdges) || maxEdges < 1) {
    throw new RangeError('maxEdges must be a positive integer');
  }
  return maxEdges;
}

function heapSwap(heap: IndexedEdge[], left: number, right: number): void {
  const temporary = heap[left];
  heap[left] = heap[right];
  heap[right] = temporary;
}

function heapPushBounded(heap: IndexedEdge[], edge: IndexedEdge, limit: number): void {
  if (heap.length < limit) {
    heap.push(edge);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].value <= heap[index].value) break;
      heapSwap(heap, parent, index);
      index = parent;
    }
    return;
  }
  if (edge.value <= heap[0].value) return;
  heap[0] = edge;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && heap[left].value < heap[smallest].value) smallest = left;
    if (right < heap.length && heap[right].value < heap[smallest].value) smallest = right;
    if (smallest === index) break;
    heapSwap(heap, index, smallest);
    index = smallest;
  }
}

self.onmessage = (event: MessageEvent<SimilarityMessage>) => {
  try {
    const { products, features, threshold, maxEdges: requestedMaxEdges } = event.data.payload;
    if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
      throw new RangeError('Similarity threshold must be between -1 and 1');
    }
    const maxEdges = validateMaxEdges(requestedMaxEdges);
    if (!products.length || features.length < 2) {
      self.postMessage({
        type: 'SIMILARITY_CALCULATED',
        payload: {
          nodes: [],
          edges: [],
          modelVersion: SIMILARITY_MODEL_VERSION,
          diagnostics: {
            products: products.length,
            features: features.length,
            pairsEvaluated: 0,
            edgesAboveThreshold: 0,
            edgesReturned: 0,
            maxEdges: maxEdges ?? null,
            truncated: false,
            missingValuesImputed: 0,
            matrixStorage: 'flat-float64-unit-vectors',
          },
        },
      } satisfies SimilarityResponse);
      return;
    }

    const productCount = products.length;
    const featureCount = features.length;
    const raw = new Float64Array(productCount * featureCount);
    const means = new Float64Array(featureCount);
    const finiteCounts = new Uint32Array(featureCount);
    for (let productIndex = 0; productIndex < productCount; productIndex++) {
      const offset = productIndex * featureCount;
      for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
        const value = Number(products[productIndex].properties?.[features[featureIndex]]?.value);
        raw[offset + featureIndex] = value;
        if (Number.isFinite(value)) {
          means[featureIndex] += value;
          finiteCounts[featureIndex] += 1;
        }
      }
    }
    for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
      means[featureIndex] = finiteCounts[featureIndex] > 0
        ? means[featureIndex] / finiteCounts[featureIndex]
        : 0;
    }

    let missingValuesImputed = 0;
    const standardDeviations = new Float64Array(featureCount);
    for (let productIndex = 0; productIndex < productCount; productIndex++) {
      const offset = productIndex * featureCount;
      for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
        let value = raw[offset + featureIndex];
        if (!Number.isFinite(value)) {
          value = means[featureIndex];
          raw[offset + featureIndex] = value;
          missingValuesImputed += 1;
        }
        standardDeviations[featureIndex] += (value - means[featureIndex]) ** 2;
      }
    }
    const denominator = productCount > 1 ? productCount - 1 : 1;
    for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
      standardDeviations[featureIndex] = Math.sqrt(standardDeviations[featureIndex] / denominator) || 1;
    }

    const normalized = new Float64Array(productCount * featureCount);
    const validUnitRows = new Uint8Array(productCount);
    for (let productIndex = 0; productIndex < productCount; productIndex++) {
      const offset = productIndex * featureCount;
      let normSquared = 0;
      for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
        const value = (raw[offset + featureIndex] - means[featureIndex]) / standardDeviations[featureIndex];
        normalized[offset + featureIndex] = value;
        normSquared += value * value;
      }
      const norm = Math.sqrt(normSquared);
      if (norm > 0) {
        validUnitRows[productIndex] = 1;
        for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
          normalized[offset + featureIndex] /= norm;
        }
      }
    }

    const nodes: SimilarityNode[] = products.map((product) => ({
      id: product.id,
      name: product.gradeName,
      category: product.categoryIds?.at(-1) ?? 'Unknown',
      value: 1,
    }));
    const edges: IndexedEdge[] = [];
    let pairsEvaluated = 0;
    let edgesAboveThreshold = 0;
    const rowProgressInterval = Math.max(1, Math.floor(productCount / 20));
    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'pairwise-similarity' }));

    for (let left = 0; left < productCount; left++) {
      if (validUnitRows[left] === 0) continue;
      const leftOffset = left * featureCount;
      for (let right = left + 1; right < productCount; right++) {
        if (validUnitRows[right] === 0) continue;
        pairsEvaluated += 1;
        const rightOffset = right * featureCount;
        let similarity = 0;
        for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
          similarity += normalized[leftOffset + featureIndex] * normalized[rightOffset + featureIndex];
        }
        if (similarity >= threshold) {
          edgesAboveThreshold += 1;
          const edge: IndexedEdge = {
            source: products[left].id,
            target: products[right].id,
            value: similarity,
            leftIndex: left,
            rightIndex: right,
          };
          if (maxEdges === undefined) edges.push(edge);
          else heapPushBounded(edges, edge, maxEdges);
        }
      }
      const completed = left + 1;
      if (completed % rowProgressInterval === 0 || completed === productCount) {
        self.postMessage(createWorkerProgressMessage({
          ratio: completed / productCount,
          completed,
          total: productCount,
          phase: 'pairwise-similarity',
        }));
      }
    }

    if (maxEdges !== undefined) edges.sort((left, right) => right.value - left.value);
    for (const edge of edges) {
      nodes[edge.leftIndex].value += 1;
      nodes[edge.rightIndex].value += 1;
    }
    const publicEdges = edges.map(({ source, target, value }) => ({ source, target, value }));
    self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));
    self.postMessage({
      type: 'SIMILARITY_CALCULATED',
      payload: {
        nodes,
        edges: publicEdges,
        modelVersion: SIMILARITY_MODEL_VERSION,
        diagnostics: {
          products: productCount,
          features: featureCount,
          pairsEvaluated,
          edgesAboveThreshold,
          edgesReturned: publicEdges.length,
          maxEdges: maxEdges ?? null,
          truncated: maxEdges !== undefined && edgesAboveThreshold > maxEdges,
          missingValuesImputed,
          matrixStorage: 'flat-float64-unit-vectors',
        },
      },
    } satisfies SimilarityResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    } satisfies SimilarityResponse);
  }
};
