import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types/index';
import type { KMeansResponse } from '@/workers/kmeansWorker';
import type { SimilarityResponse } from '@/workers/similarityWorker';

async function runWorker(loader: () => Promise<unknown>, message: unknown) {
  vi.resetModules();
  const replies: unknown[] = [];
  const scope: { onmessage?: (event: MessageEvent) => void; postMessage: (value: unknown) => void } = {
    postMessage: (value) => replies.push(value),
  };
  vi.stubGlobal('self', scope);
  await loader();
  scope.onmessage!({ data: message } as MessageEvent);
  return replies.at(-1);
}

async function kmeans(values: number[], maxK = 2) {
  const result = await runWorker(() => import('@/workers/kmeansWorker'), {
    type: 'COMPUTE_KMEANS',
    payload: {
      data: values.map((value, index) => ({ id: String(index), values: { x: value } })),
      keys: ['x'], maxK, seed: 'scientific-reasonableness', selectionMode: 'full', backend: 'typescript',
    },
  }) as KMeansResponse;
  expect(result.type).toBe('KMEANS_RESULT');
  if (result.type !== 'KMEANS_RESULT') throw new Error(result.payload.message);
  return result.payload;
}

// Independent pairwise definition on the original one-dimensional observations.
// Their common standardization factor cancels in the silhouette ratio.
function referenceSilhouette(values: number[], clusters: Record<string, number>): number {
  const labels = [...new Set(Object.values(clusters))];
  return values.reduce((total, value, index) => {
    const own = clusters[String(index)];
    const peers = values.filter((_, other) => other !== index && clusters[String(other)] === own);
    if (peers.length === 0) return total;
    const within = peers.reduce((sum, peer) => sum + Math.abs(value - peer), 0) / peers.length;
    const between = Math.min(...labels.filter((label) => label !== own).map((label) => {
      const members = values.filter((_, other) => clusters[String(other)] === label);
      return members.reduce((sum, member) => sum + Math.abs(value - member), 0) / members.length;
    }));
    return total + (between - within) / Math.max(within, between);
  }, 0) / values.length;
}

async function similarity(scale: number) {
  const products: Product[] = [[1, 4], [2, 3], [3, 2], [4, 1]].map(([a, b], index) => ({
    id: String(index), gradeName: String(index), manufacturerId: 'm', manufacturer: 'Fixture',
    categoryIds: [], createdAt: '2026-11-16', updatedAt: '2026-11-16',
    properties: { A: { value: a * scale }, B: { value: b * scale } },
  }));
  const result = await runWorker(() => import('@/workers/similarityWorker'), {
    type: 'CALCULATE_SIMILARITY', payload: { products, features: ['A', 'B'], threshold: -1 },
  }) as SimilarityResponse;
  expect(result.type).toBe('SIMILARITY_CALCULATED');
  expect(result.payload).toBeDefined();
  return result.payload!;
}

afterEach(() => vi.unstubAllGlobals());

describe('clustering numerical reasonableness', () => {
  it.each([5, 0.1, 1e300, 1e-300])('reports one cluster and no silhouette for a constant cohort of %s', async (value) => {
    const result = await kmeans(Array<number>(6).fill(value));
    expect(result.k).toBe(1);
    expect(new Set(Object.values(result.clusters)).size).toBe(1);
    expect(result.centroids).toEqual([[0]]);
    expect(result.silhouetteScore).toBeNull();
    expect(result.modelSelection.candidateCount).toBe(0);
  });

  it('assigns zero silhouette to a singleton, rather than rewarding it as perfect separation', async () => {
    const values = [0, 0.1, 0.2, 10];
    const result = await kmeans(values);
    expect(Object.values(result.clusters).filter((label) => label === result.clusters['3'])).toHaveLength(1);
    expect(result.silhouetteScore).toBeCloseTo(referenceSilhouette(values, result.clusters), 14);
  });

  it('retains the silhouette definition for clusters without singletons', async () => {
    const values = [0, 0.1, 10, 10.1];
    const result = await kmeans(values);
    expect(result.silhouetteScore).toBeCloseTo(referenceSilhouette(values, result.clusters), 14);
  });

  it.each([1e-200, 1e200])('preserves K-Means after a finite global scale change of %s', async (scale) => {
    const values = [1, 1.1, 1.2, 10, 10.1, 10.2];
    const expected = await kmeans(values);
    const actual = await kmeans(values.map((value) => value * scale));
    expect(actual.clusters).toEqual(expected.clusters);
    expect(actual.k).toBe(expected.k);
    expect(actual.silhouetteScore).toBeCloseTo(expected.silhouetteScore!, 12);
    actual.centroids.forEach((row, index) => row.forEach((value, column) => {
      expect(value).toBeCloseTo(expected.centroids[index][column], 12);
    }));
  });

  it.each([1e-20, 1e-200, 1e200])('preserves standardized similarity after a scale change of %s', async (scale) => {
    const expected = await similarity(1);
    const actual = await similarity(scale);
    expect(actual.diagnostics.activeFeatures).toBe(2);
    expect(actual.diagnostics.excludedFeatureNames).toEqual([]);
    expect(actual.edges).toHaveLength(expected.edges.length);
    actual.edges.forEach((edge) => {
      const reference = expected.edges.find((item) => item.source === edge.source && item.target === edge.target);
      expect(reference).toBeDefined();
      expect(edge.rawCosine).toBeCloseTo(reference!.rawCosine, 12);
      expect(edge.value).toBeCloseTo(reference!.value, 12);
    });
  });
});
