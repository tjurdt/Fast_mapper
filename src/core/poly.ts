/**
 * 純多邊形 / 區間幾何。無任何外部狀態依賴 —— 全部可獨立測試。
 * 移植自 legacy index.html：polyArea / clipPolyHalfPlane / clipPolyToRect /
 * pointInPoly / subtractIntervals。
 */
import type { CellPoly, Point, Polygon } from "./types";

/** 線段 [ax,ay,bx,by]。 */
export type Segment4 = readonly [number, number, number, number];

export type Interval = readonly [number, number];

/** 多邊形面積（Shoelace，取絕對值）。 */
export function polyArea(poly: Polygon): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const q = poly[i]!;
    const w = poly[(i + 1) % poly.length]!;
    a += q[0] * w[1] - w[0] * q[1];
  }
  return Math.abs(a) / 2;
}

type InsideFn = (p: Point) => boolean;
type IntersectFn = (a: Point, b: Point) => Point;

/** Sutherland–Hodgman 單一半平面裁切。 */
export function clipPolyHalfPlane(poly: Polygon, inside: InsideFn, intersect: IntersectFn): Point[] {
  const out: Point[] = [];
  if (!poly.length) return out;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ain = inside(a);
    const bin = inside(b);
    if (ain && bin) out.push(b);
    else if (ain && !bin) out.push(intersect(a, b));
    else if (!ain && bin) {
      out.push(intersect(a, b));
      out.push(b);
    }
  }
  return out;
}

/** 將多邊形裁切到軸對齊矩形 [x0,y0]-[x1,y1]。 */
export function clipPolyToRect(poly: Polygon, x0: number, y0: number, x1: number, y1: number): Point[] {
  const crossX =
    (x: number): IntersectFn =>
    (a, b) => {
      const den = b[0] - a[0];
      const t = Math.abs(den) < 1e-12 ? 0 : (x - a[0]) / den;
      return [x, a[1] + (b[1] - a[1]) * t];
    };
  const crossY =
    (y: number): IntersectFn =>
    (a, b) => {
      const den = b[1] - a[1];
      const t = Math.abs(den) < 1e-12 ? 0 : (y - a[1]) / den;
      return [a[0] + (b[0] - a[0]) * t, y];
    };
  let out: Point[] = poly.slice();
  out = clipPolyHalfPlane(out, (p) => p[0] >= x0 - 1e-7, crossX(x0));
  out = clipPolyHalfPlane(out, (p) => p[0] <= x1 + 1e-7, crossX(x1));
  out = clipPolyHalfPlane(out, (p) => p[1] >= y0 - 1e-7, crossY(y0));
  return clipPolyHalfPlane(out, (p) => p[1] <= y1 + 1e-7, crossY(y1));
}

/** 射線法點在多邊形內判定。 */
export function pointInPoly(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const hit = a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1] || 1e-12) + a[0];
    if (hit) inside = !inside;
  }
  return inside;
}

/** Liang–Barsky：線段 (ax,ay)-(bx,by) 是否穿過（或碰到）矩形 [x0,y0,x1,y1]。 */
export function segCrossesRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]!) < 1e-12) {
      if (q[i]! < 0) return false;
    } else {
      const t = q[i]! / p[i]!;
      if (p[i]! < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t1 - t0 > -1e-9;
}

/**
 * 單位方格 (0..1)² 依「穿過它的線段」裁到 `ref` 那一側。
 * `walls` 為方格局部座標的線段（0..1 附近）。回傳局部多邊形；
 * 沒有任何線段實際切過方格、或裁完幾乎整格 → null。
 */
export function clipUnitCell(ref: Point, walls: readonly Segment4[]): CellPoly | null {
  let poly: Point[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  let clipped = false;
  for (const w of walls) {
    const [ax, ay, bx, by] = w;
    if (!segCrossesRect(ax, ay, bx, by, 0, 0, 1, 1)) continue;
    const f = (p: Point) => (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
    const sgn = f(ref) >= 0 ? 1 : -1;
    const cross = (a: Point, b: Point): Point => {
      const fa = f(a);
      const fb = f(b);
      const u = Math.abs(fa - fb) < 1e-12 ? 0 : fa / (fa - fb);
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    };
    poly = clipPolyHalfPlane(poly, (p) => sgn * f(p) >= -1e-9, cross);
    clipped = true;
    if (poly.length < 3) break;
  }
  if (!clipped || poly.length < 3 || polyArea(poly) >= 1 - 1e-3) return null;
  return poly.map((p) => [clamp(p[0], 0, 1), clamp(p[1], 0, 1)] as [number, number]);
}

/** 把 doc 座標（格為單位）的切線轉成某格 (r,c) 的局部座標線段。 */
export function wallsForCell(
  cuts: readonly { ax: number; ay: number; bx: number; by: number }[],
  r: number,
  c: number,
): Segment4[] {
  const out: Segment4[] = [];
  for (const t of cuts) {
    const s: Segment4 = [t.ax - c, t.ay - r, t.bx - c, t.by - r];
    if (segCrossesRect(s[0], s[1], s[2], s[3], 0, 0, 1, 1)) out.push(s);
  }
  return out;
}

/** 點到線段距離。 */
export function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** 從 base 區間扣掉一組 sub 區間，回傳剩餘片段（過濾掉極短片段）。 */
export function subtractIntervals(base: Interval, subs: readonly Interval[]): Interval[] {
  let parts: Interval[] = [base];
  for (const sub of subs) {
    const next: Interval[] = [];
    for (const part of parts) {
      const a = part[0];
      const b = part[1];
      const s0 = sub[0];
      const s1 = sub[1];
      if (s1 <= a + 1e-6 || s0 >= b - 1e-6) {
        next.push(part);
        continue;
      }
      if (s0 > a + 1e-6) next.push([a, Math.min(s0, b)]);
      if (s1 < b - 1e-6) next.push([Math.max(s1, a), b]);
    }
    parts = next;
  }
  return parts.filter((x) => x[1] - x[0] > 1e-4);
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
