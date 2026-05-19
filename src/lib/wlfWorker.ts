export interface WlfMessage {
  type: 'CALCULATE_WLF';
  payload: {
    curves: { temp: number; points: { rate: number; visc: number }[] }[];
    refTemp: number;
    baseDensity?: number;
  };
}

export interface WlfResponse {
  type: 'WLF_RESULT' | 'ERROR';
  payload?: {
    c1: number;
    c2: number;
    refTemp: number;
    shiftFactors: { temp: number; aT: number }[];
    masterCurve: { temp: number; points: { rate: number; visc: number; originalRate: number; originalVisc: number }[] }[];
  };
  error?: string;
}

// Helper: Linearly interpolate Y(log visc) at X(log rate)
function interpolateCurve(logRate: number, logCurvePoints: { x: number; y: number }[]): number | null {
   if (logCurvePoints.length < 2) return null;
   if (logRate < logCurvePoints[0].x || logRate > logCurvePoints[logCurvePoints.length - 1].x) {
       return null;
   }
   for (let i = 0; i < logCurvePoints.length - 1; i++) {
       const p1 = logCurvePoints[i];
       const p2 = logCurvePoints[i+1];
       if (logRate >= p1.x && logRate <= p2.x) {
           const t = (logRate - p1.x) / (p2.x - p1.x);
           return p1.y + t * (p2.y - p1.y);
       }
   }
   return null;
}

self.onmessage = (e: MessageEvent<WlfMessage>) => {
  try {
    const { curves, refTemp } = e.data.payload;
    if (curves.length < 2) throw new Error("At least 2 temperature curves required for TTS master curve.");
    
    // Sort points in each curve by rate just in case
    const sortedCurves = curves.map(c => ({
        temp: c.temp,
        points: [...c.points].sort((a,b) => a.rate - b.rate)
    }));

    // Find ref curve
    let refCurve = sortedCurves.find(c => c.temp === refTemp);
    if (!refCurve) {
       // If exact ref temp not found, take the closest one
       refCurve = [...sortedCurves].sort((a, b) => Math.abs(a.temp - refTemp) - Math.abs(b.temp - refTemp))[0];
    }
    
    const theRefTemp = refCurve.temp;
    
    const logRefPoints = refCurve.points.map(p => ({ x: Math.log10(p.rate), y: Math.log10(p.visc) }));
    
    // 1. Numerically find best horizontal shift factor log(aT) for each curve relative to refCurve
    // We assume mainly horizontal shift: log(rate_master) = log(rate) + log(aT)
    // Vertical shift is usually bT = rho(T_ref)*T_ref / (rho(T)*T). We assume ≈ 1 for simplicity out of polymers class.
    // So log(visc_master) = log(visc) - log(aT)
    // Which means: we shift the curve by dx = u, dy = -u.
    // We want to find u = log(aT) that minimizes distance to ref curve.
    
    const shiftFactors = sortedCurves.map(c => {
       if (c.temp === theRefTemp) return { temp: c.temp, aT: 1, logAT: 0 };
       
       const logPoints = c.points.map(p => ({ x: Math.log10(p.rate), y: Math.log10(p.visc) }));
       
       // Grid search for u in [-10, 10]
       let bestU = 0;
       let minError = Infinity;
       
       for (let u = -10; u <= 10; u += 0.05) {
           let error = 0;
           let validPoints = 0;
           
           for (const p of logPoints) {
               const shiftedX = p.x + u;
               const shiftedY = p.y - u; // using aT for both freq and visc
               
               const refY = interpolateCurve(shiftedX, logRefPoints);
               if (refY !== null) {
                   error += Math.pow(shiftedY - refY, 2);
                   validPoints++;
               }
           }
           
           if (validPoints > 1) {
               const mse = error / validPoints;
               // Add a tiny penalty to u to prevent unbounded shifting if curves just perfectly parallel but far
               const penalizedMse = mse + 1e-4 * Math.abs(u);
               if (penalizedMse < minError) {
                   minError = penalizedMse;
                   bestU = u;
               }
           }
       }
       
       return { temp: c.temp, aT: Math.pow(10, bestU), logAT: bestU };
    });
    
    // 2. Fit WLF: log(aT) = -C1 (T - Tref) / (C2 + T - Tref)
    // => - (T - Tref) / log(aT) = (1/C1) * (T - Tref) + (C2/C1)
    // This is linear standard form: Y = mX + B
    // X = (T - Tref), Y = -(T - Tref) / log(aT)
    // C1 = 1 / m
    // C2 = B / m = B * C1
    
    const fitData = [];
    for (const f of shiftFactors) {
       if (f.temp === theRefTemp || Math.abs(f.logAT) < 0.01) continue;
       const X = f.temp - theRefTemp;
       const Y = -X / f.logAT;
       fitData.push({ X, Y });
    }
    
    let c1 = 8.86;
    let c2 = 101.6; // default universal fallback
    
    if (fitData.length >= 2) {
       const n = fitData.length;
       let sumX = 0, sumY = 0;
       for (const d of fitData) {
           sumX += d.X;
           sumY += d.Y;
       }
       const meanX = sumX / n;
       const meanY = sumY / n;
       
       let ssX = 0;
       let ssXY = 0;
       for (const d of fitData) {
           ssX += Math.pow(d.X - meanX, 2);
           ssXY += (d.X - meanX) * (d.Y - meanY);
       }
       
       if (Math.abs(ssX) > 1e-6) {
           const m = ssXY / ssX;
           const b = meanY - m * meanX;
           
           if (Math.abs(m) > 1e-6) {
               c1 = 1 / m;
               c2 = b * c1;
           }
       }
    }
    
    // 3. Generate Master Curve Data
    const masterCurve = sortedCurves.map(c => {
       const shift = shiftFactors.find(sf => sf.temp === c.temp);
       const aT = shift ? shift.aT : 1;
       
       return {
           temp: c.temp,
           points: c.points.map(p => ({
               originalRate: p.rate,
               originalVisc: p.visc,
               rate: p.rate * aT,
               visc: p.visc / aT
           }))
       };
    });

    self.postMessage({
      type: 'WLF_RESULT',
      payload: { c1, c2, refTemp: theRefTemp, shiftFactors, masterCurve }
    } as WlfResponse);

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
