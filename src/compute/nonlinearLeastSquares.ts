import { solveLeastSquares, type LeastSquaresDiagnostics } from './leastSquares';

export interface BoundedParameter {
  initial: number;
  min: number;
  max: number;
}

export type NonlinearTermination =
  | 'gradient-tolerance'
  | 'step-tolerance'
  | 'objective-tolerance'
  | 'maximum-iterations'
  | 'damping-limit';

export interface BoundedNonlinearLeastSquaresOptions {
  parameters: readonly BoundedParameter[];
  observationCount: number;
  evaluateResiduals(parameters: Float64Array, residuals: Float64Array): void;
  maxIterations?: number;
  initialDamping?: number;
  finiteDifferenceStep?: number;
  gradientTolerance?: number;
  stepTolerance?: number;
  objectiveTolerance?: number;
  maximumDamping?: number;
}

export interface BoundedNonlinearLeastSquaresResult {
  parameters: number[];
  residuals: Float64Array;
  objective: number;
  iterations: number;
  evaluations: number;
  converged: boolean;
  termination: NonlinearTermination;
  damping: number;
  gradientInfinityNorm: number;
  jacobianDiagnostics: LeastSquaresDiagnostics | null;
}

const TRANSFORM_MARGIN = 1e-10;

function logistic(value: number): number {
  if (value >= 0) {
    const exponential = Math.exp(-value);
    return 1 / (1 + exponential);
  }
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

function validateParameters(parameters: readonly BoundedParameter[]): void {
  if (parameters.length === 0) throw new RangeError('Nonlinear least squares requires parameters');
  for (const parameter of parameters) {
    if (!Number.isFinite(parameter.min) || !Number.isFinite(parameter.max) || parameter.min >= parameter.max) {
      throw new RangeError('Each nonlinear parameter must have finite bounds with min < max');
    }
    if (!Number.isFinite(parameter.initial)) throw new TypeError('Nonlinear parameter initial values must be finite');
    if (parameter.initial < parameter.min || parameter.initial > parameter.max) {
      throw new RangeError('Nonlinear parameter initial values must lie within their bounds');
    }
  }
}

function toUnconstrained(parameter: BoundedParameter): number {
  const rawFraction = (parameter.initial - parameter.min) / (parameter.max - parameter.min);
  const fraction = Math.max(TRANSFORM_MARGIN, Math.min(1 - TRANSFORM_MARGIN, rawFraction));
  return Math.log(fraction / (1 - fraction));
}

function toPhysical(
  unconstrained: Float64Array,
  definitions: readonly BoundedParameter[],
  output: Float64Array,
): void {
  for (let index = 0; index < unconstrained.length; index++) {
    const definition = definitions[index];
    output[index] = definition.min + logistic(unconstrained[index]) * (definition.max - definition.min);
  }
}

function residualObjective(residuals: Float64Array): number {
  let objective = 0;
  for (const residual of residuals) {
    if (!Number.isFinite(residual)) throw new Error('Nonlinear residual function produced a non-finite value');
    objective += residual * residual;
  }
  return objective;
}

function vectorNorm(values: Float64Array): number {
  let squared = 0;
  for (const value of values) squared += value * value;
  return Math.sqrt(squared);
}

export function solveBoundedNonlinearLeastSquares(
  options: BoundedNonlinearLeastSquaresOptions,
): BoundedNonlinearLeastSquaresResult {
  validateParameters(options.parameters);
  const observationCount = options.observationCount;
  const parameterCount = options.parameters.length;
  if (!Number.isInteger(observationCount) || observationCount < parameterCount + 1) {
    throw new RangeError('Nonlinear least squares requires at least parameterCount + 1 observations');
  }

  const maxIterations = options.maxIterations ?? 100;
  const finiteDifferenceStep = options.finiteDifferenceStep ?? 1e-4;
  const gradientTolerance = options.gradientTolerance ?? 1e-8;
  const stepTolerance = options.stepTolerance ?? 1e-8;
  const objectiveTolerance = options.objectiveTolerance ?? 1e-10;
  const maximumDamping = options.maximumDamping ?? 1e12;
  let damping = options.initialDamping ?? 1e-2;
  for (const [value, name] of [
    [maxIterations, 'maxIterations'],
    [finiteDifferenceStep, 'finiteDifferenceStep'],
    [gradientTolerance, 'gradientTolerance'],
    [stepTolerance, 'stepTolerance'],
    [objectiveTolerance, 'objectiveTolerance'],
    [maximumDamping, 'maximumDamping'],
    [damping, 'initialDamping'],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
  }
  if (!Number.isInteger(maxIterations)) throw new RangeError('maxIterations must be an integer');

  const unconstrained = Float64Array.from(options.parameters, toUnconstrained);
  const physical = new Float64Array(parameterCount);
  const residuals = new Float64Array(observationCount);
  let evaluations = 0;

  const evaluate = (position: Float64Array, output: Float64Array): number => {
    toPhysical(position, options.parameters, physical);
    options.evaluateResiduals(physical, output);
    evaluations += 1;
    return residualObjective(output);
  };

  let objective = evaluate(unconstrained, residuals);
  let iterations = 0;
  let converged = false;
  let termination: NonlinearTermination = 'maximum-iterations';
  let gradientInfinityNorm = Infinity;
  let latestJacobian: number[][] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    iterations = iteration + 1;
    const jacobian = Array.from({ length: observationCount }, () => new Array<number>(parameterCount).fill(0));
    const plusResiduals = new Float64Array(observationCount);
    const minusResiduals = new Float64Array(observationCount);

    for (let parameter = 0; parameter < parameterCount; parameter++) {
      const step = finiteDifferenceStep * (1 + Math.abs(unconstrained[parameter]));
      const plus = new Float64Array(unconstrained);
      const minus = new Float64Array(unconstrained);
      plus[parameter] += step;
      minus[parameter] -= step;
      evaluate(plus, plusResiduals);
      evaluate(minus, minusResiduals);
      const inverseSpan = 1 / (2 * step);
      for (let observation = 0; observation < observationCount; observation++) {
        jacobian[observation][parameter] = (
          plusResiduals[observation] - minusResiduals[observation]
        ) * inverseSpan;
      }
    }
    latestJacobian = jacobian;

    const gradient = new Float64Array(parameterCount);
    const columnNorms = new Float64Array(parameterCount);
    gradientInfinityNorm = 0;
    for (let parameter = 0; parameter < parameterCount; parameter++) {
      let gradientValue = 0;
      let squaredNorm = 0;
      for (let observation = 0; observation < observationCount; observation++) {
        const derivative = jacobian[observation][parameter];
        gradientValue += derivative * residuals[observation];
        squaredNorm += derivative * derivative;
      }
      gradient[parameter] = gradientValue;
      columnNorms[parameter] = Math.sqrt(squaredNorm);
      gradientInfinityNorm = Math.max(gradientInfinityNorm, Math.abs(gradientValue));
    }
    if (gradientInfinityNorm <= gradientTolerance) {
      converged = true;
      termination = 'gradient-tolerance';
      break;
    }

    const design = jacobian.map((row) => [...row]);
    const target = Array.from(residuals, (residual) => -residual);
    const dampingRoot = Math.sqrt(damping);
    for (let parameter = 0; parameter < parameterCount; parameter++) {
      const row = new Array<number>(parameterCount).fill(0);
      row[parameter] = dampingRoot * Math.max(columnNorms[parameter], 1e-8);
      design.push(row);
      target.push(0);
    }

    let stepValues: number[];
    try {
      stepValues = solveLeastSquares(design, target, { conditionLimit: 1e12 }).solution;
    } catch {
      damping *= 10;
      if (damping > maximumDamping) {
        termination = 'damping-limit';
        break;
      }
      continue;
    }

    const stepVector = Float64Array.from(stepValues);
    const candidate = new Float64Array(parameterCount);
    for (let parameter = 0; parameter < parameterCount; parameter++) {
      candidate[parameter] = unconstrained[parameter] + stepVector[parameter];
    }
    const candidateResiduals = new Float64Array(observationCount);
    const candidateObjective = evaluate(candidate, candidateResiduals);

    if (candidateObjective < objective) {
      const previousObjective = objective;
      unconstrained.set(candidate);
      residuals.set(candidateResiduals);
      objective = candidateObjective;
      damping = Math.max(1e-12, damping * 0.3);
      const stepSmall = vectorNorm(stepVector) <= stepTolerance * (1 + vectorNorm(unconstrained));
      const objectiveSmall = previousObjective - objective <= objectiveTolerance * (1 + previousObjective);
      if (stepSmall || objectiveSmall) {
        converged = true;
        termination = stepSmall ? 'step-tolerance' : 'objective-tolerance';
        break;
      }
    } else {
      damping *= 10;
      if (damping > maximumDamping) {
        termination = 'damping-limit';
        break;
      }
    }
  }

  toPhysical(unconstrained, options.parameters, physical);
  let jacobianDiagnostics: LeastSquaresDiagnostics | null = null;
  if (latestJacobian.length === observationCount) {
    try {
      jacobianDiagnostics = solveLeastSquares(
        latestJacobian,
        new Array<number>(observationCount).fill(0),
        { conditionLimit: 1e12 },
      ).diagnostics;
    } catch {
      jacobianDiagnostics = null;
    }
  }

  return {
    parameters: Array.from(physical),
    residuals: new Float64Array(residuals),
    objective,
    iterations,
    evaluations,
    converged,
    termination,
    damping,
    gradientInfinityNorm,
    jacobianDiagnostics,
  };
}
