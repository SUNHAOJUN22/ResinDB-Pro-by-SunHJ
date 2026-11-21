const WEIBULL_MODEL_VERSION = 'two-parameter-median-rank-ols-2.1.0';

export interface WeibullMessage {
  type: 'CALCULATE_WEIBULL';
  payload: {
    data: number[];
  };
}

export interface WeibullResponse {
  type: 'WEIBULL_RESULT' | 'ERROR';
  payload?: {
    m: number;
    eta: number;
    points: { value: number; x: number; y: number; p: number }[];
    safeValue95: number;
    rSquared: number;
    modelVersion: typeof WEIBULL_MODEL_VERSION;
    estimator: 'bernard-median-rank-linear-regression-not-mle';
    failureProbabilityForSafeValue: 0.05;
    observations: number;
  };
  error?: string;
}

self.onmessage = (event: MessageEvent<WeibullMessage>) => {
  try {
    const sorted = (event.data.payload.data ?? [])
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);
    const observations = sorted.length;
    if (observations < 3) throw new Error('Weibull analysis requires at least three finite positive observations.');

    const points: { value: number; x: number; y: number; p: number }[] = [];
    let meanX = 0;
    let meanY = 0;
    for (let index = 0; index < observations; index++) {
      const rank = index + 1;
      const p = (rank - 0.3) / (observations + 0.4);
      const x = Math.log(sorted[index]);
      const y = Math.log(-Math.log1p(-p));
      points.push({ value: sorted[index], x, y, p });
      meanX += x;
      meanY += y;
    }
    meanX /= observations;
    meanY /= observations;
    let centeredXX = 0;
    let centeredYY = 0;
    let centeredXY = 0;
    for (const point of points) {
      centeredXX += (point.x - meanX) ** 2;
      centeredYY += (point.y - meanY) ** 2;
      centeredXY += (point.x - meanX) * (point.y - meanY);
    }
    if (!(centeredXX > Number.EPSILON)) throw new Error('Weibull observations have no usable logarithmic spread.');
    const m = centeredXY / centeredXX;
    if (!(m > 0) || !Number.isFinite(m)) {
      throw new Error('The fitted Weibull shape parameter is not positive and finite.');
    }
    const logEta = meanX - meanY / m;
    const eta = Math.exp(logEta);
    if (!(eta > 0) || !Number.isFinite(eta)) throw new Error('The fitted Weibull scale is invalid.');
    const denominator = centeredXX * centeredYY;
    const rSquared = denominator > 0
      ? Math.max(0, Math.min(1, centeredXY * centeredXY / denominator))
      : 0;
    const failureProbabilityForSafeValue = 0.05 as const;
    // Keep the scale and probability together until the final exponentiation:
    // the probability factor alone can underflow while the quantile is finite.
    const safeValue95 = Math.exp(
      logEta + Math.log(-Math.log1p(-failureProbabilityForSafeValue)) / m,
    );
    if (!(safeValue95 > 0) || !Number.isFinite(safeValue95)) {
      throw new Error('The fitted Weibull failure quantile is not positive and finite at this numeric scale.');
    }

    self.postMessage({
      type: 'WEIBULL_RESULT',
      payload: {
        m,
        eta,
        points,
        safeValue95,
        rSquared,
        modelVersion: WEIBULL_MODEL_VERSION,
        estimator: 'bernard-median-rank-linear-regression-not-mle',
        failureProbabilityForSafeValue,
        observations,
      },
    } satisfies WeibullResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    } satisfies WeibullResponse);
  }
};
