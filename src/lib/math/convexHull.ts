export interface Point2D {
  x: number;
  y: number;
  id?: string;
  data?: unknown;
}

// CCW > 0 means counter-clockwise (left turn)
// CCW < 0 means clockwise (right turn)
// CCW = 0 means collinear
function ccw(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

export function grahamScan(points: Point2D[]): Point2D[] {
  if (points.length <= 3) return points;

  // Find the point with the lowest y-coordinate (and leftmost if tied)
  let lowest = points[0];
  let lowestIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < lowest.y || (points[i].y === lowest.y && points[i].x < lowest.x)) {
      lowest = points[i];
      lowestIdx = i;
    }
  }

  // Swap lowest to the first position
  const temp = points[0];
  points[0] = points[lowestIdx];
  points[lowestIdx] = temp;

  // Sort remaining points by polar angle with respect to the lowest point
  const sorted = points.slice(1).sort((a, b) => {
    const angle = ccw(lowest, a, b);
    if (angle === 0) {
      // collinear, closer point first
      const distA = (a.x - lowest.x) ** 2 + (a.y - lowest.y) ** 2;
      const distB = (b.x - lowest.x) ** 2 + (b.y - lowest.y) ** 2;
      return distA - distB;
    }
    return angle > 0 ? -1 : 1;
  });

  const hull: Point2D[] = [lowest, sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    let top = hull.length - 1;
    while (hull.length >= 2 && ccw(hull[top - 1], hull[top], sorted[i]) <= 0) {
      hull.pop();
      top--;
    }
    hull.push(sorted[i]);
  }

  return hull;
}
