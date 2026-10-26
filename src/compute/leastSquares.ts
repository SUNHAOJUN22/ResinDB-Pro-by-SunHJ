export type LeastSquaresSolver = 'qr-householder' | 'svd-jacobi-pseudoinverse';

export interface LeastSquaresOptions {
  conditionLimit?: number;
  toleranceMultiplier?: number;
}

export interface LeastSquaresDiagnostics {
  solver: LeastSquaresSolver;
  rows: number;
  columns: number;
  rank: number;
  conditionNumber: number | null;
  conditionNumberStatus: 'finite' | 'infinite';
  residualNorm: number;
  tolerance: number;
  singularValues: number[];
}

export interface LeastSquaresResult {
  solution: number[];
  diagnostics: LeastSquaresDiagnostics;
}

interface JacobiSvdResult {
  singularValues: number[];
  leftVectors: number[][];
  rightVectors: number[][];
  converged: boolean;
}

function validateSystem(design: readonly (readonly number[])[], target: readonly number[]): { rows: number; columns: number } {
  const rows = design.length;
  if (rows === 0) throw new RangeError('Least-squares design matrix must contain rows');
  const columns = design[0]?.length ?? 0;
  if (columns === 0) throw new RangeError('Least-squares design matrix must contain columns');
  if (target.length !== rows) throw new RangeError('Least-squares target length must match design rows');
  for (let row = 0; row < rows; row++) {
    if (design[row].length !== columns) throw new RangeError('Least-squares design matrix must be rectangular');
    for (const value of design[row]) {
      if (!Number.isFinite(value)) throw new TypeError('Least-squares design matrix must contain finite numbers');
    }
    if (!Number.isFinite(target[row])) throw new TypeError('Least-squares target must contain finite numbers');
  }
  return { rows, columns };
}

function identity(size: number): number[][] {
  return Array.from({ length: size }, (_, row) => (
    Array.from({ length: size }, (_, column) => row === column ? 1 : 0)
  ));
}

function oneSidedJacobiSvd(matrix: readonly (readonly number[])[]): JacobiSvdResult {
  const rows = matrix.length;
  const columns = matrix[0].length;
  const working = matrix.map((row) => [...row]);
  const rightVectors = identity(columns);
  const maximumSweeps = Math.max(20, columns * columns * 12);
  const pairTolerance = Number.EPSILON * Math.max(rows, columns) * 16;
  let converged = false;

  for (let sweep = 0; sweep < maximumSweeps; sweep++) {
    let changed = false;
    for (let left = 0; left < columns - 1; left++) {
      for (let right = left + 1; right < columns; right++) {
        let leftNormSquared = 0;
        let rightNormSquared = 0;
        let cross = 0;
        for (let row = 0; row < rows; row++) {
          const leftValue = working[row][left];
          const rightValue = working[row][right];
          leftNormSquared += leftValue * leftValue;
          rightNormSquared += rightValue * rightValue;
          cross += leftValue * rightValue;
        }
        if (leftNormSquared === 0 || rightNormSquared === 0) continue;
        if (Math.abs(cross) <= pairTolerance * Math.sqrt(leftNormSquared * rightNormSquared)) continue;

        const zeta = (rightNormSquared - leftNormSquared) / (2 * cross);
        const tangent = zeta === 0
          ? 1
          : Math.sign(zeta) / (Math.abs(zeta) + Math.hypot(1, zeta));
        const cosine = 1 / Math.sqrt(1 + tangent * tangent);
        const sine = cosine * tangent;

        for (let row = 0; row < rows; row++) {
          const leftValue = working[row][left];
          const rightValue = working[row][right];
          working[row][left] = cosine * leftValue - sine * rightValue;
          working[row][right] = sine * leftValue + cosine * rightValue;
        }
        for (let row = 0; row < columns; row++) {
          const leftValue = rightVectors[row][left];
          const rightValue = rightVectors[row][right];
          rightVectors[row][left] = cosine * leftValue - sine * rightValue;
          rightVectors[row][right] = sine * leftValue + cosine * rightValue;
        }
        changed = true;
      }
    }
    if (!changed) {
      converged = true;
      break;
    }
  }

  const components = Array.from({ length: columns }, (_, column) => {
    let normSquared = 0;
    for (let row = 0; row < rows; row++) normSquared += working[row][column] ** 2;
    return { column, singularValue: Math.sqrt(normSquared) };
  }).sort((left, right) => right.singularValue - left.singularValue);

  const singularValues = components.map((component) => component.singularValue);
  const sortedRightVectors = Array.from({ length: columns }, () => new Array<number>(columns).fill(0));
  const leftVectors = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));

  components.forEach((component, sortedColumn) => {
    for (let row = 0; row < columns; row++) {
      sortedRightVectors[row][sortedColumn] = rightVectors[row][component.column];
    }
    if (component.singularValue > 0) {
      for (let row = 0; row < rows; row++) {
        leftVectors[row][sortedColumn] = working[row][component.column] / component.singularValue;
      }
    }
  });

  return { singularValues, leftVectors, rightVectors: sortedRightVectors, converged };
}

