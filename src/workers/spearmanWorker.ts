const SPEARMAN_MODEL_VERSION = 'average-rank-pearson-complete-cases-2.0.0';

export type SpearmanMessage = {
  type: 'COMPUTE_SPEARMAN';
  payload: {
    data: { id: string; values: Record<string, number> }[];
    keys: string[];
  };
};

export type SpearmanResponse = {
  type: 'SPEARMAN_RESULT';
  payload: {
    matrix: number[][];
    keys: string[];
    modelVersion: typeof SPEARMAN_MODEL_VERSION;
    diagnostics: {
      observations: number;
      missingDataPolicy: 'listwise-complete-cases';
      tiePolicy: 'average-ranks';
      constantCorrelationPolicy: 'zero-not-defined';
      constantKeys: string[];
    };
  };
} | {
  type: 'ERROR';
  payload: { message: string };
};

function getRanks(values: readonly number[]): Float64Array {
  const sorted = values.map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const ranks = new Float64Array(values.length);
  let cursor = 0;
  while (cursor < sorted.length) {
    let end = cursor + 1;
    while (end < sorted.length && sorted[end].value === sorted[cursor].value) end += 1;
    const averageRank = ((cursor + 1) + end) / 2;
    for (let index = cursor; index < end; index++) ranks[sorted[index].index] = averageRank;
    cursor = end;
  }
  return ranks;
}

self.onmessage = (event: MessageEvent<SpearmanMessage>) => {
  try {
    const { data, keys } = event.data.payload;
    if (new Set(keys).size !== keys.length) throw new Error('Spearman feature keys must be unique.');
    if (!data.length || keys.length < 2) {
      self.postMessage({
        type: 'SPEARMAN_RESULT',
        payload: {
          matrix: [],
          keys,
          modelVersion: SPEARMAN_MODEL_VERSION,
          diagnostics: {
            observations: 0,
            missingDataPolicy: 'listwise-complete-cases',
            tiePolicy: 'average-ranks',
            constantCorrelationPolicy: 'zero-not-defined',
            constantKeys: [],
          },
        },
      } satisfies SpearmanResponse);
      return;
    }

    const validData = data.filter((item) => (
      item
      && item.values
      && keys.every((key) => Number.isFinite(item.values[key]))
    ));
    const observations = validData.length;
    if (observations < 2) {
      throw new Error('Spearman correlation requires at least two complete finite observations.');
    }

    const ranksByKey = new Map<string, Float64Array>();
    const centeredNormSquared = new Float64Array(keys.length);
    const rankMean = (observations + 1) / 2;
    const constantKeys: string[] = [];
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex];
      const values = validData.map((item) => item.values[key]);
      const ranks = getRanks(values);
      ranksByKey.set(key, ranks);
      let sumSquared = 0;
      for (let observation = 0; observation < observations; observation++) {
        sumSquared += (ranks[observation] - rankMean) ** 2;
      }
      centeredNormSquared[keyIndex] = sumSquared;
      if (!(sumSquared > 0)) constantKeys.push(key);
    }

    const matrix = Array.from({ length: keys.length }, () => new Array<number>(keys.length).fill(0));
    for (let left = 0; left < keys.length; left++) {
      matrix[left][left] = centeredNormSquared[left] > 0 ? 1 : 0;
      const rankLeft = ranksByKey.get(keys[left])!;
      for (let right = left + 1; right < keys.length; right++) {
        const denominator = Math.sqrt(centeredNormSquared[left] * centeredNormSquared[right]);
        let rho = 0;
        if (denominator > 0) {
          const rankRight = ranksByKey.get(keys[right])!;
          let covariance = 0;
          for (let observation = 0; observation < observations; observation++) {
            covariance += (rankLeft[observation] - rankMean) * (rankRight[observation] - rankMean);
          }
          rho = Math.max(-1, Math.min(1, covariance / denominator));
        }
        matrix[left][right] = rho;
        matrix[right][left] = rho;
      }
    }

    self.postMessage({
      type: 'SPEARMAN_RESULT',
      payload: {
        matrix,
        keys,
        modelVersion: SPEARMAN_MODEL_VERSION,
        diagnostics: {
          observations,
          missingDataPolicy: 'listwise-complete-cases',
          tiePolicy: 'average-ranks',
          constantCorrelationPolicy: 'zero-not-defined',
          constantKeys,
        },
      },
    } satisfies SpearmanResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: error instanceof Error ? error.message : 'Unknown error' },
    } satisfies SpearmanResponse);
  }
};
