/**
 * 封閉區洪水框選：點在被切線（牆）圍住的空白處，選取整塊區域，
 * 邊界格依穿過它的切線裁成多邊形（斜切格）。
 * 移植自 legacy selectEnclosedAt / segCrossesRect / clipCellToRegion。
 */
import type { CellKey, CellPoly, Point } from "./types";
import type { MapGeometry } from "./geometry";
import { bandKey, gridKey, keyRC } from "./keys";
import { bandQuad } from "./bands";
import { clamp, clipPolyHalfPlane, polyArea, segCrossesRect } from "./poly";

const FILL_SUB = 8; // 每格細分數（越大越精細、越慢）

export interface EnclosedRegion {
  keys: CellKey[];
  /** key → 裁切後的局部多邊形（0..1）；null = 整格。 */
  shapes: Map<CellKey, CellPoly | null>;
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** 把整格依穿過它的切線裁到 ref 點那一側；未被裁或幾乎整格 → null。 */
function clipCellToRegion(k: CellKey, ref: Point, cuts: Seg[], cw: number, ch: number): CellPoly | null {
  const [r, c] = keyRC(k);
  const x0 = c * cw;
  const y0 = r * ch;
  const x1 = x0 + cw;
  const y1 = y0 + ch;
  let poly: Point[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  let clipped = false;
  for (const t of cuts) {
    const ax = t.ax * cw;
    const ay = t.ay * ch;
    const bx = t.bx * cw;
    const by = t.by * ch;
    if (!segCrossesRect(ax, ay, bx, by, x0, y0, x1, y1)) continue;
    const f = (pt: Point) => (bx - ax) * (pt[1] - ay) - (by - ay) * (pt[0] - ax);
    const sgn = f(ref) >= 0 ? 1 : -1;
    const cross = (a: Point, b: Point): Point => {
      const fa = f(a);
      const fb = f(b);
      const u = Math.abs(fa - fb) < 1e-12 ? 0 : fa / (fa - fb);
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    };
    poly = clipPolyHalfPlane(poly, (pt) => sgn * f(pt) >= -1e-9, cross);
    clipped = true;
    if (poly.length < 3) break;
  }
  if (!clipped || poly.length < 3 || polyArea(poly) >= cw * ch * (1 - 1e-3)) return null;
  return poly.map(
    (pt) => [clamp((pt[0] - x0) / cw, 0, 1), clamp((pt[1] - y0) / ch, 0, 1)] as [number, number],
  );
}

/**
 * @param x,y 影像單位座標
 * @param view "actual" 時也把落在區域內的 band 格納入
 * @returns 選取結果，或 { error } 說明為何失敗
 */
export function selectEnclosedRegion(
  geo: MapGeometry,
  x: number,
  y: number,
  view: "actual" | "plan",
): EnclosedRegion | { error: string } {
  const cuts = geo.doc.cuts;
  if (!cuts.length) return { error: "還沒有任何切線／牆" };
  const cw = geo.cw;
  const ch = geo.ch;
  const sub = FILL_SUB;
  const W = geo.gridW * sub;
  const H = geo.gridH * sub;
  const sw = cw / sub;
  const sh = ch / sub;

  // 牆只擋在子格「之間」（零厚度），不吃掉面積 —— 邊緣才不會鋸齒
  const wallV = new Uint8Array(W * H);
  const wallH = new Uint8Array(W * H);
  const nodeCut = new Uint8Array(W * H);

  for (const t of cuts) {
    const ax = t.ax * sub;
    const ay = t.ay * sub;
    const bx = t.bx * sub;
    const by = t.by * sub;
    if (ax !== bx) {
      for (let i = Math.ceil(Math.min(ax, bx) - 0.5), iE = Math.floor(Math.max(ax, bx) - 0.5); i <= iE; i++) {
        const yy = ay + (by - ay) * ((i + 0.5 - ax) / (bx - ax));
        const j = Math.floor(yy + 0.5);
        if (i >= 0 && i < W && j > 0 && j < H) wallH[j * W + i] = 1;
        const jn = Math.round(yy - 0.5);
        if (Math.abs(yy - 0.5 - jn) < 1e-9 && i >= 0 && i < W && jn >= 0 && jn < H) nodeCut[jn * W + i] = 1;
      }
    }
    if (ay !== by) {
      for (let j = Math.ceil(Math.min(ay, by) - 0.5), jE = Math.floor(Math.max(ay, by) - 0.5); j <= jE; j++) {
        const xx = ax + (bx - ax) * ((j + 0.5 - ay) / (by - ay));
        const i = Math.floor(xx + 0.5);
        if (j >= 0 && j < H && i > 0 && i < W) wallV[j * W + i] = 1;
        const iN = Math.round(xx - 0.5);
        if (Math.abs(xx - 0.5 - iN) < 1e-9 && j >= 0 && j < H && iN >= 0 && iN < W) nodeCut[j * W + iN] = 1;
      }
    }
  }

  const si = clamp(Math.floor(x / sw), 0, W - 1);
  const sj = clamp(Math.floor(y / sh), 0, H - 1);
  const start = sj * W + si;
  if (nodeCut[start]) return { error: "請點在線條圍住的空白處" };

  const seen = new Uint8Array(W * H);
  const stack = [start];
  const refs = new Map<CellKey, [number, number, number]>();
  seen[start] = 1;
  const push = (tt: number) => {
    if (!seen[tt] && !nodeCut[tt]) {
      seen[tt] = 1;
      stack.push(tt);
    }
  };
  while (stack.length) {
    const idx = stack.pop()!;
    const i = idx % W;
    const j = (idx - i) / W;
    if (i === 0 || j === 0 || i === W - 1 || j === H - 1) return { error: "此處沒有被線條完全封閉" };
    const key = gridKey(Math.floor(j / sub), Math.floor(i / sub));
    const acc = refs.get(key);
    if (acc) {
      acc[0] += (i + 0.5) * sw;
      acc[1] += (j + 0.5) * sh;
      acc[2]++;
    } else {
      refs.set(key, [(i + 0.5) * sw, (j + 0.5) * sh, 1]);
    }
    if (!wallV[idx]) push(idx - 1);
    if (!wallV[idx + 1]) push(idx + 1);
    if (!wallH[idx]) push(idx - W);
    if (!wallH[idx + W]) push(idx + W);
  }

  const keys: CellKey[] = [];
  const shapes = new Map<CellKey, CellPoly | null>();
  refs.forEach((acc, k) => {
    if (geo.cellCovered(k)) return;
    keys.push(k);
    shapes.set(k, clipCellToRegion(k, [acc[0] / acc[2], acc[1] / acc[2]], cuts, cw, ch));
  });

  if (view === "actual") {
    for (const cut of cuts) {
      if (!cut.depth) continue;
      const g = geo.cutGeom(cut.id);
      if (!g) continue;
      for (let i = 0; i < g.k; i++) {
        for (let j = g.jMin; j <= g.jMax; j++) {
          const q = bandQuad(g, i, j);
          const bi = Math.floor((q[0]![0] + q[2]![0]) / 2 / sw);
          const bj = Math.floor((q[0]![1] + q[2]![1]) / 2 / sh);
          if (bi >= 0 && bi < W && bj >= 0 && bj < H && seen[bj * W + bi]) keys.push(bandKey(cut.id, i, j));
        }
      }
    }
  }

  if (!keys.length) return { error: "封閉區域內沒有可選取的格子" };
  return { keys, shapes };
}