function householderQrSolve(matrix: readonly (readonly number[])[], target: readonly number[], tolerance: number): number[] {
  const rows = matrix.length;
  const columns = matrix[0].length;
  const upper = matrix.map((row) => [...row]);
  const transformedTarget = [...target];

  for (let column = 0; column < columns; column++) {
    let normSquared = 0;
    for (let row = column; row < rows; row++) normSquared += upper[row][column] ** 2;
    const norm = Math.sqrt(normSquared);
    if (norm <= tolerance) throw new Error('QR factorization detected rank deficiency');
    const reflector = new Array<number>(rows - column);
    for (let row = column; row < rows; row++) reflector[row - column] = upper[row][column];
    reflector[0] += reflector[0] >= 0 ? norm : -norm;
    let reflectorNormSquared = 0;
    for (const value of reflector) reflectorNormSquared += value * value;
    if (reflectorNormSquared <= tolerance * tolerance) throw new Error('QR reflector is numerically singular');

    for (let targetColumn = column; targetColumn < columns; targetColumn++) {
      let projection = 0;
      for (let row = column; row < rows; row++) {
        projection += reflector[row - column] * upper[row][targetColumn];
      }
      const factor = 2 * projection / reflectorNormSquared;
      for (let row = column; row < rows; row++) {
        upper[row][targetColumn] -= factor * reflector[row - column];
      }
    }

    let targetProjection = 0;
    for (let row = column; row < rows; row++) {
      targetProjection += reflector[row - column] * transformedTarget[row];
    }
    const targetFactor = 2 * targetProjection / reflectorNormSquared;
    for (let row = column; row < rows; row++) {
      transformedTarget[row] -= targetFactor * reflector[row - column];
    }
  }

  const solution = new Array<number>(columns).fill(0);
  for (let row = columns - 1; row >= 0; row--) {
    let value = transformedTarget[row];
    for (let column = row + 1; column < columns; column++) value -= upper[row][column] * solution[column];
    const diagonal = upper[row][row];
    if (Math.abs(diagonal) <= tolerance) throw new Error('QR back-substitution detected rank deficiency');
    solution[row] = value / diagonal;
  }
  return solution;
}

function svdPseudoInverseSolve(svd: JacobiSvdResult, target: readonly number[], tolerance: number): number[] {
  const columns = svd.singularValues.length;
  const solution = new Array<number>(columns).fill(0);
  for (let component = 0; component < columns; component++) {
    const singularValue = svd.singularValues[component];
    if (singularValue <= tolerance) continue;
    let projection = 0;
    for (let row = 0; row < target.length; row++) {
      projection += svd.leftVectors[row][component] * target[row];
    }
    const coefficient = projection / singularValue;
    for (let row = 0; row < columns; row++) {
      solution[row] += svd.rightVectors[row][component] * coefficient;
    }
  }
  return solution;
}

function rescaleCoefficient(value: number, numerator: number, denominator: number): number {
  const ratio = numerator / denominator;
  const coefficient = Number.isFinite(ratio) && ratio !== 0
    ? value * ratio
    : (value * numerator) / denominator;
  if (!Number.isFinite(coefficient)) {
    throw new RangeError('Least-squares coefficient exceeds the finite floating-point range');
  }
  return coefficient;
}

interface ScaledCoefficient {
  fraction: number;
  exponent: number;
}

function scaledCoefficient(value: number, exponent = 0): ScaledCoefficient {
  if (value === 0) return { fraction: 0, exponent: 0 };
  const shift = Math.min(1023, Math.floor(Math.log2(Math.abs(value))));
  return { fraction: value / 2 ** shift, exponent: exponent + shift };
}

