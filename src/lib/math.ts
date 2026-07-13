/**
 * Statistical utility functions for data analysis.
 */


/**
 * Calculates mean, standard deviation, min, max, and count for a set of numbers.
 */
export const calculateStats = (data: number[]) => {
  if (!data || data.length === 0)
    return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };

  const count = data.length;
  const safeCount = count > 0 ? count : 1;
  const mean = data.reduce((sum, val) => sum + val, 0) / safeCount;
  const squareDiffs = data.map((value) => {
    const diff = value - mean;
    return diff * diff;
  });
  const stdDev = Math.sqrt(
    Math.max(0, squareDiffs.reduce((sum, val) => sum + val, 0) / safeCount),
  );
  let min = data[0];
  let max = data[0];
  for (let i = 1; i < data.length; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  return { mean, stdDev, min, max, count };
};

/**
 * Calculates 95% confidence interval based on standard deviation and count.
 */
export const getConfidenceInterval95 = (
  mean: number,
  stdDev: number,
  count: number,
) => {
  if (count <= 1) return { lower: mean, upper: mean };
  const z = 1.96;
  const safeSqrt = Math.sqrt(Math.max(1, count));
  const marginOfError = z * (stdDev / safeSqrt);
  return { lower: mean - marginOfError, upper: mean + marginOfError };
};
