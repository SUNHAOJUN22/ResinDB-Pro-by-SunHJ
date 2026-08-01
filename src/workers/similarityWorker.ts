import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import type { Product } from '@/types/index';

const SIMILARITY_MODEL_VERSION = 'zscore-cosine-flat-f64-2.1.0';

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
      edgeObjectsAllocated: number;
      maxEdges: number | null;
      truncated: boolean;
      missingValuesImputed: number;
      matrixStorage: 'flat-float64-unit-vectors';
      matrixAllocationPolicy: 'single-in-place-float64';
      matrixBufferCount: 1;
      matrixValuesAllocated: number;
      boundedEdgeAllocationPolicy: 'retained-only-after-heap-threshold';
      cosineRangePolicy: 'clamped-minus-one-to-one';
    };
  };
  error?: string;
}

interface IndexedEdge extends SimilarityEdge {
  leftIndex: number;
  rightIndex: number;
}

function validateMaxEdges(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) throw new RangeError('maxEdges must be a positive integer');
  return value;
}

function swap(heap: IndexedEdge[], left: number, right: number): void {
  const temporary = heap[left];
  heap[left] = heap[right];
  heap[right] = temporary;
}

function retainStrongest(heap: IndexedEdge[], edge: IndexedEdge, limit: number): void {
  if (heap.length < limit) {
    heap.push(edge);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].value <= heap[index].value) break;
      swap(heap, parent, index);
      index = parent;
    }
    return;
  }
  heap[0] = edge;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && heap[left].value < heap[smallest].value) smallest = left;
    if (right < heap.length && heap[right].value < heap[smallest].value) smallest = right;
    if (smallest === index) break;
    swap(heap, index, smallest);
    index = smallest;
  }
}

function emptyResponse(
  products: Product[],
  features: string[],
  maxEdges: number | undefined,
): SimilarityResponse {
  return {
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
        edgeObjectsAllocated: 0,
        maxEdges: maxEdges ?? null,
        truncated: false,
        missingValuesImputed: 0,
        matrixStorage: 'flat-float64-unit-vectors',
        matrixAllocationPolicy: 'single-in-place-float64',
        matrixBufferCount: 1,
        matrixValuesAllocated: 0,
        boundedEdgeAllocationPolicy: 'retained-only-after-heap-threshold',
        cosineRangePolicy: 'clamped-minus-one-to-one',
      },
    },
  };
}

