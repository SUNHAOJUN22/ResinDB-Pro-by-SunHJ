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
  const safeN = n > 0 ? n : 1;
  const mean = values.reduce((a, b) => a + b, 0) / safeN;
  const variance = Math.max(0, values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (safeN - 1 || 1));
  return 1.06 * Math.sqrt(variance) * Math.pow(safeN, -0.2);
}

self.onmessage = (e: MessageEvent<KdeMessage>) => {
  try {
    const { points, gridSize = 50 } = e.data.payload;
    const validPoints = (points || []).filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
    if (validPoints.length === 0) throw new Error("No valid points for KDE");

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    const xVals = [];
    const yVals = [];
    
    for (const p of validPoints) {
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

    const safeGridSize = gridSize > 1 ? gridSize : 50;
    for (let j = 0; j < safeGridSize; j++) {
      const cy = minY + (j / (safeGridSize - 1)) * (maxY - minY);
      for (let i = 0; i < safeGridSize; i++) {
        const cx = minX + (i / (safeGridSize - 1)) * (maxX - minX);
        
        let z = 0;
        for (const p of validPoints) {
           // scaled distance squared to treat x and y equally in kernel footprint
           const dx = (p.x - cx) / (bwX || 1);
           const dy = (p.y - cy) / (bwY || 1);
           const dSq = dx*dx + dy*dy;
           z += Math.exp(-dSq / 2); // 2D standard normal
        }
        z = z / validPoints.length; // normalize
        
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

// v3.1.0-sync
