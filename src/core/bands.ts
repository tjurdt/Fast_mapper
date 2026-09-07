/**
 * 切線 / 對齊帶幾何。移植自 legacy：cutGeom / bandQuad / bandOuter / bandLocate /
 * refreshBands(→computeBandCover)。所有座標為影像空間（格 × cellPx）。
 */
import type { Cut, Point } from "./types";
import { clamp, clipPolyToRect, polyArea } from "./poly";
import { gridKey } from "./keys";

export interface CutGeom {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** 單位方向向量（沿切線）。 */
  ux: number;
  uy: number;
  /** 單位法向量（帶展開方向，已含 side 正負號）。 */
  nx: number;
  ny: number;
  /** 切線長度。 */
  L: number;
  /** 一個 band 格的邊長 = (cw + ch) / 2。 */
  U: number;
  /** 沿切線方向的分割數。 */
  k: number;
  /** 每一格沿切線方向的步長 = L / k。 */
  step: number;
  depth: number;
  side: -1 | 0 | 1;
  jMin: number;
  jMax: number;
}

export function cutGeom(cut: Cut, cw: number, ch: number): CutGeom {
  const U = (cw + ch) / 2;
  const ax = cut.ax * cw;
  const ay = cut.ay * ch;
  const bx = cut.bx * cw;
  const by = cut.by * ch;
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const side: -1 | 0 | 1 = cut.side === 0 ? 0 : cut.side < 0 ? -1 : 1;
  const sign = side < 0 ? -1 : 1;
  const k = Math.max(1, Math.round(L / U));
  const depth = Math.max(0, Math.trunc(cut.depth));
  return {
    ax,
    ay,
    bx,
    by,
    ux,
    uy,
    nx: -uy * sign,
    ny: ux * sign,
    L,
    U,
    k,
    step: L / k,
    depth,
    side,
    jMin: side === 0 ? -depth : 0,
    jMax: depth - 1,
  };
}

function project(g: CutGeom, u: number, v: number): Point {
  return [g.ax + g.ux * u + g.nx * v, g.ay + g.uy * u + g.ny * v];
}

/** 第 (i, j) 個 band 格的四邊形。 */
export function bandQuad(g: CutGeom, i: number, j: number): Point[] {
  return [
    project(g, i * g.step, j * g.U),
    project(g, (i + 1) * g.step, j * g.U),
    project(g, (i + 1) * g.step, (j + 1) * g.U),
    project(g, i * g.step, (j + 1) * g.U),
  ];
}

/** 整條帶的外框四邊形。 */
export function bandOuter(g: CutGeom): Point[] {
  const d0 = g.jMin * g.U;
  const d1 = (g.jMax + 1) * g.U;
  return [project(g, 0, d0), project(g, g.L, d0), project(g, g.L, d1), project(g, 0, d1)];
}

/** 影像空間座標 → band 格索引；不在帶內回 null。 */
export function bandLocate(g: CutGeom, px: number, py: number): { i: number; j: number } | null {
  if (!g.depth) return null;
  const rx = px - g.ax;
  const ry = py - g.ay;
  const u = rx * g.ux + ry * g.uy;
  const v = rx * g.nx + ry * g.ny;
  if (u < 0 || u > g.L || v < g.jMin * g.U || v > (g.jMax + 1) * g.U) return null;
  return {
    i: clamp(Math.floor(u / g.step), 0, g.k - 1),
    j: clamp(Math.floor(v / g.U), g.jMin, g.jMax),
  };
}

/**
 * 計算被某條帶「完全覆蓋」的一般格集合（這些格在 actual 視圖中被帶取代）。
 * 對應 legacy 的 refreshBands / bandCover。
 */
export function computeBandCover(
  cuts: readonly Cut[],
  cw: number,
  ch: number,
  gridW: number,
  gridH: number,
): Set<string> {
  const cover = new Set<string>();
  for (const cut of cuts) {
    if (!cut.depth) continue;
    const g = cutGeom(cut, cw, ch);
    const pts = bandOuter(g);
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const c0 = clamp(Math.floor(Math.min(...xs) / cw), 0, gridW - 1);
    const c1 = clamp(Math.ceil(Math.max(...xs) / cw), 0, gridW - 1);
    const r0 = clamp(Math.floor(Math.min(...ys) / ch), 0, gridH - 1);
    const r1 = clamp(Math.ceil(Math.max(...ys) / ch), 0, gridH - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const overlap = polyArea(clipPolyToRect(pts, c * cw, r * ch, (c + 1) * cw, (r + 1) * ch));
        if (overlap >= cw * ch * (1 - 1e-7)) cover.add(gridKey(r, c));
      }
    }
  }
  return cover;
}
