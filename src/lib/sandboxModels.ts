/** Local teaching models. Invalid domains and unrepresentable results are explicit. */
const finite = (...values: number[]) => values.every(Number.isFinite);
function positiveExp(exponent: number): number | null {
  if (!Number.isFinite(exponent)) return null;
  const value = Math.exp(exponent);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function sandboxCarreau(eta0: number, lambda: number, shearRate: number, n: number): number | null {
  if (!finite(eta0, lambda, shearRate, n) || eta0 <= 0 || lambda < 0 || shearRate < 0 || n < 0 || n > 1) return null;
  if (lambda === 0 || shearRate === 0 || n === 1) return eta0;
  const logProduct = Math.log(lambda) + Math.log(shearRate);
  // log(1 + x²) without overflowing the intermediate product or square.
  const logShape = logProduct > 0
    ? 2 * logProduct + Math.log1p(Math.exp(-2 * logProduct))
    : Math.log1p(Math.exp(2 * logProduct));
  return positiveExp(Math.log(eta0) + ((n - 1) / 2) * logShape);
}

export function sandboxWlf(temperature: number, reference: number, c1: number, c2: number): number | null {
  if (!finite(temperature, reference, c1, c2) || c1 < 0 || c2 <= 0) return null;
  const delta = temperature - reference;
  const denominator = c2 + delta;
  if (!finite(delta, denominator) || denominator === 0) return null;
  const exponent = -c1 * (delta / denominator) * Math.LN10;
  return positiveExp(exponent);
}

export function sandboxWeibull(time: number, scale: number, shape: number): number | null {
  if (!finite(time, scale, shape) || time < 0 || scale <= 0 || shape <= 0) return null;
  if (time === 0) return 100;
  const logPower = shape * (Math.log(time) - Math.log(scale));
  const power = Math.exp(logPower);
  if (!Number.isFinite(power) || (power === 0 && time !== 0)) return null;
  const survival = positiveExp(-power);
  return survival === null ? null : survival * 100;
}
