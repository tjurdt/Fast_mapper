/**
 * 地圖內容的 canvas 繪圖基元 —— 螢幕渲染（layers.ts）與匯出合成（export/composite.ts）
 * 共用這一套，確保匯出與畫面一致。全部在影像單位空間繪製（ctx 變換由呼叫端設定）。
 * 移植自 legacy drawBaseLayer / drawOverlayLayer / drawBandGrid / drawShopBorders / drawLabels。
 */
import { cellParts } from "../core/cells";
import { cutGeom } from "../core/bands";
import { keyRC } from "../core/keys";
import type { CellPoly, MapDoc } from "../core/types";
import type { MapGeometry } from "../core/geometry";
import { clipOutsideQuads, fillCellPoly, fillQuad, hexA } from "./draw2d";
import type { SceneDims } from "./scene";

export const WALL_STROKE = "#2b2b2b";

/** 規劃分區底色（方格）。 */
export function drawPlanFill(
  ctx: CanvasRenderingContext2D,
  doc: MapDoc,
  dims: SceneDims,
  opacity: number,
): void {
  const color = new Map(doc.planLayers.map((z) => [z.id, z.color]));
  const byColor = new Map<string, [number, number][]>();
  for (const k in doc.cells) {
    const plan = doc.cells[k]!.plan;
    if (!plan) continue;
    const col = color.get(plan);
    if (!col) continue;
    (byColor.get(col) ?? byColor.set(col, []).get(col)!).push(keyRC(k));
  }
  byColor.forEach((list, col) => {
    ctx.fillStyle = hexA(col, opacity);
    ctx.beginPath();
    for (const [r, c] of list) ctx.rect(c * dims.cw, r * dims.ch, dims.cw + 0.6, dims.ch + 0.6);
    ctx.fill();
  });
}

/** 實際分類上色（一般格，裁切在 band 之外）。 */
export function drawActualFill(
  ctx: CanvasRenderingContext2D,
  geo: MapGeometry,
  dims: SceneDims,
  opacity: number,
): void {
  const doc = geo.doc;
  const color = new Map(doc.categories.map((c) => [c.id, c.color]));
  ctx.save();
  clipOutsideQuads(ctx, geo.bandActualQuads(), dims.imgW, dims.imgH);

  // 一般矩形格：依顏色批次成單一 path（大地圖上比每格一次 fillRect 快很多）
  const rects = new Map<string, [number, number][]>();
  const shaped: { r: number; c: number; poly: CellPoly; col: string }[] = [];
  for (const k in doc.cells) {
    const d = doc.cells[k]!;
    if (!d.cat || k.charCodeAt(0) === 66 || geo.cellCovered(k)) continue;
    const [r, c] = keyRC(k);
    for (const p of cellParts(d)) {
      const col = color.get(p.cat);
      if (!col) continue;
      if (p.poly) {
        if (p.poly.length >= 3) shaped.push({ r, c, poly: p.poly, col });
      } else {
        (rects.get(col) ?? rects.set(col, []).get(col)!).push([r, c]);
      }
    }
  }
  const cw = dims.cw;
  const ch = dims.ch;
  rects.forEach((list, col) => {
    ctx.fillStyle = hexA(col, opacity);
    ctx.beginPath();
    for (const [r, c] of list) ctx.rect(c * cw, r * ch, cw + 0.6, ch + 0.6);
    ctx.fill();
  });
  for (const s of shaped) fillCellPoly(ctx, s.r, s.c, s.poly, cw, ch, hexA(s.col, opacity));
  ctx.restore();
}

/** band 格的實際分類上色。 */
export function drawBandCells(ctx: CanvasRenderingContext2D, geo: MapGeometry, opacity: number): void {
  const color = new Map(geo.doc.categories.map((c) => [c.id, c.color]));
  geo.forEachBandCell((_k, d, q) => {
    if (!d.cat) return;
    const col = color.get(d.cat);
    if (col) fillQuad(ctx, q, hexA(col, opacity));
  });
}

/** 方格線。 */
export function drawGridLines(
  ctx: CanvasRenderingContext2D,
  geo: MapGeometry,
  dims: SceneDims,
  clipBands: boolean,
): void {
  ctx.save();
  if (clipBands) clipOutsideQuads(ctx, geo.bandFootprintQuads(), dims.imgW, dims.imgH);
  ctx.lineWidth = Math.max(0.4, dims.cw * 0.04);
  ctx.strokeStyle = "rgba(70,50,32,.14)";
  ctx.beginPath();
  for (let c = 0; c <= dims.gridW; c++) {
    ctx.moveTo(c * dims.cw, 0);
    ctx.lineTo(c * dims.cw, dims.imgH);
  }
  for (let r = 0; r <= dims.gridH; r++) {
    ctx.moveTo(0, r * dims.ch);
    ctx.lineTo(dims.imgW, r * dims.ch);
  }
  ctx.stroke();
  ctx.restore();
}

