import { Product } from '@/types/index';

export interface ForecastingWorkerMessage {
  type: 'RUN_FORECAST';
  payload: {
    products: Product[];
    propertyKey: string;
    algorithm: 'linear' | 'exponential' | 'holt-winters';
    condition: 'thermal' | 'uv' | 'hydrolysis' | 'cyclic';
    stressFactor: number; // e.g., temperature in °C, UV hours, etc.
    alpha?: number;       // Holt-winters level smoothing
    beta?: number;        // Holt-winters trend smoothing
  };
}

export interface DayTrendPoint {
  month: number; // Range: -12 to +12
  monthLabel: string;
  observed: number | null; // actual value, null for future
  predicted: number | null; // forecasted trend line
  lowerBound: number | null; // 95% confidence lower limit
  upperBound: number | null; // 95% confidence upper limit
}

export interface ForecastMetrics {
  currentValue: number;
  projectedValue12m: number;
  retentionPercent: number;
  halfLifeMonths: number | string; // Month when properties will decay to 50%
  degradationRatePercent: number; // Annualized degradation rate
  safetyStatus: 'safe' | 'warning' | 'danger';
  safetyMessage: string;
}

export interface ForecastingWorkerResponse {
  type: 'FORECAST_RESULT' | 'ERROR';
  payload?: {
    trendPoints: DayTrendPoint[];
    metrics: ForecastMetrics;
    propertyName: string;
    productCount: number;
  };
  error?: string;
}

// Helpers
function parseValue(val: any): number | null {
  if (val === undefined || val === null) return null;
  const strVal = String(val).trim();
  if (strVal === '') return null;
  const parsed = parseFloat(strVal);
  return isNaN(parsed) ? null : parsed;
}

