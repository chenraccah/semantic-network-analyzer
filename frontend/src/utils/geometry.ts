/**
 * Geometry utilities for cluster hull drawing
 */

interface Point {
  x: number;
  y: number;
}

/**
 * Graham scan convex hull algorithm
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  // Find lowest point (and leftmost if tie)
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[lowest].y ||
        (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
      lowest = i;
    }
  }

  const pivot = points[lowest];
  const sorted = points
    .filter((_, i) => i !== lowest)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
      if (angleA !== angleB) return angleA - angleB;
      // If same angle, sort by distance
      const distA = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2;
      const distB = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2;
      return distA - distB;
    });

  const hull: Point[] = [pivot];
  for (const point of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(point);
  }

  return hull;
}

/**
 * Expand hull by padding amount
 */
export function expandHull(hull: Point[], padding: number): Point[] {
  if (hull.length < 3) return hull;

  // Find centroid
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;

  return hull.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return p;
    return {
      x: p.x + (dx / dist) * padding,
      y: p.y + (dy / dist) * padding,
    };
  });
}

/**
 * Draw a smooth cluster hull on canvas
 */
export function drawClusterHull(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  padding: number = 40
): void {
  if (points.length < 2) return;

  let hull: Point[];
  if (points.length === 2) {
    // For 2 points, create an ellipse-like shape
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / dist;
    const ny = dx / dist;
    hull = [
      { x: points[0].x + nx * padding, y: points[0].y + ny * padding },
      { x: points[1].x + nx * padding, y: points[1].y + ny * padding },
      { x: points[1].x - nx * padding, y: points[1].y - ny * padding },
      { x: points[0].x - nx * padding, y: points[0].y - ny * padding },
    ];
  } else {
    hull = expandHull(convexHull(points), padding);
  }

  if (hull.length < 3) return;

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.08;

  // Draw smooth path
  ctx.beginPath();
  ctx.moveTo(hull[0].x, hull[0].y);
  for (let i = 1; i < hull.length; i++) {
    const prev = hull[i - 1];
    const curr = hull[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  // Close
  const last = hull[hull.length - 1];
  const first = hull[0];
  const mx = (last.x + first.x) / 2;
  const my = (last.y + first.y) / 2;
  ctx.quadraticCurveTo(last.x, last.y, mx, my);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.restore();
}
