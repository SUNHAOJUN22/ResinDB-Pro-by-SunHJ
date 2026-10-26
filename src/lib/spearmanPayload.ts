import type { Product } from '@/types/index';
import { comparisonObservations } from '@/utils/productUtils';

export interface SpearmanPayloadRow {
  id: string;
  values: Partial<Record<string, number>>;
}

/**
 * Builds the Spearman worker payload without inventing numeric observations.
 * Missing, blank, malformed, boolean, NaN and infinite values are omitted so the
 * worker's complete-case policy can reject incomplete rows instead of treating
 * unknown data as the physical value zero.
 */
export function buildSpearmanPayload(
  data: readonly Product[],
  keys: readonly string[],
): SpearmanPayloadRow[] {
  const observations = new Map(keys.map(key => [key, comparisonObservations(data, key, true)]));
  return data.map((product, index) => {
    const values: Partial<Record<string, number>> = {};
    for (const key of keys) {
      const observation = observations.get(key)?.[index];
      if (observation) values[key] = observation.value;
    }
    return { id: product.id, values };
  });
}
