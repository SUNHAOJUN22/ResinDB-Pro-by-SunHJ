/** Finite scatter geometry with bounded-depth, coincident-point-safe indexing. */
export interface ScatterPoint<T> {
  x: number;
  y: number;
  data: T;
}

export interface ScatterRectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Node<T> {
  boundary: ScatterRectangle;
  points: ScatterPoint<T>[];
  children?: [Node<T>, Node<T>, Node<T>, Node<T>];
}

function validRectangle(rectangle: ScatterRectangle): boolean {
  return Number.isFinite(rectangle.x) && Number.isFinite(rectangle.y)
    && Number.isFinite(rectangle.w) && Number.isFinite(rectangle.h)
    && rectangle.w >= 0 && rectangle.h >= 0
    && Number.isFinite(rectangle.x + rectangle.w)
    && Number.isFinite(rectangle.y + rectangle.h);
}

function contains(rectangle: ScatterRectangle, point: { x: number; y: number }): boolean {
  return point.x >= rectangle.x && point.x <= rectangle.x + rectangle.w
    && point.y >= rectangle.y && point.y <= rectangle.y + rectangle.h;
}

/** Return a stable [0, 1] coordinate; constant domains are centered, not discarded. */
export function scatterFraction(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(minimum) || !Number.isFinite(maximum)
    || minimum > maximum) {
    throw new RangeError('Scatter coordinates and ordered bounds must be finite');
  }
  if (minimum === maximum) return 0.5;
  const span = maximum - minimum;
  // Opposite, finite extreme values can have an infinite unscaled difference.
  const fraction = Number.isFinite(span)
    ? (value - minimum) / span
    : (value / 2 - minimum / 2) / (maximum / 2 - minimum / 2);
  return Math.min(1, Math.max(0, fraction));
}

/** Stores each point exactly once; a crowded terminal leaf may exceed capacity. */
export class QuadTree<T> {
  private readonly root: Node<T>;
  private static readonly MAX_DEPTH = 32;

  constructor(boundary: ScatterRectangle, private readonly capacity = 10) {
    if (!validRectangle(boundary) || !Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('QuadTree needs a finite rectangle and positive integer capacity');
    }
    this.root = { boundary: { ...boundary }, points: [] };
  }

  insert(point: ScatterPoint<T>): boolean {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || !contains(this.root.boundary, point)) return false;
    let node = this.root;
    for (let depth = 0; ; depth++) {
      const { x, y, w, h } = node.boundary;
      const midX = x + w / 2;
      const midY = y + h / 2;
      const terminal = depth >= QuadTree.MAX_DEPTH
        || midX === x || midX === x + w || midY === y || midY === y + h;
      if (terminal || (!node.children && node.points.length < this.capacity)) {
        node.points.push(point);
        return true;
      }
      if (!node.children) {
        node.children = [
          { boundary: { x, y, w: midX - x, h: midY - y }, points: [] },
          { boundary: { x: midX, y, w: x + w - midX, h: midY - y }, points: [] },
          { boundary: { x, y: midY, w: midX - x, h: y + h - midY }, points: [] },
          { boundary: { x: midX, y: midY, w: x + w - midX, h: y + h - midY }, points: [] },
        ];
      }
      // Explicit quadrant selection prevents duplicate storage along shared edges.
      node = node.children[(point.x >= midX ? 1 : 0) + (point.y >= midY ? 2 : 0)];
    }
  }

  query(range: ScatterRectangle): ScatterPoint<T>[] {
    if (!validRectangle(range)) return [];
    const found: ScatterPoint<T>[] = [];
    const stack: Node<T>[] = [this.root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) break;
      const b = node.boundary;
      if (range.x > b.x + b.w || range.x + range.w < b.x
        || range.y > b.y + b.h || range.y + range.h < b.y) continue;
      for (const point of node.points) {
        if (contains(range, point)) found.push(point);
      }
      if (node.children) stack.push(...node.children);
    }
    return found;
  }
}
