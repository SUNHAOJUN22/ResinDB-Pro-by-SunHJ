/**
 * Material Scientific Engine
 * Handles normalization, correlation analysis, and expert insight generation
 * specifically for polymer and chemical database analysis.
 */

export interface CorrelationResult {
  propertyX: string;
  propertyY: string;
  r2: number;
  slope: number;
  intercept: number;
  trend: 'positive' | 'negative' | 'none';
}

export interface Insight {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success';
}

export const materialEngine = {
  /**
   * Percentile-based Normalization
   * Maps a value to its rank in the current dataset (0-100)
   * This is the BEST way to show relative strengths regardless of units.
   */
  normalizePercentile: (val: number, dataArray: number[]): number => {
    if (dataArray.length < 2) return 50;
    const sorted = [...dataArray].sort((a, b) => a - b);
    const count = sorted.filter(v => v < val).length;
    // Stretch the distribution to use the full 20-100 range for visual clarity
    const percentile = (count / (sorted.length - 1)) * 80 + 20;
    return Math.max(5, Math.min(100, isNaN(percentile) ? 50 : percentile));
  },

  /**
   * Calculates smart axis bounds with 10% padding
   */
  calculateBounds: (dataArray: number[], isLog: boolean = false) => {
    const valid = dataArray.filter(v => v > 0 && !isNaN(v) && isFinite(v));
    if (valid.length === 0) return { min: isLog ? 0.1 : 0, max: 100 };
    
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    
    if (min === max) {
      if (isLog) return { min: min * 0.1, max: min * 10 };
      return { min: min * 0.9, max: max * 1.1 };
    }

    const margin = (max - min) * 0.15;
    
    if (isLog) {
      const logMin = Math.log10(min);
      const logMax = Math.log10(max);
      const logMargin = (logMax - logMin) * 0.15;
      return { 
        min: Math.pow(10, logMin - logMargin), 
        max: Math.pow(10, logMax + logMargin) 
      };
    }
    return { 
      min: Math.max(0, min - margin), 
      max: max + margin 
    };
  },

  /**
   * Simple Linear Regression for Trend Detection
   */
  analyzeCorrelation: (points: [number, number][]): CorrelationResult | null => {
    if (points.length < 2) return null;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    const n = points.length;

    for (const [x, y] of points) {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return null;
    
    const r = numerator / denominator;
    const r2 = r * r;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      propertyX: '',
      propertyY: '',
      r2,
      slope,
      intercept,
      trend: r > 0.3 ? 'positive' : r < -0.3 ? 'negative' : 'none'
    };
  },

  /**
   * Performs Linear Regression in Log-Log space for Ashby Plots
   * Fits y = C * x^k (Power Law Relationship)
   */
  analyzeCorrelationLog: (points: [number, number][]) => {
    const logPoints = points
      .filter(([x, y]) => x > 0 && y > 0)
      .map(([x, y]) => [Math.log10(x), Math.log10(y)] as [number, number]);
    
    if (logPoints.length < 2) return null;
    const linearModel = materialEngine.analyzeCorrelation(logPoints);
    if (!linearModel) return null;

    return {
      r2: linearModel.r2,
      k: linearModel.slope, // Power exponent
      c: Math.pow(10, linearModel.intercept), // Pre-exponential factor
      regressionFn: (x: number) => Math.pow(10, linearModel.intercept) * Math.pow(x, linearModel.slope)
    };
  },

  /**
   * Calculates the Pearson Correlation Coefficient (r)
   */
  calculatePearson: (points: [number, number][]): number => {
    if (points.length < 2) return 0;
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const [x, y] of points) {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den === 0 ? 0 : num / den;
  },

  /**
   * Calculates Polymer Molecular Weight Moments (Mn, Mw, Mz, PDI)
   * Essential for GPC analysis
   */
  calculateMWDMoments: (mwd: { x: number; y: number }[]) => {
    if (mwd.length < 2) return null;
    let sumNi = 0;
    let sumNiMi = 0;
    let sumNiMi2 = 0;
    let sumNiMi3 = 0;

    for (const p of mwd) {
      if (p.x <= 0 || p.y <= 0) continue;
      const ni = p.y; // Signal intensity counts as relative abundance
      const mi = p.x; // Molecular Weight
      sumNi += ni;
      sumNiMi += ni * mi;
      sumNiMi2 += ni * Math.pow(mi, 2);
      sumNiMi3 += ni * Math.pow(mi, 3);
    }

    if (sumNi === 0 || sumNiMi === 0) return null;

    const mn = sumNiMi / sumNi;
    const mw = sumNiMi2 / sumNiMi;
    const mz = sumNiMi3 / sumNiMi2;
    const pdi = mw / mn;

    return { mn, mw, mz, pdi };
  },

  /**
   * Calculates the Power Law Index (n) and Consistency Index (K)
   * for Non-Newtonian Fluid Rheology (Shear Thinning Behavior)
   */
  calculatePowerLawIndex: (points: { rate: number; stress: number }[]) => {
    const logPoints = points
      .filter(p => p.rate > 0 && p.stress > 0)
      .map(p => ({ x: Math.log10(p.rate), y: Math.log10(p.stress) }));
    
    if (logPoints.length < 2) return null;
    // Regression on log-log data
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const p of logPoints) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return {
      n: slope, // Flow behavior index
      k: Math.pow(10, intercept), // Consistency index
      isShearThinning: slope < 1
    };
  },

  /**
   * Robust Correlation Analysis
   * Compares Pearson (linear) vs Spearman (monotonic)
   * Better for non-linear but monotonic relationships
   */
  calculateSpearman: (points: [number, number][]): number => {
    if (points.length < 2) return 0;
    const n = points.length;
    
    // Helper to get ranks
    const getRanks = (vals: number[]) => {
      const sorted = vals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      const ranks = new Array(n);
      for (let i = 0; i < n; i++) {
        ranks[sorted[i].i] = i + 1;
      }
      return ranks;
    };

    const xRanks = getRanks(points.map(p => p[0]));
    const yRanks = getRanks(points.map(p => p[1]));

    let dSqSum = 0;
    for (let i = 0; i < n; i++) {
      dSqSum += Math.pow(xRanks[i] - yRanks[i], 2);
    }

    return 1 - (6 * dSqSum) / (n * (Math.pow(n, 2) - 1));
  },

  /**
   * Estimating Zero-Shear Viscosity (eta0) using Cross Model approximation
   * 聚合物熔体零剪切粘度推算
   */
  estimateZeroShearViscosity: (points: { rate: number; viscosity: number }[]) => {
    if (points.length < 3) return null;
    // Simple heuristic: average of the 3 lowest shear rate points if they are in the plateau
    const sorted = [...points].sort((a, b) => a.rate - b.rate);
    const lowShear = sorted.slice(0, Math.min(3, sorted.length));
    const avgVisc = lowShear.reduce((a, b) => a + b.viscosity, 0) / lowShear.length;
    
    // Check if we are actually in the plateau (slope near 0)
    const slope = (lowShear[lowShear.length - 1].viscosity - lowShear[0].viscosity) / 
                  (lowShear[lowShear.length - 1].rate - lowShear[0].rate || 1);
    
    return {
      value: avgVisc,
      isReliable: Math.abs(slope) < avgVisc * 0.1 // Slope is small relative to magnitude
    };
  },

  /**
   * Robust Outlier Detection using Interquartile Range (IQR)
   * 相比 Z-Score 更适用于非正态分布的实验数据
   */
  findOutliersIQR: (values: number[]): number[] => {
    if (values.length < 4) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    return values.filter(v => v < lowerBound || v > upperBound);
  },

  /**
   * Calculates a Weighted Performance Index (PI) for benchmarking
   * 基于多维空间的性能平衡度评分
   */
  calculatePerformanceIndex: (fingerprint: number[]): number => {
    if (fingerprint.length === 0) return 0;
    // Use harmonic mean for PI to penalize extreme weaknesses (bottleneck effect)
    const validValues = fingerprint.filter(v => v > 0);
    if (validValues.length === 0) return 0;
    const inverseSum = validValues.reduce((acc, v) => acc + (1 / v), 0);
    return (validValues.length / inverseSum) * 10; // Normalized to 0-100 range
  },

  /**
   * Performs basic descriptive statistics on a numeric property
   */
  getStats: (values: number[]) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    
    // IQR Calculation
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median,
      stdDev: Math.sqrt(variance),
      iqr,
      q1,
      q3,
      range: sorted[sorted.length - 1] - sorted[0]
    };
  },
  getParetoFrontier: (points: [number, number, string][]): [number, number, string][] => {
    if (points.length === 0) return [];
    // Sort x descending, then y descending
    const sorted = [...points].sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const frontier: [number, number, string][] = [];
    let maxSoFar = -Infinity;

    for (const p of sorted) {
      if (p[1] > maxSoFar) {
        frontier.push(p);
        maxSoFar = p[1];
      }
    }
    return frontier;
  },

  /**
   * Multivariate Similarity Score (0-1)
   * Calculates how similar two materials are based on shared numeric properties
   */
  calculateSimilarity: (v1: number[], v2: number[]): number => {
    if (v1.length === 0 || v1.length !== v2.length) return 0;
    let distSq = 0;
    for (let i = 0; i < v1.length; i++) {
      distSq += Math.pow(v1[i] - v2[i], 2);
    }
    const maxDist = Math.sqrt(v1.length * 100 * 100);
    return Math.max(0, 1 - Math.sqrt(distSq) / maxDist);
  },

  /**
   * Calculates Skewness and Kurtosis for a population
   * Useful for understanding property distribution (asymmetry and tailedness)
   */
  calculateDistributionMoments: (values: number[]) => {
    if (values.length < 3) return null;
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n);
    
    if (stdDev === 0) return { skewness: 0, kurtosis: 0 };

    let skewSum = 0;
    let kurtSum = 0;
    for (const v of values) {
      const z = (v - mean) / stdDev;
      skewSum += Math.pow(z, 3);
      kurtSum += Math.pow(z, 4);
    }

    const skewness = (n / ((n - 1) * (n - 2))) * skewSum;
    const kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * kurtSum - (3 * Math.pow(n - 1, 2) / ((n - 2) * (n - 3)));

    return { skewness, kurtosis };
  },

  /**
   * Detects outliers using the Z-Score method (Threshold = 3)
   */
  findOutliers: (values: number[], threshold: number = 3): number[] => {
    if (values.length < 2) return [];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return [];
    
    return values.filter(v => Math.abs((v - mean) / stdDev) > threshold);
  },

  /**
   * Calculates the 95% Confidence Interval for the slope of a regression line
   */
  calculateCI: (points: [number, number][], slope: number, intercept: number) => {
    if (points.length < 3) return null;
    const n = points.length;
    let sumResidualSq = 0;
    let sumX = 0;
    let sumX2 = 0;

    for (const [x, y] of points) {
      const yPred = slope * x + intercept;
      sumResidualSq += Math.pow(y - yPred, 2);
      sumX += x;
      sumX2 += x * x;
    }

    const seY = Math.sqrt(sumResidualSq / (n - 2));
    const ssX = sumX2 - (Math.pow(sumX, 2) / n);
    const seSlope = seY / Math.sqrt(ssX);
    
    // Simplification of t-value for 95% CI (approx 1.96 for n > 30, but we use 2.0 for safety)
    const tValue = 2.0; 
    return {
      lower: slope - tValue * seSlope,
      upper: slope + tValue * seSlope,
      se: seSlope
    };
  },

  /**
   * Calculates the P-value for a given Pearson correlation r and sample size n
   * (Simplification using t-distribution approximation)
   */
  calculatePValue: (r: number, n: number): number => {
    if (n <= 2) return 1;
    const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
    // Approximation for P-value (Normal distribution CDF)
    const erf = (x: number) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const t = 1.0 / (1.0 + p * Math.abs(x));
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return x >= 0 ? y : -y;
    };
    const cdf = 0.5 * (1 + erf(t / Math.sqrt(2)));
    return 2 * (1 - cdf); // Two-tailed
  },

  /**
   * Calculates Quartiles (Q1, Q2/Median, Q3) and Interquartile Range (IQR)
   */
  calculateQuartiles: (values: number[]) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const idx = (sorted.length - 1) * p;
      const base = Math.floor(idx);
      const rest = idx - base;
      if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      }
      return sorted[base];
    };
    const q1 = getPercentile(0.25);
    const q2 = getPercentile(0.5);
    const q3 = getPercentile(0.75);
    return { q1, q2, q3, iqr: q3 - q1 };
  },

  /**
   * Robust Regression Assessment (Cook's Distance Approximation)
   * Measures the influence of each point on the model.
   */
  analyzeDatalineIntegrity: (points: [number, number][], slope: number, intercept: number) => {
    if (points.length < 4) return { healthScore: 100, influentialPoints: [] };
    const n = points.length;
    let ssE = 0;
    const hValues: number[] = [];
    const meanX = points.reduce((a, b) => a + b[0], 0) / n;
    const ssX = points.reduce((a, b) => a + Math.pow(b[0] - meanX, 2), 0);

    points.forEach(([x, y]) => {
      const yPred = slope * x + intercept;
      ssE += Math.pow(y - yPred, 2);
      hValues.push(1 / n + Math.pow(x - meanX, 2) / ssX);
    });

    const mse = ssE / (n - 2);
    const influentialIndices: number[] = [];
    
    hValues.forEach((h, i) => {
      const [x, y] = points[i];
      const yPred = slope * x + intercept;
      const residual = y - yPred;
      // Cook's Distance approximation
      const d = (Math.pow(residual, 2) / (2 * mse)) * (h / Math.pow(1 - h, 2));
      if (d > 4 / n) influentialIndices.push(i);
    });

    return {
      healthScore: Math.max(0, 100 - influentialIndices.length * (200 / n)),
      influentialPointsCount: influentialIndices.length
    };
  },

  /**
   * Multidimensional Radar Scaling Logic
   * Scales values based on historical or population distribution rather than simple max
   */
  getParetoPoints: (points: { x: number; y: number; name: string }[]): string[] => {
    if (points.length === 0) return [];
    const sorted = [...points].sort((a, b) => b.x - a.x || b.y - a.y);
    const result: string[] = [];
    let maxY = -Infinity;

    for (const p of sorted) {
      if (p.y > maxY) {
        result.push(p.name);
        maxY = p.y;
      }
    }
    return result;
  },

  /**
   * Formats statistical regression results for UI display
   */
  getRegressionLatex: (corr: CorrelationResult | null): string => {
    if (!corr || isNaN(corr.r2)) return "";
    const sign = corr.slope >= 0 ? "+" : "-";
    return `y = ${corr.slope.toFixed(4)}x ${sign} ${Math.abs(corr.intercept).toFixed(2)} (R² = ${corr.r2.toFixed(3)})`;
  },
  generateExpertInsight: (chartType: string): Insight => {
    switch (chartType) {
      case 'radar':
        return {
          title: "性能均衡性分析",
          content: "雷达图显示了当前选定牌号的维度平衡。注意：所有维度已针对当前筛选集进行了相对归一化。较大的包络面代表该牌号在当前组中具有更强的竞争优势。",
          type: 'info'
        };
      case 'ashby':
        return {
          title: "Stiffness-Toughness Trade-off",
          content: "这是高分子材料经典的“刚韧平衡”映射。左上角代表高刚性低韧性，右下角代表跨向弹性体。远离原点的牌号通常具有更好的比强度。",
          type: 'success'
        };
      case 'mfr_density':
        return {
          title: "分子链结构分布",
          content: "密度决定结晶度，MFR决定链长。该分布图揭示了不同生产工艺（如气相 vs 淤浆）在分子量控制稳定性上的差异。",
          type: 'info'
        };
      case 'gpc':
        return {
          title: "分子量分布解读",
          content: "峰值位置（Mp）对应平均分子量。分布越宽（MWD大），加工流动性越好但冲击强度通常会略降。双峰分布通常意味着更好的综合性能。",
          type: 'warning'
        };
      case 'rheology':
        return {
          title: "动态加工窗口",
          content: "剪切变稀行为（Shear Thinning）在此清晰可见。高温下的粘度下降幅度反映了材料的热软化敏感性，对注塑和吹塑成型逻辑至关重要。",
          type: 'info'
        };
      default:
        return {
          title: "数据深度洞察",
          content: "通过多维构效分析，揭示材料微观结构与宏观性能之间的映射规律。",
          type: 'info'
        };
    }
  },

  parseRheologyData: (pts: string): { rate: number; visc: number }[] => {
      try {
          return pts.split(';').map(p => {
              const [rate, visc] = p.split(',').map(Number);
              return { rate, visc };
          }).filter(p => !isNaN(p.rate) && !isNaN(p.visc));
      } catch {
          return [];
      }
  }
};
