
export interface SpcMessage {
  type: 'CALCULATE_SPC';
  payload: {
    data: number[];
    usl: number;
    lsl: number;
  };
}

export interface SpcResponse {
  type: 'SPC_RESULT' | 'ERROR';
  payload?: {
    mean: number;
    sigma: number;
    cp: number;
    cpk: number;
    ppm: number;
    histogram: { x: number; y: number }[];
    normalCurve: { x: number; y: number }[];
    histogramBins: number[];
    status: 'success' | 'warning' | 'danger';
  };
  error?: string;
}

// Error function approximation for normal cumulative distribution function
function erf(x: number) {
    const sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);

    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

function cdf(x: number, mean: number, sigma: number) {
    return 0.5 * (1 + erf((x - mean) / (Math.sqrt(2) * sigma)));
}

self.onmessage = (e: MessageEvent<SpcMessage>) => {
    try {
        const { data, usl, lsl } = e.data.payload;
        if (data.length < 2) {
            throw new Error("Standard deviation requires at least 2 data points.");
        }
        if (usl <= lsl) {
            throw new Error("USL must be strictly greater than LSL.");
        }

        const n = data.length;
        let sum = 0;
        for (let i = 0; i < n; i++) sum += data[i];
        const mean = sum / n;

        let sumSq = 0;
        for (let i = 0; i < n; i++) {
            sumSq += Math.pow(data[i] - mean, 2);
        }
        const sigma = Math.sqrt(sumSq / (n - 1));

        if (sigma === 0) {
            throw new Error("Standard deviation is zero. Data points are identical.");
        }

        const cp = (usl - lsl) / (6 * sigma);
        const cpu = (usl - mean) / (3 * sigma);
        const cpl = (mean - lsl) / (3 * sigma);
        const cpk = Math.min(cpu, cpl);

        // Calculate PPM (out of spec)
        const probLsl = cdf(lsl, mean, sigma);
        const probUsl = 1 - cdf(usl, mean, sigma);
        const ppm = (probLsl + probUsl) * 1000000;

        let status: 'success' | 'warning' | 'danger' = 'danger';
        if (cpk >= 1.33) {
            status = 'success';
        } else if (cpk >= 1) {
            status = 'warning';
        }

        // Generate histogram
        const minVal = Math.min(...data);
        const maxVal = Math.max(...data);
        const minData = Math.min(minVal, lsl - sigma * 1.5);
        const maxData = Math.max(maxVal, usl + sigma * 1.5);
        
        // Sturges' rule for number of bins
        const k = Math.max(7, Math.ceil(1 + 3.322 * Math.log10(n))); 
        const binWidth = (maxData - minData) / k;
        
        const histogramCounts = new Array(k).fill(0);
        for (let i = 0; i < n; i++) {
            let binIndex = Math.floor((data[i] - minData) / binWidth);
            if (binIndex >= k) binIndex = k - 1;
            else if (binIndex < 0) binIndex = 0;
            histogramCounts[binIndex]++;
        }

        const histogram = [];
        const histogramBins = [];
        for (let i = 0; i < k; i++) {
            const x = minData + (i + 0.5) * binWidth;
            histogram.push({ x, y: histogramCounts[i] });
            histogramBins.push(x);
        }

        // Generate normal distribution curve points
        const normalCurve = [];
        const points = 150;
        const xStep = (maxData - minData) / points;
        
        // Match histogram scale
        const scaleFactor = n * binWidth;
        for (let i = 0; i <= points; i++) {
            const x = minData + i * xStep;
            const pdf = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
            normalCurve.push({ x, y: pdf * scaleFactor });
        }

        self.postMessage({
            type: 'SPC_RESULT',
            payload: {
                mean,
                sigma,
                cp,
                cpk,
                ppm,
                histogram,
                normalCurve,
                histogramBins,
                status
            }
        });

    } catch (e) {
        self.postMessage({
            type: 'ERROR',
            error: e instanceof Error ? e.message : String(e)
        });
    }
}
