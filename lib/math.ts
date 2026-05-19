/**
 * Statistical utility functions for data analysis.
 */

// Basic Linear Regression with safety checks
export const linearRegression = (data: { x: number; y: number }[]) => {
  const n = data.length;
  if (n < 2) return { fn: (_x: number) => 0, slope: 0, intercept: 0 };
  
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const { x, y } of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  
  const denom = (n * sumXX - sumX * sumX);
  if (denom === 0) return { fn: (_x: number) => data[0].y, slope: 0, intercept: data[0].y };
  
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { fn: (x: number) => slope * x + intercept, slope, intercept };
};

/**
 * Calculates mean, standard deviation, min, max, and count for a set of numbers.
 */
export const calculateStats = (data: number[]) => {
  if (!data || data.length === 0)
    return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };

  const count = data.length;
  const mean = data.reduce((sum, val) => sum + val, 0) / count;
  const squareDiffs = data.map((value) => {
    const diff = value - mean;
    return diff * diff;
  });
  const stdDev = Math.sqrt(
    squareDiffs.reduce((sum, val) => sum + val, 0) / count,
  );
  const min = Math.min(...data);
  const max = Math.max(...data);

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
  const marginOfError = z * (stdDev / Math.sqrt(count));
  return { lower: mean - marginOfError, upper: mean + marginOfError };
};