/** 帶內的斜向網格線。 */
export function drawBandGridLines(ctx: CanvasRenderingContext2D, doc: MapDoc, dims: SceneDims): void {
  ctx.save();
  ctx.lineWidth = Math.max(0.4, dims.cw * 0.04);
  ctx.strokeStyle = "rgba(70,50,32,.17)";
  for (const cut of doc.cuts) {
    if (!cut.depth) continue;
    const g = cutGeom(cut, dims.cw, dims.ch);
    const d0 = g.jMin * g.U;
    const d1 = (g.jMax + 1) * g.U;
    ctx.beginPath();
    for (let i = 0; i <= g.k; i++) {
      const u = i * g.step;
      ctx.moveTo(g.ax + g.ux * u + g.nx * d0, g.ay + g.uy * u + g.ny * d0);
      ctx.lineTo(g.ax + g.ux * u + g.nx * d1, g.ay + g.uy * u + g.ny * d1);
    }
    for (let j = g.jMin; j <= g.jMax + 1; j++) {
      const v = j * g.U;
      ctx.moveTo(g.ax + g.nx * v, g.ay + g.ny * v);
      ctx.lineTo(g.ax + g.ux * g.L + g.nx * v, g.ay + g.uy * g.L + g.ny * v);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 命名區域外框。 */
export function drawFeatureBorders(ctx: CanvasRenderingContext2D, geo: MapGeometry, dims: SceneDims): void {
  ctx.strokeStyle = "rgba(60,42,28,.55)";
  ctx.lineWidth = Math.max(0.8, dims.cw * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const k in geo.doc.cells) {
    const d = geo.doc.cells[k]!;
    if (!d.feature) continue;
    for (const s of geo.allBorderSegments(k, d)) {
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
    }
  }
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** 實牆線（ghost=true 時所有切線畫成虛線）。 */
export function drawWallLines(
  ctx: CanvasRenderingContext2D,
  doc: MapDoc,
  dims: SceneDims,
  ghost: boolean,
): void {
  ctx.save();
  for (const cut of doc.cuts) {
    const g = cutGeom(cut, dims.cw, dims.ch);
    if (cut.wall) {
      ctx.setLineDash([]);
      ctx.lineCap = "round";
      ctx.strokeStyle = WALL_STROKE;
      ctx.lineWidth = Math.max(1.1, dims.cw * 0.42);
    } else if (ghost) {
      ctx.setLineDash([dims.cw * 0.7, dims.cw * 0.5]);
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(70,50,32,.5)";
      ctx.lineWidth = Math.max(0.8, dims.cw * 0.14);
    } else {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(g.ax, g.ay);
    ctx.lineTo(g.bx, g.by);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export interface LabelOpts {
  showLabels: boolean;
  showNames: boolean;
  numberRadius: number;
  numberFont: number;
  nameFont: number;
  /** featureId → 設施 emoji（有的話畫在錨點，取代編號徽章的視覺主體）。 */
  facilityIcon?: (featureId: string) => string | undefined;
}

/** 編號徽章 / 設施 icon + 名稱。 */
export function drawFeatureLabels(
  ctx: CanvasRenderingContext2D,
  geo: MapGeometry,
  numbers: Record<string, number>,
  opts: LabelOpts,
): void {
  const idx = geo.featureKeyIndex();
  for (const f of geo.doc.features) {
    if (!idx.has(f.id)) continue;
    const num = numbers[f.id];
    const icon = opts.facilityIcon?.(f.id);
    for (const [cx, cy] of geo.featureLabelAnchors(f.id)) {
      const r = opts.numberRadius;
      if (icon) {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "rgba(14,59,67,.35)";
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.15, 0, 7);
        ctx.fill();
        ctx.stroke();
        ctx.font = `${r * 1.6}px 'Noto Sans TC',sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon, cx, cy + r * 0.05);
        if (opts.showLabels && num) {
          ctx.fillStyle = "#0e3b43";
          ctx.beginPath();
          ctx.arc(cx + r * 1.1, cy - r * 1.1, r * 0.62, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = `700 ${opts.numberFont * 0.72}px 'Noto Sans TC',sans-serif`;
          ctx.fillText(String(num), cx + r * 1.1, cy - r * 1.05);
        }
      } else if (opts.showLabels && num) {
        ctx.fillStyle = "#0e3b43";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${opts.numberFont}px 'Noto Sans TC',sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(num), cx, cy + r * 0.04);
      }
      if (opts.showNames) {
        ctx.fillStyle = "#10312f";
        ctx.font = `600 ${opts.nameFont}px 'Noto Sans TC',sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(f.name, cx, cy + r * 1.3);
      }
    }
  }
}
