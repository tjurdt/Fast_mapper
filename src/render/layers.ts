/**
 * 三個螢幕圖層的繪製函式。地圖內容用 primitives.ts 的共用基元；
 * ctx 變換已由 renderer 設好（影像單位空間）。
 */
import { hexA, strokeQuad } from "./draw2d";
import {
  drawActualFill,
  drawBandCells,
  drawBandGridLines,
  drawFeatureBorders,
  drawFeatureLabels,
  drawGridLines,
  drawPlanFill,
  drawWallLines,
} from "./primitives";
import { facilityById } from "../facilities";
import type { Scene, SceneDims } from "./scene";

/** base：規劃分區底色（底圖圖片由 renderer 另外疊上）。 */
export function drawBaseLayer(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  ctx.fillStyle = "#f7f2e8"; // 暖色系底色
  ctx.fillRect(0, 0, dims.imgW, dims.imgH);
  drawPlanFill(ctx, scene.doc, dims, scene.view.view === "plan" ? 0.95 : 0.3);
}

/** content：格線 / 實際分類 / band / 邊界 / 標籤 / 牆。文件編輯時才重畫。 */
export function drawContentLayer(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const { doc, geo, view } = scene;
  const a = view.fillA / 100;
  const actual = view.view === "actual";

  if (actual) drawActualFill(ctx, geo, dims, a);
  if (view.showGrid) drawGridLines(ctx, geo, dims, actual);
  if (actual) {
    drawBandCells(ctx, geo, a);
    if (view.showGrid) drawBandGridLines(ctx, doc, dims);
    drawFeatureBorders(ctx, geo, dims);
    const facById = new Map(doc.features.map((f) => [f.id, f.facility]));
    drawFeatureLabels(ctx, geo, scene.numbers, {
      showLabels: view.showLabels,
      showNames: view.showNames,
      numberRadius: dims.ch * 0.7,
      numberFont: dims.ch * 0.85,
      nameFont: dims.ch * 0.75,
      facilityIcon: (id) => facilityById(facById.get(id))?.icon,
    });
  }
  drawWallLines(ctx, doc, dims, scene.cutMode);
}

/** interaction：選取 / 拖曳框 / 幽靈切線 / 端點把手 / 高亮。每幀重畫，但便宜。 */
export function drawInteractionLayer(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  drawSelection(ctx, scene);
  drawSelectedCuts(ctx, scene, dims);
  drawHighlight(ctx, scene, dims);
  drawDragRect(ctx, scene, dims);
  drawGhostCut(ctx, scene, dims);
  drawCutHandles(ctx, scene, dims);
}

function drawSelectedCuts(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  if (!scene.selectedCutIds.size) return;
  ctx.save();
  ctx.strokeStyle = "#e2603f";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, dims.cw * 0.5);
  ctx.setLineDash([]);
  for (const cut of scene.doc.cuts) {
    if (!scene.selectedCutIds.has(cut.id)) continue;
    ctx.beginPath();
    ctx.moveTo(cut.ax * dims.cw, cut.ay * dims.ch);
    ctx.lineTo(cut.bx * dims.cw, cut.by * dims.ch);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSelection(ctx: CanvasRenderingContext2D, scene: Scene): void {
  if (!scene.selection.size) return;
  ctx.fillStyle = hexA("#e2603f", 0.35);
  for (const k of scene.selection) {
    const q = scene.geo.selectionQuad(k, scene.selectionShapes.get(k));
    if (!q) continue;
    ctx.beginPath();
    q.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
    ctx.closePath();
    ctx.fill();
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

function drawDragRect(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const r = scene.dragRect;
  if (!r) return;
  ctx.strokeStyle = "#b5401f";
  ctx.lineWidth = dims.cw * 0.14;
  ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  ctx.fillStyle = hexA("#e2603f", 0.2);
  ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
}

function drawGhostCut(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const g = scene.ghostCut;
  if (!g) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.4, dims.cw * 0.3);
  ctx.strokeStyle = "rgba(214,79,39,.95)";
  ctx.beginPath();
  ctx.moveTo(g[0] * dims.cw, g[1] * dims.ch);
  ctx.lineTo(g[2] * dims.cw, g[3] * dims.ch);
  ctx.stroke();
  ctx.fillStyle = "#d64f27";
  for (const [gx, gy] of [
    [g[0], g[1]],
    [g[2], g[3]],
  ] as const) {
    ctx.beginPath();
    ctx.arc(gx * dims.cw, gy * dims.ch, Math.max(1.6, dims.cw * 0.38), 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

function drawCutHandles(ctx: CanvasRenderingContext2D, scene: Scene, dims: SceneDims): void {
  const cut = scene.editingCut;
  if (!cut) return;
  const ax = cut.ax * dims.cw;
  const ay = cut.ay * dims.ch;
  const bx = cut.bx * dims.cw;
  const by = cut.by * dims.ch;
  ctx.strokeStyle = "#d64f27";
  ctx.lineWidth = Math.max(1.2, dims.cw * 0.2);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.fillStyle = "#d64f27";
  for (const [hx, hy] of [
    [ax, ay],
    [bx, by],
  ] as const) {
    ctx.beginPath();
    ctx.arc(hx, hy, Math.max(2, dims.cw * 0.55), 0, 7);
    ctx.fill();
  }
}
