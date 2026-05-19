export interface WeibullMessage {
  type: 'CALCULATE_WEIBULL';
  payload: {
    data: number[];
  };
}

export interface WeibullResponse {
  type: 'WEIBULL_RESULT' | 'ERROR';
  payload?: {
    m: number; // Weibull Modulus (Shape)
    eta: number; // Scale Parameter
    points: { value: number; x: number; y: number; p: number }[];
    safeValue95: number; // 95% survival (5% failure)
    rSquared: number;
  };
  error?: string;
}

self.onmessage = (e: MessageEvent<WeibullMessage>) => {
  try {
    const { data } = e.data.payload;
    if (!data || data.length < 3) {
      throw new Error("Weibull analysis requires at least 3 data points.");
    }

    // 1. Sort data
    const sorted = [...data].filter(v => v > 0).sort((a, b) => a - b);
    const n = sorted.length;

    if (n < 3) {
      throw new Error("Requires at least 3 positive data points.");
    }

    const points = [];
    let sumX = 0;
    let sumY = 0;

    // 2. Median Rank and Linearization
    for (let i = 0; i < n; i++) {
      const rank = i + 1;
      const p = (rank - 0.3) / (n + 0.4); // Bernard's Median Rank approximation
      
      const value = sorted[i];
      const lnX = Math.log(value);
      const lnLnY = Math.log(-Math.log(1 - p));

      points.push({ value, x: lnX, y: lnLnY, p });

      sumX += lnX;
      sumY += lnLnY;
    }

    // 3. Least Squares Linear Regression
    const meanX = sumX / n;
    const meanY = sumY / n;
    
    let ssX = 0;
    let ssY = 0;
    let ssXY = 0;
    
    for (const pt of points) {
        ssX += Math.pow(pt.x - meanX, 2);
        ssY += Math.pow(pt.y - meanY, 2);
        ssXY += (pt.x - meanX) * (pt.y - meanY);
    }

    const m = ssXY / ssX;
    const intercept = meanY - m * meanX;
    const eta = Math.exp(-intercept / m);
    
    // R^2 calculation
    const rSquared = Math.pow(ssXY, 2) / (ssX * ssY);

    // 4. Safe limit (5% failure -> 95% reliable)
    // p = 1 - exp(-(x/eta)^m) => x = eta * (-ln(1-p))^(1/m)
    const safeValue95 = eta * Math.pow(-Math.log(1 - 0.05), 1 / m);

    self.postMessage({
      type: 'WEIBULL_RESULT',
      payload: { m, eta, points, safeValue95, rSquared }
    } as WeibullResponse);

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
