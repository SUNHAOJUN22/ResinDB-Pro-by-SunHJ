export interface ArrheniusMessage {
  type: 'CALCULATE_ARRHENIUS';
  payload: {
    points: { tempC: number; time: number }[];
  };
}

export interface ArrheniusResponse {
  type: 'ARRHENIUS_RESULT' | 'ERROR';
  payload?: {
    ea: number; // Activation energy kJ/mol
    lnA: number; // intercept
    rSquared: number;
    points: { tempC: number; time: number; x: number; y: number }[];
    equation: { m: number; b: number };
  };
  error?: string;
}

self.onmessage = (e: MessageEvent<ArrheniusMessage>) => {
  try {
    const { points } = e.data.payload;
    if (points.length < 2) {
      throw new Error("Arrhenius analysis requires at least 2 data points.");
    }

    const mappedPoints = points.map(p => {
      const tK = p.tempC + 273.15;
      return {
        tempC: p.tempC,
        time: p.time,
        x: 1 / tK,
        y: Math.log(p.time)
      };
    });

    const n = mappedPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (const pt of mappedPoints) {
      sumX += pt.x;
      sumY += pt.y;
      sumXY += pt.x * pt.y;
      sumXX += pt.x * pt.x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 1e-12) {
       throw new Error("Invalid data for linear regression (denominator too close to 0).");
    }

    const m = (n * sumXY - sumX * sumY) / denominator;
    const b = (sumY - m * sumX) / n;

    // R squared calculation
    
    const meanY = sumY / n;
    let ssTot = 0;
    let ssRes = 0;
    for (const pt of mappedPoints) {
       ssTot += Math.pow(pt.y - meanY, 2);
       const predY = m * pt.x + b;
       ssRes += Math.pow(pt.y - predY, 2);
    }
    const rSquared = Math.abs(ssTot) > 1e-12 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;

    // Activation Energy (kJ/mol)
    // equation: ln(t) = (Ea / R) * (1/T) + ln(A)
    // slope m = Ea / R
    // Ea = m * R
    const R = 8.314; // J/(mol*K)
    const ea = (m * R) / 1000; // converted to kJ/mol

    self.postMessage({
      type: 'ARRHENIUS_RESULT',
      payload: {
        ea,
        lnA: b,
        rSquared,
        points: mappedPoints,
        equation: { m, b }
      }
    } as ArrheniusResponse);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