self.onmessage = (e: MessageEvent<ForecastingWorkerMessage>) => {
  try {
    const { products, propertyKey, algorithm, condition, stressFactor, alpha = 0.4, beta = 0.3 } = e.data.payload;

    if (!products || products.length === 0) {
      throw new Error("No products selected. Please select resin grades for forecasting.");
    }

    // 1. Compute aggregate/average baseline value of the property for the current products
    let sumValues = 0;
    let countValues = 0;
    const valuesArray: number[] = [];

    products.forEach(p => {
      const propObj = p.properties?.[propertyKey];
      if (propObj) {
        const v = parseValue(propObj.value);
        if (v !== null) {
          sumValues += v;
          countValues++;
          valuesArray.push(v);
        }
      }
    });

    if (countValues === 0) {
      throw new Error(`The selected property "${propertyKey}" has no numeric data points in the selected material workspace.`);
    }

    const baselineValue = sumValues / countValues;

    // Determine variance of the baseline value to style standard error
    let sumSqrDiff = 0;
    valuesArray.forEach(v => {
      sumSqrDiff += Math.pow(v - baselineValue, 2);
    });
    const baseVariance = countValues > 1 ? sumSqrDiff / (countValues - 1) : baselineValue * 0.05;
    const baseStdDev = Math.sqrt(baseVariance) || (baselineValue * 0.03);

    // 2. Simulate historical data (-12 to 0 months) based on selected environmental stress condition
    // Each environmental condition causes a different historical drift & degradation kinetics
    let monthlyDrift = 0;       // fractional change per month
    let randomNoiseFactor = 0.015; // standard deviation deviation noise (1.5%)

    if (condition === 'thermal') {
      // Arrhenius-like aging. Higher thermal stress temperature = faster degradation
      // e.g. typical Arrhenius rule of doubling degradation rate every 10°C rise above 25°C
      const deltaT = Math.max(0, stressFactor - 25);
      const thermalAcceleration = Math.pow(2, deltaT / 10);
      monthlyDrift = -0.005 * thermalAcceleration; // e.g. -0.5% base loss * multiplier
    } else if (condition === 'uv') {
      // Photo-oxidative degradation (UV exposure hours per day, stressFactor represents hours/day)
      const uvExposureHrs = Math.max(0, Math.min(24, stressFactor));
      monthlyDrift = -0.004 * (uvExposureHrs / 4);
    } else if (condition === 'hydrolysis') {
      // Hot Water Hydrolysis degradation, stressFactor represents Relative Humidity (0-100%) or temperature
      monthlyDrift = -0.003 * (stressFactor / 50);
    } else if (condition === 'cyclic') {
      // Cyclic mechanical fatigue. StressFactor represents load (MPa / 10)
      monthlyDrift = -0.006 * (stressFactor / 10);
    }

    // Adjust drift slightly if the product is experimental vs industrial
    const experimentalCount = products.filter(p => p.isExperimental).length;
    if (experimentalCount > products.length / 2) {
      monthlyDrift *= 1.25; // Experimental resins degrade faster or exhibit higher fluctuations
      randomNoiseFactor *= 1.8;
    }

    // Build the 13 historical points (Month -12 to Month 0)
    // Month 0 MUST be matched to the current baseline value
    const historicalPoints: { month: number; val: number }[] = [];
    
    // Simulate backwards from Month 0 to Month -12
    let currentVal = baselineValue;
    historicalPoints.push({ month: 0, val: currentVal });

    for (let m = -1; m >= -12; m--) {
      // Apply inverse drift to get backwards historical point
      // e.g. backwards value was higher before degradations
      const driftVal = currentVal / (1 + monthlyDrift);
      
      // Seeded mock noise
      const seed = Math.sin(m * 123.456 + m);
      const noise = driftVal * randomNoiseFactor * seed;
      
      currentVal = driftVal + noise;
      historicalPoints.push({ month: m, val: currentVal });
    }

    // Reverse to chronological order (Month -12 to Month 0)
    historicalPoints.reverse();

    // 3. Compute forecasts (Month 1 to Month 12)
    const futureMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const forecastPoints: { month: number; predicted: number; sError: number }[] = [];

    const histX = historicalPoints.map(p => p.month);
    const histY = historicalPoints.map(p => p.val);
    const nHist = historicalPoints.length;

    if (algorithm === 'linear') {
      // Linear Regression calculation
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < nHist; i++) {
        sumX += histX[i];
        sumY += histY[i];
        sumXY += histX[i] * histY[i];
        sumXX += histX[i] * histX[i];
      }

      const slopeDenom = nHist * sumXX - sumX * sumX;
      const slope = (nHist * sumXY - sumX * sumY) / (Math.abs(slopeDenom) > 1e-15 ? slopeDenom : 1e-15);
      const safeNHist = nHist > 0 ? nHist : 1;
      const intercept = (sumY - slope * sumX) / safeNHist;

      // Fit residual sum of squares to estimate standard error of forecasting
      let sumResidualSquares = 0;
      for (let i = 0; i < nHist; i++) {
        const predictedVal = slope * histX[i] + intercept;
        sumResidualSquares += Math.pow(histY[i] - predictedVal, 2);
      }
      const residualStdDev = Math.sqrt(Math.max(0, sumResidualSquares / (nHist > 2 ? nHist - 2 : 1))) || (baselineValue * 0.02);

      futureMonths.forEach(m => {
        const predicted = slope * m + intercept;
        // Forecasting error expands as we move further into the future
        const safeNHistSE = nHist > 0 ? nHist : 1;
        const seDenom = sumXX - (sumX * sumX) / safeNHistSE;
        const sError = residualStdDev * Math.sqrt(Math.max(0, 1 + 1 / safeNHistSE + Math.pow(m, 2) / (Math.abs(seDenom) > 1e-15 ? seDenom : 1e-15)));
        forecastPoints.push({ month: m, predicted, sError });
      });

    } else if (algorithm === 'exponential') {
      // Exponential decay fitting: y = A * e^(B * m) -> ln(y) = ln(A) + B * m
      let sumX = 0, sumLnY = 0, sumXLnY = 0, sumXX = 0;
      let validHistPointsCount = 0;

      for (let i = 0; i < nHist; i++) {
        if (histY[i] > 0) {
          const lnY = Math.log(histY[i]);
          sumX += histX[i];
          sumLnY += lnY;
          sumXLnY += histX[i] * lnY;
          sumXX += histX[i] * histX[i];
          validHistPointsCount++;
        }
      }

      if (validHistPointsCount < 2) {
        // Fallback to simplistic decay
        const k = Math.max(0.001, -monthlyDrift);
        futureMonths.forEach(m => {
          const predicted = baselineValue * Math.exp(-k * m);
          const sError = baseStdDev * Math.sqrt(m) * 0.4;
          forecastPoints.push({ month: m, predicted, sError });
        });
      } else {
        const expDenom = validHistPointsCount * sumXX - sumX * sumX;
        const b = (validHistPointsCount * sumXLnY - sumX * sumLnY) / (Math.abs(expDenom) > 1e-15 ? expDenom : 1e-15);
        const safeVHPC = validHistPointsCount > 0 ? validHistPointsCount : 1;
        const lnA = (sumLnY - b * sumX) / safeVHPC;
        const a = Math.exp(lnA);

        let sumResSquares = 0;
        for (let i = 0; i < nHist; i++) {
          const predictedExp = a * Math.exp(b * histX[i]);
          sumResSquares += Math.pow(histY[i] - predictedExp, 2);
        }
        const residualStdDev = Math.sqrt(Math.max(0, sumResSquares / (validHistPointsCount > 2 ? validHistPointsCount - 2 : 1))) || (baselineValue * 0.03);

        futureMonths.forEach(m => {
          const predicted = a * Math.exp(b * m);
          const sError = residualStdDev * Math.sqrt(1 + m * 0.15);
          forecastPoints.push({ month: m, predicted, sError });
        });
      }

    } else if (algorithm === 'holt-winters') {
      // Holt-Winters Double Exponential Smoothing (Additive Trend)
      // Level (L_t), Trend (T_t)
      // Initialize levels at Month -12
      let l = histY[0];
      let t = histY[1] - histY[0]; // simple initial trend

      // Smooth through historical points
      for (let i = 1; i < nHist; i++) {
        const yObs = histY[i];
        const nextL = alpha * yObs + (1 - alpha) * (l + t);
        const nextT = beta * (nextL - l) + (1 - beta) * t;
        l = nextL;
        t = nextT;
      }

      // Project future points
      let cumError = baseStdDev;
      futureMonths.forEach((m, futIdx) => {
        const h = futIdx + 1; // forecast steps ahead
        const predicted = l + h * t;
        cumError += (baseStdDev * 0.15); // growing variance
        forecastPoints.push({ month: m, predicted, sError: cumError });
      });
    }

    // 4. Assemble consolidated trendPoints array (-12 to +12)
    const trendPoints: DayTrendPoint[] = [];

    // Historical points
    historicalPoints.forEach(p => {
      // Add standard baseline variance boundaries to historical values (to display consistency band)
      const isCurrentMonth = p.month === 0;
      const lowerBound = isCurrentMonth ? p.val - baseStdDev * 1.96 : null;
      const upperBound = isCurrentMonth ? p.val + baseStdDev * 1.96 : null;

      trendPoints.push({
        month: p.month,
        monthLabel: p.month === 0 ? 'Current' : `M${p.month}`,
        observed: p.val,
        predicted: p.month === 0 ? p.val : null,
        lowerBound,
        upperBound
      });
    });

    // Future points
    forecastPoints.forEach(p => {
      trendPoints.push({
        month: p.month,
        monthLabel: `F+${p.month}m`,
        observed: null,
        predicted: p.predicted,
        lowerBound: Math.max(0, p.predicted - p.sError * 1.96), // 95% CI bound
        upperBound: p.predicted + p.sError * 1.96
      });
    });

    // 5. Compute performance diagnostics and metrics
    const projectedValue12m = forecastPoints[forecastPoints.length - 1].predicted;
    const safeBaseline = Math.abs(baselineValue) > 1e-15 ? baselineValue : 1e-15;
    const retentionPercent = Math.max(0, Math.min(100, (projectedValue12m / safeBaseline) * 100));
    const degradationRatePercent = ((baselineValue - projectedValue12m) / safeBaseline) * 100;

    // Estimate T50 Half-Life
    let halfLifeMonths: number | string = 'N/A';
    if (projectedValue12m < baselineValue) {
      if (algorithm === 'exponential') {
        // formula math solver: A e^(B * m) = A * 0.5 -> B * m = ln(0.5) = -0.693 -> m = -0.693 / B
        // find B from fitting
        const validHistPointsCount = historicalPoints.filter(p => p.val > 0).length;
        if (validHistPointsCount >= 2) {
          let sumX = 0, sumLnY = 0, sumXLnY = 0, sumXX = 0;
          for (let i = 0; i < nHist; i++) {
            if (histY[i] > 0) {
              const lnY = Math.log(histY[i]);
              sumX += histX[i];
              sumLnY += lnY;
              sumXLnY += histX[i] * lnY;
              sumXX += histX[i] * histX[i];
            }
          }
          const hlDenom = validHistPointsCount * sumXX - sumX * sumX;
          const b = (validHistPointsCount * sumXLnY - sumX * sumLnY) / (Math.abs(hlDenom) > 1e-15 ? hlDenom : 1e-15);
          if (b < -1e-15) {
            halfLifeMonths = Math.round(-Math.log(2) / b);
          }
        }
      } else {
        // Linearly or through step scan
        const slope = (projectedValue12m - baselineValue) / 12;
        if (slope < -1e-15) {
          halfLifeMonths = Math.round((baselineValue * 0.5 - baselineValue) / slope);
        }
      }
    }

    if (typeof halfLifeMonths === 'number' && halfLifeMonths > 240) {
      halfLifeMonths = '>20 years';
    } else if (typeof halfLifeMonths === 'number' && halfLifeMonths <= 0) {
      halfLifeMonths = 'Not Degrading';
    } else if (typeof halfLifeMonths === 'number') {
      halfLifeMonths = `${halfLifeMonths} months`;
    }

    // Determine safety indicators
    let safetyStatus: 'safe' | 'warning' | 'danger' = 'safe';
    let safetyMessage = '';

    if (retentionPercent >= 85) {
      safetyStatus = 'safe';
      safetyMessage = `Excellent thermal and UV durability stability. Material retains over 85% of physical specifications at 12 months under active stress.`;
    } else if (retentionPercent >= 65) {
      safetyStatus = 'warning';
      safetyMessage = `Moderate physical parameter deterioration flagged. Critical structural degradation warnings recommended if subjected to prolonged stress outside laboratory configurations.`;
    } else {
      safetyStatus = 'danger';
      safetyMessage = `EXTREME degradation threshold breached. Projected physical properties fall below 65% of base configurations. Curing stabilizers or compound UV blockers strongly recommended!`;
    }

    self.postMessage({
      type: 'FORECAST_RESULT',
      payload: {
        trendPoints,
        metrics: {
          currentValue: baselineValue,
          projectedValue12m,
          retentionPercent,
          halfLifeMonths,
          degradationRatePercent,
          safetyStatus,
          safetyMessage
        },
        propertyName: propertyKey,
        productCount: products.length
      }
    } as ForecastingWorkerResponse);

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    } as ForecastingWorkerResponse);
  }
};
