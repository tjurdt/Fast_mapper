/** 格子外形相關的純函式。移植自 legacy：cellShape / cellHidden / cellSideIntervals。 */
import type { Cell, CellPoly } from "./types";
import type { Interval } from "./poly";

/** 取格子的斜切多邊形；沒有則回 null（整格方形）。 */
export function cellShape(d: Cell | undefined): CellPoly | null {
  return d && Array.isArray(d.poly) ? d.poly : null;
}

/** 格子被完全隱藏（poly 頂點少於 3）。 */
export function cellHidden(d: Cell | undefined): boolean {
  const p = cellShape(d);
  return !!p && p.length < 3;
}

/** side: 0=上(y=0) 1=下(y=1) 2=左(x=0) 3=右(x=1)。回傳沿該邊被外形佔用的區間（局部 0..1）。 */
export function cellSideIntervals(d: Cell | undefined, side: 0 | 1 | 2 | 3): Interval[] {
  const poly = cellShape(d);
  if (!poly) return [[0, 1]];
  if (poly.length < 3) return [];
  const out: Interval[] = [];
  const E = 1e-6;
  for (let i = 0; i < poly.length; i++) {
    const q = poly[i]!;
    const w = poly[(i + 1) % poly.length]!;
    if (side === 0 && Math.abs(q[1]) < E && Math.abs(w[1]) < E)
      out.push([Math.min(q[0], w[0]), Math.max(q[0], w[0])]);
    else if (side === 1 && Math.abs(q[1] - 1) < E && Math.abs(w[1] - 1) < E)
      out.push([Math.min(q[0], w[0]), Math.max(q[0], w[0])]);
    else if (side === 2 && Math.abs(q[0]) < E && Math.abs(w[0]) < E)
      out.push([Math.min(q[1], w[1]), Math.max(q[1], w[1])]);
    else if (side === 3 && Math.abs(q[0] - 1) < E && Math.abs(w[0] - 1) < E)
      out.push([Math.min(q[1], w[1]), Math.max(q[1], w[1])]);
  }
  return out;
}