function multiplyScaled(value: ScaledCoefficient, factor: number, divide = false): ScaledCoefficient {
  const scaledFactor = scaledCoefficient(factor);
  return scaledCoefficient(
    divide ? value.fraction / scaledFactor.fraction : value.fraction * scaledFactor.fraction,
    divide ? value.exponent - scaledFactor.exponent : value.exponent + scaledFactor.exponent,
  );
}

function addScaled(left: ScaledCoefficient, right: ScaledCoefficient): ScaledCoefficient {
  if (left.fraction === 0) return right;
  if (right.fraction === 0) return left;
  const exponent = Math.max(left.exponent, right.exponent);
  return scaledCoefficient(
    left.fraction * 2 ** (left.exponent - exponent) + right.fraction * 2 ** (right.exponent - exponent),
    exponent,
  );
}

function finiteCoefficient(value: ScaledCoefficient): number {
  // Keep the orthogonal coordinates scaled until they have been rotated back:
  // ||x|| may overflow even though every final x_j is representable. Splitting
  // the last power also avoids overflowing/underflowing a standalone 2^exponent.
  const boundedExponent = Math.max(-1022, Math.min(1023, value.exponent));
  const result = (value.fraction * 2 ** (value.exponent - boundedExponent)) * 2 ** boundedExponent;
  if (!Number.isFinite(result)) {
    throw new RangeError('Least-squares coefficient exceeds the finite floating-point range');
  }
  return result;
}

function svdMinimumNormSolve(
  svd: JacobiSvdResult,
  target: readonly number[],
  columnScales: readonly number[],
  targetScale: number,
  rank: number,
): number[] {
  const columns = columnScales.length;
  const constraints: number[][] = [];
  const rightHandSide: ScaledCoefficient[] = [];
  // A D^-1 = U S V^T. All residual-minimizing x satisfy
  // V_r^T D x = S_r^-1 U_r^T b. Minimizing ||D x|| instead of
  // ||x|| would silently change the pseudoinverse's coefficient metric.
  for (let component = 0; component < rank; component++) {
    const constraint = columnScales.map((scale, column) => svd.rightVectors[column][component] * scale);
    const rowScale = constraint.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
    if (!Number.isFinite(rowScale) || rowScale === 0) {
      throw new RangeError('Minimum-norm constraint exceeds the finite floating-point range');
    }
    constraints.push(constraint.map((value) => value / rowScale));
    let projection = 0;
    for (let row = 0; row < target.length; row++) {
      projection += svd.leftVectors[row][component] * target[row];
    }
    rightHandSide.push(multiplyScaled(
      multiplyScaled(scaledCoefficient(projection / svd.singularValues[component]), targetScale),
      rowScale,
      true,
    ));
  }

  // Right Givens rotations form C G = [L, 0]. Row scaling above leaves the
  // constraint set unchanged. G is orthogonal in the original coordinates,
  // so x = G [L^-1 c, 0] has minimum Euclidean norm. No normal equations or
  // subtraction of a potentially enormous null-space component are used.
  const rotations: { left: number; right: number; cosine: number; sine: number }[] = [];
  for (let left = 0; left < rank; left++) {
    for (let right = columns - 1; right > left; right--) {
      const a = constraints[left][left];
      const b = constraints[left][right];
      if (b === 0) continue;
      const norm = Math.hypot(a, b);
      const cosine = a / norm;
      const sine = b / norm;
      for (let row = left; row < rank; row++) {
        const leftValue = constraints[row][left];
        const rightValue = constraints[row][right];
        constraints[row][left] = cosine * leftValue + sine * rightValue;
        constraints[row][right] = -sine * leftValue + cosine * rightValue;
      }
      constraints[left][left] = norm;
      constraints[left][right] = 0;
      rotations.push({ left, right, cosine, sine });
    }
  }

  const solution = Array.from({ length: columns }, () => scaledCoefficient(0));
  for (let row = 0; row < rank; row++) {
    let value = rightHandSide[row];
    for (let column = 0; column < row; column++) {
      value = addScaled(value, multiplyScaled(solution[column], -constraints[row][column]));
    }
    const diagonal = constraints[row][row];
    if (!Number.isFinite(diagonal) || diagonal === 0) {
      throw new Error('Minimum-norm factorization cannot resolve the retained rank');
    }
    solution[row] = multiplyScaled(value, diagonal, true);
  }
  for (let index = rotations.length - 1; index >= 0; index--) {
    const { left, right, cosine, sine } = rotations[index];
    const leftValue = solution[left];
    const rightValue = solution[right];
    solution[left] = addScaled(multiplyScaled(leftValue, cosine), multiplyScaled(rightValue, -sine));
    solution[right] = addScaled(multiplyScaled(leftValue, sine), multiplyScaled(rightValue, cosine));
  }
  return solution.map(finiteCoefficient);
}

