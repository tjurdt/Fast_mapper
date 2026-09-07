/**
 * 分層繪圖。移植自 legacy drawBaseLayer / drawOverlayLayer / drawBandGrid /
 * drawShopBorders / drawLabels / drawCutLines。
 * 每個函式收 (ctx, scene, dims) —— ctx 的變換已由 renderer 設好（影像單位空間）。
 */
import { cellShape } from "../core/cells";
import { cutGeom } from "../core/bands";
import { keyRC } from "../core/keys";
import type { CellKey } from "../core/types";
import { clipOutsideQuads, fillCellPoly, fillQuad, hexA, strokeQuad } from "./draw2d";
import type { Scene, SceneDims } from "./scene";

const WALL_STROKE = "#2b2b2b";

export function drawBaseLayer(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const { doc, view } = scene;
  const { cw, ch, imgW, imgH } = dims;

  ctx.fillStyle = "#f5f7f7";
  ctx.fillRect(0, 0, imgW, imgH);

  const op = view.view === "plan" ? 0.95 : 0.3;
  const layerColor = new Map(doc.planLayers.map((z) => [z.id, z.color]));
  const byColor = new Map<string, [number, number][]>();
  for (const k in doc.cells) {
    const plan = doc.cells[k]!.plan;
    if (!plan) continue;
    const color = layerColor.get(plan);
    if (!color) continue;
    const rc = keyRC(k);
    const list = byColor.get(color);
    if (list) list.push(rc);
    else byColor.set(color, [rc]);
  }
  byColor.forEach((list, color) => {
    ctx.fillStyle = hexA(color, op);
    ctx.beginPath();
    for (const [r, c] of list) ctx.rect(c * cw, r * ch, cw + 0.6, ch + 0.6);
    ctx.fill();
  });
}

export function drawOverlayLayer(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const { doc, geo, view } = scene;
  const { cw, ch, imgW, imgH, gridW, gridH } = dims;
  const a = view.fillA / 100;
  const actual = view.view === "actual";
  const catColor = new Map(doc.categories.map((c) => [c.id, c.color]));

  if (actual) {
    ctx.save();
    clipOutsideQuads(ctx, geo.bandActualQuads(), imgW, imgH);
    const byColor = new Map<string, CellKey[]>();
    for (const k in doc.cells) {
      const d = doc.cells[k]!;
      if (!d.cat || k.charCodeAt(0) === 66 || geo.cellCovered(k)) continue;
      const color = catColor.get(d.cat);
      if (!color) continue;
      const arr = byColor.get(color);
      if (arr) arr.push(k);
      else byColor.set(color, [k]);
    }
    byColor.forEach((keys, color) => {
      const col = hexA(color, a);
      const shaped: Array<[number, number, ReturnType<typeof cellShape>]> = [];
      let plain = false;
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const k of keys) {
        const [r, c] = keyRC(k);
        const poly = cellShape(doc.cells[k]);
        if (poly) {
          shaped.push([r, c, poly]);
          continue;
        }
        ctx.rect(c * cw, r * ch, cw + 0.6, ch + 0.6);
        plain = true;
      }
      if (plain) ctx.fill();
      for (const [r, c, poly] of shaped) fillCellPoly(ctx, r, c, poly, cw, ch, col);
    });
    ctx.restore();
  }

  if (view.showGrid) {
    ctx.save();
    if (actual) clipOutsideQuads(ctx, geo.bandFootprintQuads(), imgW, imgH);
    ctx.lineWidth = Math.max(0.4, cw * 0.04);
    ctx.strokeStyle = "rgba(20,50,55,.13)";
    ctx.beginPath();
    for (let c = 0; c <= gridW; c++) {
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, imgH);
    }
    for (let r = 0; r <= gridH; r++) {
      ctx.moveTo(0, r * ch);
      ctx.lineTo(imgW, r * ch);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (actual) {
    geo.forEachBandCell((_k, d, q) => {
      if (!d.cat) return;
      const color = catColor.get(d.cat);
      if (color) fillQuad(ctx, q, hexA(color, a));
    });
    if (view.showGrid) drawBandGrid(ctx, scene, dims);
    drawBorders(ctx, scene, dims);
    drawLabels(ctx, scene, dims);
  }

  drawCutLines(ctx, scene, dims);
  drawSelection(ctx, scene);
  drawHighlight(ctx, scene, dims);
}

function drawBandGrid(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  ctx.save();
  ctx.lineWidth = Math.max(0.4, dims.cw * 0.04);
  ctx.strokeStyle = "rgba(20,50,55,.16)";
  for (const cut of scene.doc.cuts) {
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

function drawBorders(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  ctx.strokeStyle = "rgba(20,45,50,.55)";
  ctx.lineWidth = Math.max(0.8, dims.cw * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const k in scene.doc.cells) {
    const d = scene.doc.cells[k]!;
    if (!d.feature) continue;
    for (const s of scene.geo.allBorderSegments(k, d)) {
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
    }
  }
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawLabels(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const { view, numbers, geo, doc } = scene;
  const { ch } = dims;
  if (!view.showLabels && !view.showNames) return;
  const idx = geo.featureKeyIndex();
  for (const f of doc.features) {
    const keys = idx.get(f.id);
    if (!keys) continue;
    const num = numbers[f.id];
    for (const anchor of geo.featureLabelAnchors(f.id, keys)) {
      const [cx, cy] = anchor;
      if (view.showLabels && num) {
        const rr = ch * 0.7;
        ctx.fillStyle = "#0e3b43";
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 " + ch * 0.85 + "px 'Noto Sans TC',sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(num), cx, cy + ch * 0.03);
      }
      if (view.showNames) {
        ctx.fillStyle = "#10312f";
        ctx.font = "600 " + ch * 0.75 + "px 'Noto Sans TC',sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(f.name, cx, cy + ch * 0.8, 8 * dims.cw);
      }
    }
  }
}

function drawCutLines(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const ghost = scene.cutMode;
  ctx.save();
  for (const cut of scene.doc.cuts) {
    const g = cutGeom(cut, dims.cw, dims.ch);
    if (cut.wall) {
      ctx.setLineDash([]);
      ctx.lineCap = "round";
      ctx.strokeStyle = WALL_STROKE;
      ctx.lineWidth = Math.max(1.1, dims.cw * 0.42);
    } else if (ghost) {
      ctx.setLineDash([dims.cw * 0.7, dims.cw * 0.5]);
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(20,50,55,.5)";
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

function drawSelection(ctx: CanvasRenderingContext2D, scene: Scene): void {
  if (!scene.selection.size) return;
  ctx.strokeStyle = "#b5401f";
  for (const k of scene.selection) {
    const q = scene.geo.keyQuad(k);
    if (q) fillQuad(ctx, q, hexA("#e2603f", 0.35));
  }
}

function drawHighlight(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const id = scene.highlightFeature;
  if (!id) return;
  ctx.strokeStyle = "#e2603f";
  ctx.lineWidth = dims.cw * 0.22;
  ctx.setLineDash([dims.cw * 0.6, dims.cw * 0.4]);
  for (const k in scene.doc.cells) {
    if (scene.doc.cells[k]!.feature !== id) continue;
    strokeQuad(ctx, scene.geo.keyQuad(k));
  }
  ctx.setLineDash([]);
}
