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

  // 牆只擋在子格「之間」（零厚度），不吃掉面積 —— 邊緣才不會鋸齒。
  // wallV[j*W+i]：擋住子格 (i-1,j)↔(i,j)；wallH[j*W+i]：擋住子格 (i,j-1)↔(i,j)。
  const wallV = new Uint8Array(W * H);
  const wallH = new Uint8Array(W * H);
  const nodeCut = new Uint8Array(W * H);

  // 兩線段是否相交（含端點碰觸）。
  const segHit = (
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number,
  ) => {
    const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return false; // 平行 / 共線：交由鄰邊處理
    const s = ((cx - ax) * d2y - (cy - ay) * d2x) / den;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
    return s >= -1e-9 && s <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9;
  };

  // 牆把「相鄰兩子格中心的連線」切斷 → 封住這條通路。4-連通洪水的每一步都是跨越一條
  // 這樣的連線，所以只要沿牆蒐集它掃過的子格（含外擴一圈），再檢查各自往右 / 往下的
  // 連線是否被切斷即可，得到密封屏障（不分角度、成本 O(牆長)）。舊版對 x、y 兩軸各自
  // 取樣，斜率不是 ±1 時轉角留縫、洪水漏到隔壁區域。
  for (const t of cuts) {
    const ax = t.ax * sub;
    const ay = t.ay * sub;
    const bx = t.bx * sub;
    const by = t.by * sub;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-9) continue;
    const steps = Math.ceil(len * 3) + 1;
    const cells = new Set<number>();
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const ci = Math.floor(ax + (bx - ax) * f);
      const cj = Math.floor(ay + (by - ay) * f);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i >= 0 && i < W && j >= 0 && j < H) cells.add(j * W + i);
        }
      }
    }
    for (const idx of cells) {
      const i = idx % W;
      const j = (idx - i) / W;
      // 往右：連線 (i+0.5,j+0.5)–(i+1.5,j+0.5) 被切 → wallV[i+1,j]
      if (i + 1 < W && segHit(ax, ay, bx, by, i + 0.5, j + 0.5, i + 1.5, j + 0.5)) wallV[j * W + i + 1] = 1;
      // 往下：連線 (i+0.5,j+0.5)–(i+0.5,j+1.5) 被切 → wallH[i,j+1]
      if (j + 1 < H && segHit(ax, ay, bx, by, i + 0.5, j + 0.5, i + 0.5, j + 1.5)) wallH[(j + 1) * W + i] = 1;
    }
  }

  // 端點封口：牆的兩端若與別條牆相接（轉角 / T 接點），連線相交測試在角落半個子格內
  // 仍可能留一條對角縫。把接點周圍 2×2 子格設為不可通行即可徹底密封。
  const ends = cuts.map((t) => ({ ax: t.ax * sub, ay: t.ay * sub, bx: t.bx * sub, by: t.by * sub }));
  for (let ci = 0; ci < ends.length; ci++) {
    const s = ends[ci]!;
    for (const [ex, ey] of [
      [s.ax, s.ay],
      [s.bx, s.by],
    ] as const) {
      let junction = false;
      for (let cj = 0; cj < ends.length && !junction; cj++) {
        if (cj === ci) continue;
        const o = ends[cj]!;
        const l2 = (o.bx - o.ax) ** 2 + (o.by - o.ay) ** 2 || 1;
        const u = clamp(((ex - o.ax) * (o.bx - o.ax) + (ey - o.ay) * (o.by - o.ay)) / l2, 0, 1);
        if (Math.hypot(ex - (o.ax + (o.bx - o.ax) * u), ey - (o.ay + (o.by - o.ay) * u)) <= 0.75)
          junction = true;
      }
      if (!junction) continue;
      for (const ii of [Math.ceil(ex) - 1, Math.floor(ex)]) {
        for (const jj of [Math.ceil(ey) - 1, Math.floor(ey)]) {
          if (ii >= 0 && ii < W && jj >= 0 && jj < H) nodeCut[jj * W + ii] = 1;
        }
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
  const refPt = new Map<CellKey, Point>();
  refs.forEach((acc, k) => {
    if (geo.cellCovered(k)) return;
    const rp: Point = [acc[0] / acc[2], acc[1] / acc[2]];
    refPt.set(k, rp);
    keys.push(k);
    shapes.set(k, clipCellToRegion(k, rp, cuts, cw, ch));
  });

  // 邊界殘片回收：洪水以 1/8 子格為單位，斜牆會讓「區域側只剩不到一個子格」的邊界格
  // 整格漏掉，使選取範圍看起來往內縮、貼不到牆。對已選格的四方鄰格，若被切線切過，
  // 就用鄰格的參考點把它裁進來補上那一小片。
  const added = new Set(keys);
  const probe: [CellKey, Point][] = [];
  for (const k of keys) {
    const rp = refPt.get(k)!;
    const [r, c] = keyRC(k);
    for (const nk of [gridKey(r - 1, c), gridKey(r + 1, c), gridKey(r, c - 1), gridKey(r, c + 1)]) {
      if (added.has(nk)) continue;
      const [nr, nc] = keyRC(nk);
      if (nr < 0 || nc < 0 || nr >= geo.gridH || nc >= geo.gridW) continue;
      if (geo.cellCovered(nk)) continue;
      added.add(nk);
      probe.push([nk, rp]);
    }
  }
  for (const [nk, rp] of probe) {
    const shape = clipCellToRegion(nk, rp, cuts, cw, ch);
    if (!shape || shape.length < 3) continue;
    const frac = polyArea(shape); // 0..1
    // 太小 → 雜訊；過半 → 這格本該被洪水淹到卻沒有，多半是取樣誤差，別亂補。
    if (frac < 2e-3 || frac > 0.55) continue;
    keys.push(nk);
    shapes.set(nk, shape);
  }

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
