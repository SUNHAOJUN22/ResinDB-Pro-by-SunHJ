import { Product } from '@/types/index';

export interface SimilarityResult {
  product: Product;
  score: number; // 0 to 100
  distance: number;
}

export function normalizeMatrixMinMax(
  data: Product[],
  valueExtractor: (item: Product, key: string) => number | null
): { mins: Record<string, number>, maxes: Record<string, number>, keys: string[] } {
  // Find all keys that have numeric values
  const numericKeys = new Set<string>();

  data.forEach((p) => {
    Object.keys(p.properties).forEach((k) => {
      const val = valueExtractor(p, k);
      if (val !== null && !isNaN(val)) {
        numericKeys.add(k);
      }
    });
  });

  const keys = Array.from(numericKeys);
  const mins: Record<string, number> = {};
  const maxes: Record<string, number> = {};

  keys.forEach((k) => {
    mins[k] = Infinity;
    maxes[k] = -Infinity;
  });

  data.forEach((p) => {
    keys.forEach((k) => {
      const val = valueExtractor(p, k);
      if (val !== null && !isNaN(val)) {
        if (val < mins[k]) mins[k] = val;
        if (val > maxes[k]) maxes[k] = val;
      }
    });
  });

  return { mins, maxes, keys };
}

export function euclideanDistance(vecA: number[], vecB: number[]): number {
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += Math.pow(vecA[i] - vecB[i], 2);
  }
  return Math.sqrt(sum);
}

export function findSimilarProducts(
  targetProduct: Product,
  allProducts: Product[],
  valueExtractor: (item: Product, key: string) => number | null
): SimilarityResult[] {
  if (allProducts.length <= 1) return [];

  const { mins, maxes, keys } = normalizeMatrixMinMax(allProducts, valueExtractor);

  const rangeDeltas: Record<string, number> = {};
  keys.forEach((k) => {
    rangeDeltas[k] = maxes[k] - mins[k];
  });

  const targetVec: Record<string, number> = {};
  keys.forEach((k) => {
    const val = valueExtractor(targetProduct, k);
    if (val !== null && !isNaN(val)) {
      targetVec[k] = rangeDeltas[k] > 0 ? (val - mins[k]) / rangeDeltas[k] : 0;
    }
  });

  const results: SimilarityResult[] = [];
  const minRequiredKeys = Math.min(2, keys.length);

  allProducts.forEach((p) => {
    if (p.id === targetProduct.id) return;

    let sumSq = 0;
    let validKeys = 0;

    keys.forEach((k) => {
      if (rangeDeltas[k] <= 0) return;

      const pVal = valueExtractor(p, k);
      if (pVal !== null && !isNaN(pVal) && targetVec[k] !== undefined) {
        const normP = (pVal - mins[k]) / rangeDeltas[k];
        const diff = targetVec[k] - normP;
        sumSq += diff * diff;
        validKeys++;
      }
    });

    if (validKeys >= minRequiredKeys) {
      const distance = Math.sqrt(sumSq);
      // Normalize distance by the number of valid keys
      const maxDist = Math.sqrt(validKeys); // since each dimension diff is max 1
      const similarity = Math.max(0, Math.round((1 - distance / maxDist) * 100));
      results.push({ product: p, distance, score: similarity });
    }
  });

  return results.sort((a, b) => b.score - a.score); // Sort by highest score
}
