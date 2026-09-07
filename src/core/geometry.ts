/**
 * MapGeometry —— 針對一份 MapDoc 提供純查詢：格子四邊形、可見性、鄰居、
 * 命中測試、Feature 連通分量。移植自 legacy index.html 中散落各處、原本依賴
 * 全域變數的幾何函式（keyQuad / cellVisible / gridKeysUnderQuad / shopKeyIndex /
 * shopComponents / regularShopAtPoint / shopBorderSegments ...）。
 *
 * 建構後即為不可變快照：bandCover 與有效網格尺寸在建構時算好。MapDoc 內容變動
 * 時，重新 `new MapGeometry(doc)`。
 */
import type { Cell, CellKey, Cut, MapDoc, Point } from "./types";
import { bandKey, gridKey, isBandKey, keyRC, parseBandKey } from "./keys";
import { cellHidden, cellShape, cellSideIntervals } from "./cells";
import { bandLocate, bandOuter, bandQuad, computeBandCover, cutGeom, type CutGeom } from "./bands";
import { clamp, clipPolyToRect, pointInPoly, polyArea, subtractIntervals } from "./poly";

const SQUARE: Point[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export type Segment = readonly [number, number, number, number];

export class MapGeometry {
  readonly doc: MapDoc;
  readonly cw: number;
  readonly ch: number;
  readonly gridW: number;
  readonly gridH: number;
  readonly bandCover: ReadonlySet<string>;

  private readonly cutById: Map<string, Cut>;
  private readonly geomCache = new Map<string, CutGeom>();

  constructor(doc: MapDoc) {
    this.doc = doc;
    this.cw = doc.grid.cellPx;
    this.ch = doc.grid.cellPx;

    // legacy syncGridMetricsInner：網格至少要容納所有已放置的一般格。
    let maxR = -1;
    let maxC = -1;
    for (const k in doc.cells) {
      if (isBandKey(k)) continue;
      const [r, c] = keyRC(k);
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
    this.gridW = Math.max(1, Math.round(doc.grid.w) || 1, maxC + 1);
    this.gridH = Math.max(1, Math.round(doc.grid.h) || 1, maxR + 1);

    this.cutById = new Map(doc.cuts.map((c) => [c.id, c]));
    this.bandCover = computeBandCover(doc.cuts, this.cw, this.ch, this.gridW, this.gridH);
  }

  private geomFor(cut: Cut): CutGeom {
    let g = this.geomCache.get(cut.id);
    if (!g) {
      g = cutGeom(cut, this.cw, this.ch);
      this.geomCache.set(cut.id, g);
    }
    return g;
  }

  cell(k: CellKey): Cell | undefined {
    return this.doc.cells[k];
  }

  cellCovered(k: CellKey): boolean {
    return this.bandCover.has(k);
  }

  /** 格子四邊形（影像空間）；隱藏 / 被覆蓋 / 無效 band 格回 null。 */
  keyQuad(k: CellKey, d?: Cell): Point[] | null {
    if (isBandKey(k)) {
      const b = parseBandKey(k);
      const cut = this.cutById.get(b.id);
      if (!cut || !cut.depth) return null;
      const g = this.geomFor(cut);
      if (b.i < 0 || b.i >= g.k || b.j < g.jMin || b.j > g.jMax) return null;
      return bandQuad(g, b.i, b.j);
    }
    if (this.cellCovered(k)) return null;
    const [r, c] = keyRC(k);
    const poly = cellShape(d ?? this.doc.cells[k]);
    if (poly) {
      if (poly.length < 3) return null;
      return poly.map((q) => [(c + q[0]) * this.cw, (r + q[1]) * this.ch] as Point);
    }
    return [
      [c * this.cw, r * this.ch],
      [(c + 1) * this.cw, r * this.ch],
      [(c + 1) * this.cw, (r + 1) * this.ch],
      [c * this.cw, (r + 1) * this.ch],
    ];
  }

  keyCenter(k: CellKey): Point | null {
    const q = this.keyQuad(k);
    if (!q) return null;
    let x = 0;
    let y = 0;
    for (const p of q) {
      x += p[0];
      y += p[1];
    }
    return [x / q.length, y / q.length];
  }

  cellVisible(k: CellKey, d?: Cell): boolean {
    const cell = d ?? this.doc.cells[k];
    if (!cell) return false;
    if (isBandKey(k)) {
      const b = parseBandKey(k);
      const cut = this.cutById.get(b.id);
      if (!cut || !cut.depth) return false;
      const g = this.geomFor(cut);
      return b.i >= 0 && b.i < g.k && b.j >= g.jMin && b.j <= g.jMax;
    }
    return !cellHidden(cell) && !this.cellCovered(k);
  }

  cellNeighbors(k: CellKey): CellKey[] {
    if (isBandKey(k)) {
      const b = parseBandKey(k);
      return [
        bandKey(b.id, b.i, b.j - 1),
        bandKey(b.id, b.i + 1, b.j),
        bandKey(b.id, b.i, b.j + 1),
        bandKey(b.id, b.i - 1, b.j),
      ];
    }
    const [r, c] = keyRC(k);
    return [gridKey(r - 1, c), gridKey(r, c + 1), gridKey(r + 1, c), gridKey(r, c - 1)];
  }

  /** 與此四邊形有實質重疊的一般格鍵。 */
  gridKeysUnderQuad(q: Point[] | null): CellKey[] {
    if (!q || q.length < 3) return [];
    const xs = q.map((p) => p[0]);
    const ys = q.map((p) => p[1]);
    const edge = 1e-7;
    const c0 = clamp(Math.floor(Math.min(...xs) / this.cw), 0, this.gridW - 1);
    const c1 = clamp(Math.floor((Math.max(...xs) - edge) / this.cw), 0, this.gridW - 1);
    const r0 = clamp(Math.floor(Math.min(...ys) / this.ch), 0, this.gridH - 1);
    const r1 = clamp(Math.floor((Math.max(...ys) - edge) / this.ch), 0, this.gridH - 1);
    const out: CellKey[] = [];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const clipped = clipPolyToRect(q, c * this.cw, r * this.ch, (c + 1) * this.cw, (r + 1) * this.ch);
        if (polyArea(clipped) > this.cw * this.ch * 1e-6) out.push(gridKey(r, c));
      }
    }
    return out;
  }

  // ---- Feature（命名區域）----

  /** featureId → 該 feature 的可見格鍵陣列。 */
  featureKeyIndex(): Map<string, CellKey[]> {
    const m = new Map<string, CellKey[]>();
    for (const k in this.doc.cells) {
      const d = this.doc.cells[k]!;
      if (!d.feature || !this.cellVisible(k, d)) continue;
      const a = m.get(d.feature);
      if (a) a.push(k);
      else m.set(d.feature, [k]);
    }
    return m;
  }

  featureKeys(id: string): CellKey[] {
    const out: CellKey[] = [];
    for (const k in this.doc.cells) {
      const d = this.doc.cells[k]!;
      if (d.feature === id && this.cellVisible(k, d)) out.push(k);
    }
    return out;
  }

  /** 把一個 feature 的格子拆成連通分量（band 格透過 gridKeysUnderQuad 與一般格互連）。 */
  featureComponents(id: string, keys?: CellKey[]): CellKey[][] {
    const pending = new Set(keys ?? this.featureKeys(id));
    const crossLinks = new Map<string, string[]>();
    const link = (a: string, b: string) => {
      (crossLinks.get(a) ?? crossLinks.set(a, []).get(a)!).push(b);
      (crossLinks.get(b) ?? crossLinks.set(b, []).get(b)!).push(a);
    };
    for (const k of [...pending].filter(isBandKey)) {
      for (const nk of this.gridKeysUnderQuad(this.keyQuad(k))) {
        if (pending.has(nk)) link(k, nk);
      }
    }
    const out: CellKey[][] = [];
    while (pending.size) {
      const first = pending.values().next().value as string;
      const stack = [first];
      const cells: CellKey[] = [];
      pending.delete(first);
      while (stack.length) {
        const k = stack.pop()!;
        cells.push(k);
        for (const nk of [...this.cellNeighbors(k), ...(crossLinks.get(k) ?? [])]) {
          if (pending.delete(nk)) stack.push(nk);
        }
      }
      out.push(cells);
    }
    return out;
  }

  /** 一個分量內最接近質心的格中心（標籤錨點）。 */
  componentAnchor(keys: CellKey[]): Point | null {
    const pts = keys.map((k) => this.keyCenter(k)).filter((p): p is Point => !!p);
    if (!pts.length) return null;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    let best: { p: Point; d: number } | null = null;
    for (const p of pts) {
      const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
      if (!best || d < best.d) best = { p, d };
    }
    return best!.p;
  }

  featureLabelAnchors(id: string, keys?: CellKey[]): Point[] {
    return this.featureComponents(id, keys)
      .map((c) => this.componentAnchor(c))
      .filter((p): p is Point => !!p);
  }

  // ---- 命中測試 ----

  regularFeatureAtPoint(x: number, y: number): string | null {
    const c = Math.floor(x / this.cw);
    const r = Math.floor(y / this.ch);
    if (r < 0 || r >= this.gridH || c < 0 || c >= this.gridW) return null;
    const d = this.doc.cells[gridKey(r, c)];
    if (!d || !d.feature) return null;
    const poly = cellShape(d);
    const inside = !poly
      ? true
      : poly.length < 3
        ? false
        : pointInPoly(x / this.cw - c, y / this.ch - r, poly);
    return inside ? d.feature : null;
  }

  bandFeatureAtPoint(x: number, y: number): string | null {
    for (const cut of this.doc.cuts) {
      if (!cut.depth) continue;
      const hit = bandLocate(this.geomFor(cut), x, y);
      if (!hit) continue;
      const d = this.doc.cells[bandKey(cut.id, hit.i, hit.j)];
      if (d?.feature) return d.feature;
    }
    return null;
  }

  bandCellAt(x: number, y: number): CellKey | null {
    for (const cut of this.doc.cuts) {
      if (!cut.depth) continue;
      const hit = bandLocate(this.geomFor(cut), x, y);
      if (hit) return bandKey(cut.id, hit.i, hit.j);
    }
    return null;
  }

  // ---- 帶（band）走訪，給渲染用 ----

  /** 取某條切線的展開幾何（供渲染畫格線）。 */
  cutGeom(cutId: string): CutGeom | null {
    const cut = this.cutById.get(cutId);
    return cut ? this.geomFor(cut) : null;
  }

  /** 走訪所有有深度的切線的每一個 band 格（含四邊形）。 */
  forEachBandCell(cb: (k: CellKey, d: Cell, quad: Point[]) => void): void {
    for (const cut of this.doc.cuts) {
      if (!cut.depth) continue;
      const g = this.geomFor(cut);
      for (let i = 0; i < g.k; i++) {
        for (let j = g.jMin; j <= g.jMax; j++) {
          const k = bandKey(cut.id, i, j);
          const d = this.doc.cells[k];
          if (d) cb(k, d, bandQuad(g, i, j));
        }
      }
    }
  }

  /** 有實際分類的 band 格四邊形（actual 視圖裁切用遮罩）。 */
  bandActualQuads(): Point[][] {
    const out: Point[][] = [];
    const catIds = new Set(this.doc.categories.map((c) => c.id));
    this.forEachBandCell((_k, d, q) => {
      if (d.cat && catIds.has(d.cat)) out.push(q);
    });
    return out;
  }

  /** 每條有深度切線的整條帶外框（裁掉底下的方格線）。 */
  bandFootprintQuads(): Point[][] {
    const out: Point[][] = [];
    for (const cut of this.doc.cuts) {
      if (cut.depth) out.push(bandOuter(this.geomFor(cut)));
    }
    return out;
  }

  /** 與影像矩形相交的格鍵（一般格用左上角落點，band 格用中心點；沿用 legacy selectInRect）。 */
  cellsInRect(x0: number, y0: number, x1: number, y1: number, includeBands: boolean): CellKey[] {
    const out: CellKey[] = [];
    const c0 = clamp(Math.floor(x0 / this.cw), 0, this.gridW - 1);
    const c1 = clamp(Math.floor(x1 / this.cw), 0, this.gridW - 1);
    const r0 = clamp(Math.floor(y0 / this.ch), 0, this.gridH - 1);
    const r1 = clamp(Math.floor(y1 / this.ch), 0, this.gridH - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const k = gridKey(r, c);
        if (!this.cellCovered(k)) out.push(k);
      }
    }
    if (includeBands) {
      for (const cut of this.doc.cuts) {
        if (!cut.depth) continue;
        const g = this.geomFor(cut);
        for (let i = 0; i < g.k; i++) {
          for (let j = g.jMin; j <= g.jMax; j++) {
            const q = bandQuad(g, i, j);
            const cx = (q[0]![0] + q[2]![0]) / 2;
            const cy = (q[0]![1] + q[2]![1]) / 2;
            if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) out.push(bandKey(cut.id, i, j));
          }
        }
      }
    }
    return out;
  }

  /** 靠近某條切線的 cut id（tol 為影像單位容差）；沒有則 null。 */
  cutNear(x: number, y: number, tol: number): string | null {
    let best: { id: string; d: number } | null = null;
    for (const cut of this.doc.cuts) {
      const g = this.geomFor(cut);
      const dx = g.bx - g.ax;
      const dy = g.by - g.ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - g.ax) * dx + (y - g.ay) * dy) / l2, 0, 1);
      const d = Math.hypot(x - (g.ax + dx * t), y - (g.ay + dy * t));
      if (d <= tol && (!best || d < best.d)) best = { id: cut.id, d };
    }
    return best ? best.id : null;
  }

  /** 影像空間座標 → 格鍵。actual 視圖優先落在 band 格。 */
  cellAtPoint(x: number, y: number, view: "actual" | "plan"): CellKey {
    if (view === "actual") {
      const bk = this.bandCellAt(x, y);
      if (bk) return bk;
    }
    return gridKey(
      clamp(Math.floor(y / this.ch), 0, this.gridH - 1),
      clamp(Math.floor(x / this.cw), 0, this.gridW - 1),
    );
  }

  // ---- 邊界線段（給渲染 / 匯出用）----

  /** 單一格對其所屬 feature 的邊界線段（會扣掉與同 feature 鄰格共用的邊）。 */
  featureBorderSegments(k: CellKey, d: Cell): Segment[] {
    const [r, c] = keyRC(k);
    const poly = cellShape(d);
    const segs: Segment[] = [];
    if (poly && poly.length < 3) return segs;
    const pts = poly ?? SQUARE;
    const E = 1e-6;
    const nbrKey = (side: number) =>
      gridKey(r + (side === 0 ? -1 : side === 1 ? 1 : 0), c + (side === 2 ? -1 : side === 3 ? 1 : 0));
    const opp = (side: number) => (side === 0 ? 1 : side === 1 ? 0 : side === 2 ? 3 : 2);
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i]!;
      const w = pts[(i + 1) % pts.length]!;
      let side = -1;
      if (Math.abs(q[1]) < E && Math.abs(w[1]) < E) side = 0;
      else if (Math.abs(q[1] - 1) < E && Math.abs(w[1] - 1) < E) side = 1;
      else if (Math.abs(q[0]) < E && Math.abs(w[0]) < E) side = 2;
      else if (Math.abs(q[0] - 1) < E && Math.abs(w[0] - 1) < E) side = 3;
      if (side < 0) {
        segs.push([(c + q[0]) * this.cw, (r + q[1]) * this.ch, (c + w[0]) * this.cw, (r + w[1]) * this.ch]);
        continue;
      }
      const nk = nbrKey(side);
      const nd = this.doc.cells[nk];
      const lo = side < 2 ? Math.min(q[0], w[0]) : Math.min(q[1], w[1]);
      const hi = side < 2 ? Math.max(q[0], w[0]) : Math.max(q[1], w[1]);
      const subs =
        nd && nd.feature === d.feature && !cellHidden(nd) && !this.cellCovered(nk)
          ? cellSideIntervals(nd, opp(side) as 0 | 1 | 2 | 3)
          : [];
      for (const part of subtractIntervals([lo, hi], subs)) {
        const s0 = part[0];
        const s1 = part[1];
        if (side === 0) segs.push([(c + s0) * this.cw, r * this.ch, (c + s1) * this.cw, r * this.ch]);
        else if (side === 1)
          segs.push([(c + s0) * this.cw, (r + 1) * this.ch, (c + s1) * this.cw, (r + 1) * this.ch]);
        else if (side === 2) segs.push([c * this.cw, (r + s0) * this.ch, c * this.cw, (r + s1) * this.ch]);
        else segs.push([(c + 1) * this.cw, (r + s0) * this.ch, (c + 1) * this.cw, (r + s1) * this.ch]);
      }
    }
    return segs;
  }

  /** 一般格 + band 格通用的 feature 外框線段（會扣掉跨層共用邊）。 */
  allBorderSegments(k: CellKey, d: Cell): Segment[] {
    if (isBandKey(k)) {
      const q = this.keyQuad(k);
      if (!q) return [];
      const nb = this.cellNeighbors(k);
      const out: Segment[] = [];
      const cx = q.reduce((a, p) => a + p[0], 0) / q.length;
      const cy = q.reduce((a, p) => a + p[1], 0) / q.length;
      const probe = Math.max(this.cw, this.ch) * 0.035;
      for (let e = 0; e < 4; e++) {
        const nd = this.doc.cells[nb[e]!];
        if (nd && nd.feature === d.feature && this.cellVisible(nb[e]!, nd)) continue;
        const p1 = q[e]!;
        const p2 = q[(e + 1) % 4]!;
        const mx = (p1[0] + p2[0]) / 2;
        const my = (p1[1] + p2[1]) / 2;
        const vx = mx - cx;
        const vy = my - cy;
        const L = Math.hypot(vx, vy) || 1;
        if (this.regularFeatureAtPoint(mx + (vx / L) * probe, my + (vy / L) * probe) === d.feature) continue;
        out.push([p1[0], p1[1], p2[0], p2[1]]);
      }
      return out;
    }
    if (this.cellCovered(k)) return [];
    return this.featureBorderSegments(k, d).filter(
      (g) => this.bandFeatureAtPoint((g[0] + g[2]) / 2, (g[1] + g[3]) / 2) !== d.feature,
    );
  }
}