self.onmessage = (event: MessageEvent<SimilarityMessage>) => {
  try {
    const { products, features, threshold, maxEdges: requestedMaxEdges } = event.data.payload;
    if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
      throw new RangeError('Similarity threshold must be between -1 and 1');
    }
    if (new Set(features).size !== features.length) throw new Error('Similarity feature names must be unique.');
    const maxEdges = validateMaxEdges(requestedMaxEdges);
    if (!products.length || features.length < 2) {
      self.postMessage(emptyResponse(products, features, maxEdges));
      return;
    }

    const productCount = products.length;
    const featureCount = features.length;
    const normalized = new Float64Array(productCount * featureCount);
    const means = new Float64Array(featureCount);
    const finiteCounts = new Uint32Array(featureCount);
    for (let product = 0; product < productCount; product++) {
      const offset = product * featureCount;
      for (let feature = 0; feature < featureCount; feature++) {
        const value = Number(products[product].properties?.[features[feature]]?.value);
        normalized[offset + feature] = value;
        if (Number.isFinite(value)) {
          means[feature] += value;
          finiteCounts[feature] += 1;
        }
      }
    }
    for (let feature = 0; feature < featureCount; feature++) {
      means[feature] = finiteCounts[feature] > 0 ? means[feature] / finiteCounts[feature] : 0;
    }

    let missingValuesImputed = 0;
    const standardDeviations = new Float64Array(featureCount);
    for (let product = 0; product < productCount; product++) {
      const offset = product * featureCount;
      for (let feature = 0; feature < featureCount; feature++) {
        let value = normalized[offset + feature];
        if (!Number.isFinite(value)) {
          value = means[feature];
          normalized[offset + feature] = value;
          missingValuesImputed += 1;
        }
        standardDeviations[feature] += (value - means[feature]) ** 2;
      }
    }
    const varianceDenominator = productCount > 1 ? productCount - 1 : 1;
    for (let feature = 0; feature < featureCount; feature++) {
      standardDeviations[feature] = Math.sqrt(
        standardDeviations[feature] / varianceDenominator,
      ) || 1;
    }

    const validRows = new Uint8Array(productCount);
    for (let product = 0; product < productCount; product++) {
      const offset = product * featureCount;
      let normSquared = 0;
      for (let feature = 0; feature < featureCount; feature++) {
        const value = (normalized[offset + feature] - means[feature]) / standardDeviations[feature];
        normalized[offset + feature] = value;
        normSquared += value * value;
      }
      const norm = Math.sqrt(normSquared);
      if (norm > 0) {
        validRows[product] = 1;
        const inverseNorm = 1 / norm;
        for (let feature = 0; feature < featureCount; feature++) {
          normalized[offset + feature] *= inverseNorm;
        }
      }
    }

    const nodes: SimilarityNode[] = products.map((product) => ({
      id: product.id,
      name: product.gradeName,
      category: product.categoryIds?.at(-1) ?? 'Unknown',
      value: 1,
    }));
    const retainedEdges: IndexedEdge[] = [];
    let pairsEvaluated = 0;
    let edgesAboveThreshold = 0;
    let edgeObjectsAllocated = 0;
    const progressInterval = Math.max(1, Math.floor(productCount / 20));
    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'pairwise-similarity' }));

    for (let left = 0; left < productCount; left++) {
      if (validRows[left] === 0) continue;
      const leftOffset = left * featureCount;
      for (let right = left + 1; right < productCount; right++) {
        if (validRows[right] === 0) continue;
        pairsEvaluated += 1;
        const rightOffset = right * featureCount;
        let rawSimilarity = 0;
        for (let feature = 0; feature < featureCount; feature++) {
          rawSimilarity += normalized[leftOffset + feature] * normalized[rightOffset + feature];
        }
        const similarity = Math.max(-1, Math.min(1, rawSimilarity));
        if (similarity < threshold) continue;
        edgesAboveThreshold += 1;
        if (
          maxEdges !== undefined
          && retainedEdges.length >= maxEdges
          && similarity <= retainedEdges[0].value
        ) {
          continue;
        }
        const edge: IndexedEdge = {
          source: products[left].id,
          target: products[right].id,
          value: similarity,
          leftIndex: left,
          rightIndex: right,
        };
        edgeObjectsAllocated += 1;
        if (maxEdges === undefined) retainedEdges.push(edge);
        else retainStrongest(retainedEdges, edge, maxEdges);
      }
      const completed = left + 1;
      if (completed % progressInterval === 0 || completed === productCount) {
        self.postMessage(createWorkerProgressMessage({
          ratio: completed / productCount,
          completed,
          total: productCount,
          phase: 'pairwise-similarity',
        }));
      }
    }

    if (maxEdges !== undefined) retainedEdges.sort((left, right) => right.value - left.value);
    for (const edge of retainedEdges) {
      nodes[edge.leftIndex].value += 1;
      nodes[edge.rightIndex].value += 1;
    }
    const edges = retainedEdges.map(({ source, target, value }) => ({ source, target, value }));
    self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));
    self.postMessage({
      type: 'SIMILARITY_CALCULATED',
      payload: {
        nodes,
        edges,
        modelVersion: SIMILARITY_MODEL_VERSION,
        diagnostics: {
          products: productCount,
          features: featureCount,
          pairsEvaluated,
          edgesAboveThreshold,
          edgesReturned: edges.length,
          edgeObjectsAllocated,
          maxEdges: maxEdges ?? null,
          truncated: maxEdges !== undefined && edgesAboveThreshold > maxEdges,
          missingValuesImputed,
          matrixStorage: 'flat-float64-unit-vectors',
          matrixAllocationPolicy: 'single-in-place-float64',
          matrixBufferCount: 1,
          matrixValuesAllocated: normalized.length,
          boundedEdgeAllocationPolicy: 'retained-only-after-heap-threshold',
          cosineRangePolicy: 'clamped-minus-one-to-one',
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
