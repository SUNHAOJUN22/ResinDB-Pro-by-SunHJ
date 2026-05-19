
export interface PronyMessage {
  type: 'RUN_PRONY';
  payload: {
    data: { omega: number; storage: number; loss: number }[]; // omega: rad/s, storage: MPa, loss: MPa
    numTerms: number; 
  };
}

export interface PronyResponse {
  type: 'PRONY_RESULT' | 'ERROR';
  payload?: {
    E_inf: number;
    E_sum: number; // for Abaqus normalisation
    terms: { tau: number; E: number }[];
    points: { omega: number; storage: number; loss: number; storage_fit: number; loss_fit: number }[];
    error_metric: number;
    abaqusCard: string;
  };
  error?: string;
}

self.onmessage = (e: MessageEvent<PronyMessage>) => {
    try {
        const { data, numTerms } = e.data.payload;
        if (data.length < 3) throw new Error("At least 3 data points required.");
        
        // Sort data by omega
        data.sort((a,b) => a.omega - b.omega);
        
        const M = data.length;
        const minOmega = Math.max(1e-12, Math.min(...data.map(d=>d.omega)));
        const maxOmega = Math.max(...data.map(d=>d.omega));
        
        const minTau = 1 / maxOmega;
        const maxTau = 1 / minOmega;
        
        const tau = [];
        if (numTerms === 1) {
            tau.push(Math.sqrt(minTau * maxTau));
        } else {
            const logMin = Math.log10(minTau);
            const logMax = Math.log10(maxTau);
            const step = (logMax - logMin) / (numTerms - 1);
            for (let i=0; i<numTerms; i++) {
                tau.push(Math.pow(10, logMin + i * step));
            }
        }
        
        const b = new Float64Array(2 * M);
        for(let j=0; j<M; j++){
            b[j] = data[j].storage;
            b[j+M] = data[j].loss;
        }
        
        const N = numTerms + 1; 
        const A = new Array(2*M).fill(0).map(()=>new Float64Array(N));
        
        for(let j=0; j<M; j++){
            const w = data[j].omega;
            A[j][0] = 1;  // E_infinity constant contribution to Storage
            A[j+M][0] = 0; // E_infinity has 0 contribution to Loss
            for(let i=0; i<numTerms; i++){
                const t = tau[i];
                const wt = w * t;
                const wt2 = wt * wt;
                const denom = 1 + wt2;
                A[j][1+i] = wt2 / denom; // Storage coefficient
                A[j+M][1+i] = wt / denom; // Loss coefficient
            }
        }
        
        const x = new Float64Array(N); 
        const maxE = Math.max(...data.map(d => d.storage));
        for(let i=0; i<N; i++) x[i] = maxE / N; // Start with decent uniform guess
        
        const AtA = new Array(N).fill(0).map(()=>new Float64Array(N));
        const Atb = new Float64Array(N);
        
        for(let i=0; i<N; i++){
            for(let j=0; j<N; j++){
                for(let k=0; k<2*M; k++){
                    AtA[i][j] += A[k][i] * A[k][j];
                }
            }
            for(let k=0; k<2*M; k++){
                Atb[i] += A[k][i] * b[k];
            }
        }
        
        // Tikhonov Regularization to prevent singular matrix / smooth terms
        let maxDiag = 0;
        for(let i=0; i<N; i++) maxDiag = Math.max(maxDiag, AtA[i][i]);
        const lambda = 1e-4 * maxDiag;
        for(let i=0; i<N; i++){
            AtA[i][i] += lambda;
        }
        
        // Projected Gradient Descent for Non-negative Least Squares
        const maxIter = 100000;
        const lr = maxDiag > 0 ? 0.05 / maxDiag : 1e-3;

        for(let iter=0; iter<maxIter; iter++){
            let diff = 0;
            const grad = new Float64Array(N);
            for(let i=0; i<N; i++){
                for(let j=0; j<N; j++){
                    grad[i] += AtA[i][j] * x[j];
                }
                grad[i] -= Atb[i];
            }
            for(let i=0; i<N; i++){
                const old = x[i];
                x[i] = Math.max(0, x[i] - lr * grad[i]);
                diff += Math.abs(x[i] - old);
            }
            if(diff < 1e-8) break;
        }
        
        const E_inf = x[0];
        const terms = [];
        let E_sum = E_inf;
        for(let i=0; i<numTerms; i++) {
            terms.push({ tau: tau[i], E: x[1+i] });
            E_sum += x[1+i];
        }
        
        const points = [];
        let sse = 0;
        for(let j=0; j<M; j++){
            let st_fit = E_inf;
            let ls_fit = 0;
            const w = data[j].omega;
            for(let i=0; i<numTerms; i++){
                const t = tau[i];
                const E = x[1+i];
                const wt = w * t;
                const wt2 = wt * wt;
                const denom = 1 + wt2;
                st_fit += E * wt2 / denom;
                ls_fit += E * wt / denom;
            }
            sse += Math.pow(st_fit - data[j].storage, 2) + Math.pow(ls_fit - data[j].loss, 2);
            points.push({
                omega: data[j].omega,
                storage: data[j].storage,
                loss: data[j].loss,
                storage_fit: st_fit,
                loss_fit: ls_fit
            });
        }
        
        // Sort terms by relaxation time tau
        terms.sort((a,b)=>a.tau - b.tau);
        
        let abaqusStr = "*VISCOELASTIC, TIME=PRONY\n";
        terms.forEach(t => {
            if (t.E > 1e-10) {
                const ratio = t.E / E_sum;
                abaqusStr += `${(ratio).toExponential(5)}, ${(ratio).toExponential(5)}, ${t.tau.toExponential(5)}\n`;
            }
        });
        
        self.postMessage({
            type: 'PRONY_RESULT',
            payload: {
                E_inf,
                E_sum,
                terms: terms.filter(t => t.E > 1e-10),
                points,
                error_metric: Math.sqrt(sse / (2*M)),
                abaqusCard: abaqusStr
            }
        });
        
    } catch(e) {
        self.postMessage({
            type: 'ERROR',
            error: e instanceof Error ? e.message : String(e)
        });
    }
}
