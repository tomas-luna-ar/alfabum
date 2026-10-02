export type Point = { x: number; y: number };
/** Esquinas en orden: arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. */
export type Quad = [Point, Point, Point, Point];

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Envolvente convexa (monotone chain). */
export function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function polygonArea(points: Point[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Rectángulo de área mínima que contiene la envolvente (uno de sus lados siempre coincide con un lado de la envolvente).
 * Se devuelve con la rotación más chica posible (entre -45° y 45°), para enderezar sin dar vuelta la imagen.
 */
export function minAreaRect(hull: Point[]): Quad {
  let best = { area: Infinity, angle: 0, minU: 0, maxU: 0, minV: 0, maxV: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    let angle = Math.atan2(b.y - a.y, b.x - a.x);
    // Normalizar a [-45°, 45°): el mismo rectángulo, pero con la rotación mínima
    angle = ((angle + Math.PI / 4) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2) - Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * cos + p.y * sin;
      const v = -p.x * sin + p.y * cos;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < best.area) best = { area, angle, minU, maxU, minV, maxV };
  }
  const { angle, minU, maxU, minV, maxV } = best;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const toImage = (u: number, v: number): Point => ({ x: u * cos - v * sin, y: u * sin + v * cos });
  return [toImage(minU, minV), toImage(maxU, minV), toImage(maxU, maxV), toImage(minU, maxV)];
}

export function isConvex(quad: Quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]);
    if (c === 0) return false;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

/** Para cada esquina del rectángulo, el punto de la envolvente más cercano: aproxima las esquinas reales del paquete. */
export function snapCorners(rect: Quad, hull: Point[]): Quad {
  return rect.map((corner) => hull.reduce((best, p) => (dist(p, corner) < dist(best, corner) ? p : best))) as Quad;
}

/** Gira el resultado 90° en sentido horario: la esquina de abajo-izquierda pasa a ser la de arriba-izquierda. */
export function rotateClockwise([tl, tr, br, bl]: Quad): Quad {
  return [bl, tl, tr, br];
}

/** Achica el cuadrilátero hacia su centro, para no incluir bordes del fondo. */
export function insetQuad(quad: Quad, ratio: number): Quad {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  return quad.map((p) => ({ x: p.x + (cx - p.x) * ratio, y: p.y + (cy - p.y) * ratio })) as Quad;
}

/** Ancho y alto del rectángulo enderezado que corresponde al cuadrilátero. */
export function quadSize(quad: Quad) {
  const [tl, tr, br, bl] = quad;
  return {
    width: (dist(tl, tr) + dist(bl, br)) / 2,
    height: (dist(tl, bl) + dist(tr, br)) / 2,
  };
}

/**
 * Homografía que lleva el rectángulo (0,0)-(width,height) al cuadrilátero.
 * Devuelve una función que, dado un píxel del resultado, da su posición en la foto original.
 */
export function perspectiveMap(width: number, height: number, quad: Quad) {
  const src: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  // Sistema de 8 ecuaciones para los coeficientes h0..h7 (h8 = 1)
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = quad[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return (x: number, y: number): Point => {
    const w = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
  };
}

/** Eliminación gaussiana con pivoteo parcial. */
function solve(A: number[][], b: number[]) {
  const n = b.length;
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}
