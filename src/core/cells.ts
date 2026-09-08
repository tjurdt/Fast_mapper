/** 格子外形相關的純函式。移植自 legacy：cellShape / cellHidden / cellSideIntervals。 */
import type { Cell, CellFragment, CellPoly } from "./types";
import { pointInPoly, type Interval } from "./poly";

/** 取格子的斜切多邊形；沒有則回 null（整格方形）。 */
export function cellShape(d: Cell | undefined): CellPoly | null {
  return d && Array.isArray(d.poly) ? d.poly : null;
}

/**
 * 一格所有「有分類的片段」：主片段（cat/feature/poly）＋ frags。
 * poly 為 null 代表整格方形（僅主片段可能如此，且此時不會有 frags）。
 */
export function cellParts(d: Cell | undefined): { cat: string; feature?: string; poly: CellPoly | null }[] {
  if (!d) return [];
  const out: { cat: string; feature?: string; poly: CellPoly | null }[] = [];
  if (d.cat || d.feature) {
    const p = cellShape(d);
    if (!p || p.length >= 3) out.push({ cat: d.cat ?? "", feature: d.feature, poly: p });
  }
  if (Array.isArray(d.frags)) {
    for (const f of d.frags) {
      if (Array.isArray(f.poly) && f.poly.length >= 3)
        out.push({ cat: f.cat, feature: f.feature, poly: f.poly });
    }
  }
  return out;
}

/** 點（局部 0..1）落在哪個片段的 feature / cat 上；沒有則 null。 */
export function partAt(d: Cell | undefined, lx: number, ly: number): CellFragment | null {
  for (const p of cellParts(d)) {
    if (!p.poly ? true : pointInPoly(lx, ly, p.poly))
      return { cat: p.cat, feature: p.feature ?? "", poly: p.poly ?? [] };
  }
  return null;
}

/** 這格是否含有指定 feature 的任一片段。 */
export function cellHasFeature(d: Cell | undefined, featureId: string): boolean {
  if (!d) return false;
  if (d.feature === featureId) return true;
  return Array.isArray(d.frags) && d.frags.some((f) => f.feature === featureId);
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
