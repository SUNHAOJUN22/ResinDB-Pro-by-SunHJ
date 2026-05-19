
export interface KineticsMessage {
  type: 'RUN_KINETICS';
  payload: {
    data: { beta: number; tp: number }[]; // beta: heating rate (K/min), tp: peak temp (Celsius)
    isoTemp: number; // Isothermal curing temperature (Celsius) for prediction
  };
}

export interface KineticsResponse {
  type: 'KINETICS_RESULT' | 'ERROR';
  payload?: {
    E: number; // Activation Energy (kJ/mol)
    A: number; // Pre-exponential factor (min^-1)
    r2: number; // R-squared
    points: { x: number; y: number }[]; // 1/Tp (1/K) vs ln(beta/Tp^2)
    line: { x: number; y: number }[]; // fitted line points
    isoCurve: { time: number; alpha: number }[]; // Predicted conversion curve
    equation: string;
  };
  error?: string;
}

self.onmessage = (e: MessageEvent<KineticsMessage>) => {
    try {
        const { data, isoTemp } = e.data.payload;
        if (!data || data.length < 3) {
            throw new Error("Kissinger fitting requires at least 3 heating rates (data points).");
        }

        const R = 8.314; // J/(mol*K)
        
        const X: number[] = [];
        const Y: number[] = [];
        const points = [];

        for (const row of data) {
            if (row.beta <= 0) throw new Error("Heating rate must be strictly positive.");
            const tK = row.tp + 273.15; // C to K
            const x = 1 / tK;
            const y = Math.log(row.beta / (tK * tK));
            X.push(x);
            Y.push(y);
            points.push({ x, y });
        }

        // Linear Regression Y = mX + b
        const n = points.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += X[i];
            sumY += Y[i];
            sumXY += X[i] * Y[i];
            sumX2 += X[i] * X[i];
            sumY2 += Y[i] * Y[i];
        }

        const xMean = sumX / n;
        const yMean = sumY / n;

        const numerator = sumXY - n * xMean * yMean;
        const denominator = sumX2 - n * xMean * xMean;

        if (Math.abs(denominator) < 1e-12) {
            throw new Error("Unable to fit data (Zero variance in X).");
        }

        const slope = numerator / denominator;
        const intercept = yMean - slope * xMean;

        // Calculate R^2
        const ssTot = sumY2 - n * yMean * yMean;
        const ssRes = sumY2 - intercept * sumY - slope * sumXY;
        const r2 = 1 - (ssRes / ssTot);

        // Calculate E and A
        // slope = -E/R => E = -slope * R
        const E_joules = -slope * R;
        const E_kj = E_joules / 1000;
        
        if (E_kj <= 0) {
            throw new Error("Invalid activation energy (E ≤ 0), please check input data trends.");
        }

        // intercept = ln(A*R/E) => A = (E/R) * exp(intercept)
        const A = (E_joules / R) * Math.exp(intercept);

        // Generate line points
        const minX = Math.min(...X);
        const maxX = Math.max(...X);
        const spanX = maxX - minX;
        const padX = spanX * 0.1;
        
        const line = [
            { x: minX - padX, y: (minX - padX) * slope + intercept },
            { x: maxX + padX, y: (maxX + padX) * slope + intercept }
        ];

        // Isothermal Prediction
        const isoCurve = [];
        const tK_iso = isoTemp + 273.15;
        // k = A * exp(-E/RT)
        const k = A * Math.exp(-E_joules / (R * tK_iso));
        
        // Let's predict until conversion (alpha) is 99%
        // alpha(t) = 1 - exp(-kt) => t = -ln(1-alpha)/k
        const t99 = -Math.log(1 - 0.99) / k;
        
        // Generate 100 points
        const steps = 100;
        const dt = t99 / steps;
        for(let i=0; i<=steps; i++) {
            const t = i * dt;
            const alpha = 1 - Math.exp(-k * t);
            isoCurve.push({ time: t, alpha: alpha * 100 });
        }

        self.postMessage({
            type: 'KINETICS_RESULT',
            payload: {
                E: E_kj,
                A,
                r2,
                points,
                line,
                isoCurve,
                equation: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`
            }
        });

    } catch (e) {
        self.postMessage({
            type: 'ERROR',
            error: e instanceof Error ? e.message : String(e)
        });
    }
};
