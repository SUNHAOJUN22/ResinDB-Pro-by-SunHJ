import { FormulaConfig, Product, PropertyValue } from '@/types/index';
import { formulaEngine } from '@/lib/formulaParser';

export interface SobolMessage {
  type: 'RUN_SOBOL';
  payload: {
    targetFormulaId: string;
    formulas: FormulaConfig[];
    product: Product;
    variances: Record<string, number>; // std dev as % of base value (e.g., 5 for 5%)
    iterations?: number; // N, total samples will be N * (D + 2)
  };
}

export interface SobolResponse {
  type: 'SOBOL_COMPLETE' | 'ERROR';
  payload?: {
    firstOrder: { name: string; value: number }[];
    totalEffect: { name: string; value: number }[];
    interactions: { name: string; value: number }[]; // Total - FirstOrder
  };
  error?: string;
}

// Box-Muller transform for normal distribution sampling
function randomNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  const num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  return num * stdDev + mean;
}

self.onmessage = (e: MessageEvent<SobolMessage>) => {
  try {
    const { targetFormulaId, formulas, product, variances, iterations = 2000 } = e.data.payload;
    
    const evaluator = formulaEngine.compileGraph(formulas);
    
    // Determine which properties actually need variance (inputs for Sobol)
    const baseProperties = product.properties;
    const inputKeys: string[] = [];
    const inputMeans: number[] = [];
    const inputStdDevs: number[] = [];
    
    for (const [key, val] of Object.entries(baseProperties)) {
        const numVal = parseFloat(String(val.value));
        if (!isNaN(numVal) && variances[key] && variances[key] > 0) {
            inputKeys.push(key);
            inputMeans.push(numVal);
            inputStdDevs.push(numVal * (variances[key] / 100));
        }
    }
    
    const D = inputKeys.length;
    if (D === 0) {
        throw new Error("No variables with variance > 0 provided for Sobol analysis.");
    }

    const N = iterations;

    // Helper to evaluate model from an array of inputs matching inputKeys
    const evaluate = (inputs: number[]): number => {
        const perturbedProps: Record<string, PropertyValue> = { ...baseProperties };
        for (let i = 0; i < D; i++) {
            const key = inputKeys[i];
            perturbedProps[key] = { ...perturbedProps[key], value: inputs[i] };
        }
        const testProduct = { ...product, properties: perturbedProps } as Product;
        return evaluator(testProduct)[targetFormulaId] || 0;
    };

    // Generate A and B matrices (N x D)
    const A: number[][] = [];
    const B: number[][] = [];
    for (let i = 0; i < N; i++) {
        const rowA = [];
        const rowB = [];
        for (let j = 0; j < D; j++) {
            rowA.push(randomNormal(inputMeans[j], inputStdDevs[j]));
            rowB.push(randomNormal(inputMeans[j], inputStdDevs[j]));
        }
        A.push(rowA);
        B.push(rowB);
    }

    // Evaluate yA and yB
    const yA = new Float64Array(N);
    const yB = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        yA[i] = evaluate(A[i]);
        yB[i] = evaluate(B[i]);
    }

    // Calculate Variance V(Y) from yA (and yB combined for better estimate)
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
        sum += yA[i] + yB[i];
        sumSq += yA[i]*yA[i] + yB[i]*yB[i];
    }
    const meanY = sum / (2 * N);
    const varY = sumSq / (2 * N) - meanY * meanY;

    if (varY === 0) {
        throw new Error("Variance of output is 0. Sensitivity indices cannot be calculated.");
    }

    const firstOrder = [];
    const totalEffect = [];
    const interactions = [];

    // For each variable
    for (let i = 0; i < D; i++) {
        const yABi = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            // A_B^(i): B's i-th column, A's other columns
            const rowAB = [...A[j]];
            rowAB[i] = B[j][i];
            yABi[j] = evaluate(rowAB);
        }

        // Jansen estimator
        let sumVti = 0;
        let sumVi = 0;
        for (let j = 0; j < N; j++) {
            const diffA = yA[j] - yABi[j];
            sumVti += diffA * diffA;

            const diffB = yB[j] - yABi[j];
            sumVi += diffB * diffB;
        }

        const vti = sumVti / (2 * N); // Total variance contribution
        const vi = varY - (sumVi / (2 * N)); // First order variance contribution

        const sTi = Math.max(0, vti / varY);
        let sI = Math.max(0, vi / varY);
        if (sI > sTi) sI = sTi; // Numeric precision guard

        firstOrder.push({ name: inputKeys[i], value: sI });
        totalEffect.push({ name: inputKeys[i], value: sTi });
        interactions.push({ name: inputKeys[i], value: sTi - sI });
    }

    // Sort by Total Effect descending
    const indices = Array.from({length: D}, (_, i) => i).sort((a, b) => totalEffect[b].value - totalEffect[a].value);

    self.postMessage({
      type: 'SOBOL_COMPLETE',
      payload: {
        firstOrder: indices.map(i => firstOrder[i]),
        totalEffect: indices.map(i => totalEffect[i]),
        interactions: indices.map(i => interactions[i])
      }
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
