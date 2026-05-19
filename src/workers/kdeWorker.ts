export interface KdeMessage {
  type: 'CALCULATE_KDE';
  payload: {
    points: {x: number, y: number}[];
    gridSize?: number; // e.g. 50x50
  };
}

export interface KdeResponse {
  type: 'KDE_CALCULATED' | 'ERROR';
  payload?: {
    grid: {x: number, y: number, z: number}[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  error?: string;
}

// Scott's rule of thumb
function calculateBandwidth(values: number[]): number {
  if (values.length < 2) return 1;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
  return 1.06 * Math.sqrt(variance) * Math.pow(n, -1/5);
}

self.onmessage = (e: MessageEvent<KdeMessage>) => {
  try {
    const { points, gridSize = 50 } = e.data.payload;
    if (points.length === 0) throw new Error("No points for KDE");

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    const xVals = [];
    const yVals = [];
    
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      xVals.push(p.x);
      yVals.push(p.y);
    }
    
    // Add margin
    const diffX = maxX - minX || 1;
    const diffY = maxY - minY || 1;
    minX -= diffX * 0.1;
    maxX += diffX * 0.1;
    minY -= diffY * 0.1;
    maxY += diffY * 0.1;
    
    const bwX = calculateBandwidth(xVals) || (diffX * 0.1);
    const bwY = calculateBandwidth(yVals) || (diffY * 0.1);

    const grid = [];
    let minZ = Infinity, maxZ = -Infinity;

    for (let j = 0; j < gridSize; j++) {
      const cy = minY + (j / (gridSize - 1)) * (maxY - minY);
      for (let i = 0; i < gridSize; i++) {
        const cx = minX + (i / (gridSize - 1)) * (maxX - minX);
        
        let z = 0;
        for (const p of points) {
           // scaled distance squared to treat x and y equally in kernel footprint
           const dx = (p.x - cx) / (bwX || 1);
           const dy = (p.y - cy) / (bwY || 1);
           const dSq = dx*dx + dy*dy;
           z += Math.exp(-dSq / 2); // 2D standard normal
        }
        z = z / points.length; // normalize
        
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        grid.push({ x: cx, y: cy, z });
      }
    }

    self.postMessage({
      type: 'KDE_CALCULATED',
      payload: { grid, minX, maxX, minY, maxY, minZ, maxZ }
    } as KdeResponse);

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
