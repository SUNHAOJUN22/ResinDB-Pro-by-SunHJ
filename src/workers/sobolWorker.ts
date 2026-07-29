import { createWorkerProgressMessage } from '@/compute/workerProtocol';
import { FormulaConfig, Product, PropertyValue } from '@/types/index';
import { formulaEngine } from '@/lib/formulaParser';

export interface SobolMessage {
  type: 'RUN_SOBOL';
  payload: {
    targetFormulaId: string;
    formulas: FormulaConfig[];
    product: Product;
    variances: Record<string, number>;
    iterations?: number;
  };
}

export interface SobolResponse {
  type: 'SOBOL_COMPLETE' | 'ERROR';
  payload?: {
    firstOrder: { name: string; value: number }[];
    totalEffect: { name: string; value: number }[];
    interactions: { name: string; value: number }[];
  };
  error?: string;
}

function randomNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  const num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
  return num * stdDev + mean;
}

self.onmessage = (e: MessageEvent<SobolMessage>) => {
  try {
    const { targetFormulaId, formulas, product, variances, iterations = 2000 } = e.data.payload;

    const evaluator = formulaEngine.compileGraph(formulas);
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
    const progressInterval = Math.max(1, Math.floor(N / 20));
    self.postMessage(createWorkerProgressMessage({ ratio: 0, phase: 'sampling' }));

    const evaluate = (inputs: number[]): number => {
        const perturbedProps: Record<string, PropertyValue> = { ...baseProperties };
        for (let i = 0; i < D; i++) {
            const key = inputKeys[i];
            perturbedProps[key] = { ...perturbedProps[key], value: inputs[i] };
        }
        const testProduct = { ...product, properties: perturbedProps } as Product;
        return evaluator(testProduct)[targetFormulaId] || 0;
    };

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
        const completed = i + 1;
        if (completed % progressInterval === 0 || completed === N) {
          self.postMessage(createWorkerProgressMessage({
            ratio: (completed / N) * 0.15,
            completed,
            total: N,
            phase: 'sampling',
          }));
        }
    }

    const yA = new Float64Array(N);
    const yB = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        yA[i] = evaluate(A[i]);
        yB[i] = evaluate(B[i]);
        const completed = i + 1;
        if (completed % progressInterval === 0 || completed === N) {
          self.postMessage(createWorkerProgressMessage({
            ratio: 0.15 + (completed / N) * 0.3,
            completed,
            total: N,
            phase: 'base-evaluation',
          }));
        }
    }

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

    const firstOrder: {name: string, value: number}[] = [];
    const totalEffect: {name: string, value: number}[] = [];
    const interactions: {name: string, value: number}[] = [];

    for (let i = 0; i < D; i++) {
        const yABi = new Float64Array(N);
        for (let j = 0; j < N; j++) {
            const rowAB = [...A[j]];
            rowAB[i] = B[j][i];
            yABi[j] = evaluate(rowAB);
        }

        let sumVti = 0;
        let sumVi = 0;
        for (let j = 0; j < N; j++) {
            const diffA = yA[j] - yABi[j];
            sumVti += diffA * diffA;

            const diffB = yB[j] - yABi[j];
            sumVi += diffB * diffB;
        }

        const vti = sumVti / (2 * N);
        const vi = varY - (sumVi / (2 * N));

        const safeVarY = Math.abs(varY) > 1e-15 ? varY : 1e-15;
        const sTi = Math.max(0, vti / safeVarY);
        let sI = Math.max(0, vi / safeVarY);
        if (sI > sTi) sI = sTi;

        firstOrder.push({ name: inputKeys[i], value: sI });
        totalEffect.push({ name: inputKeys[i], value: sTi });
        interactions.push({ name: inputKeys[i], value: sTi - sI });
        self.postMessage(createWorkerProgressMessage({
          ratio: 0.45 + ((i + 1) / D) * 0.5,
          completed: i + 1,
          total: D,
          phase: 'sensitivity-estimation',
        }));
    }

    const indices = Array.from({length: D}, (_, i) => i).sort((a, b) => totalEffect[b].value - totalEffect[a].value);
    self.postMessage(createWorkerProgressMessage({ ratio: 1, phase: 'complete' }));

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