function residualNorm(design: readonly (readonly number[])[], target: readonly number[], solution: readonly number[]): number {
  let norm = 0;
  for (let row = 0; row < design.length; row++) {
    let predicted = 0;
    for (let column = 0; column < solution.length; column++) predicted += design[row][column] * solution[column];
    norm = Math.hypot(norm, predicted - target[row]);
  }
  if (!Number.isFinite(norm)) throw new RangeError('Least-squares residual exceeds the finite floating-point range');
  return norm;
}

export function solveLeastSquares(
  design: readonly (readonly number[])[],
  target: readonly number[],
  options: LeastSquaresOptions = {},
): LeastSquaresResult {
  const { rows, columns } = validateSystem(design, target);
  const conditionLimit = options.conditionLimit ?? 1e10;
  const toleranceMultiplier = options.toleranceMultiplier ?? 64;
  if (!Number.isFinite(conditionLimit) || conditionLimit <= 1) {
    throw new RangeError('conditionLimit must be finite and greater than one');
  }
  if (!Number.isFinite(toleranceMultiplier) || toleranceMultiplier <= 0) {
    throw new RangeError('toleranceMultiplier must be positive and finite');
  }

  const columnScales = Array.from({ length: columns }, (_, column) => {
    let norm = 0;
    let maximum = 0;
    for (let row = 0; row < rows; row++) {
      norm = Math.hypot(norm, design[row][column]);
      maximum = Math.max(maximum, Math.abs(design[row][column]));
    }
    // A finite column can have an unrepresentable Euclidean norm. Its maximum
    // magnitude is still a valid nonzero preconditioner; never divide by Infinity.
    return (Number.isFinite(norm) ? norm : maximum) || 1;
  });
  const scaledDesign = design.map((row) => row.map((value, column) => value / columnScales[column]));
  const svd = oneSidedJacobiSvd(scaledDesign);
  if (!svd.converged) throw new Error('Jacobi SVD failed to converge');
  const maximumSingularValue = svd.singularValues[0] ?? 0;
  const tolerance = maximumSingularValue * Number.EPSILON * Math.max(rows, columns) * toleranceMultiplier;
  const rank = svd.singularValues.filter((value) => value > tolerance).length;
  if (rank === 0) throw new Error('Least-squares design matrix has zero numerical rank');
  const minimumResolvedSingularValue = svd.singularValues[rank - 1];
  const finiteConditionNumber = maximumSingularValue / minimumResolvedSingularValue;
  const conditionNumber = rank < columns ? null : finiteConditionNumber;
  const conditionNumberStatus = rank < columns ? 'infinite' : 'finite';

  // Normalize the right-hand side too: orthogonal projections can overflow
  // even when the final coefficients and all supplied values are finite.
  const targetScale = target.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0) || 1;
  const scaledTarget = target.map((value) => {
    const scaledValue = value / targetScale;
    if (value !== 0 && scaledValue === 0) {
      throw new RangeError('Least-squares target normalization would discard a nonzero observation');
    }
    return scaledValue;
  });
  let solver: LeastSquaresSolver;
  let solution: number[];
  if (rank < columns) {
    solver = 'svd-jacobi-pseudoinverse';
    solution = svdMinimumNormSolve(svd, scaledTarget, columnScales, targetScale, rank);
  } else if (rows >= columns && finiteConditionNumber <= conditionLimit) {
    solver = 'qr-householder';
    solution = householderQrSolve(scaledDesign, scaledTarget, tolerance)
      .map((value, column) => rescaleCoefficient(value, targetScale, columnScales[column]));
  } else {
    solver = 'svd-jacobi-pseudoinverse';
    solution = svdPseudoInverseSolve(svd, scaledTarget, tolerance)
      .map((value, column) => rescaleCoefficient(value, targetScale, columnScales[column]));
  }

  return {
    solution,
    diagnostics: {
      solver,
      rows,
      columns,
      rank,
      conditionNumber,
      conditionNumberStatus,
      residualNorm: residualNorm(design, target, solution),
      tolerance,
      singularValues: [...svd.singularValues],
    },
  };
}
