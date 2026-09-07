/** 匯出用的 canvas 合成：地圖 + 圖例 + 對照清單。移植自 legacy renderComposite。 */
import type { MapDoc } from "../core/types";
import type { MapGeometry } from "../core/geometry";
import { hexA } from "../render/draw2d";
import {
  drawActualFill,
  drawBandCells,
  drawBandGridLines,
  drawFeatureBorders,
  drawGridLines,
  drawPlanFill,
  drawWallLines,
} from "../render/primitives";
import { facilityById, FACILITIES } from "../facilities";
import { EXPORT_COLS, type ExportLayout } from "./layout";

type Ctx2D = CanvasRenderingContext2D;

export function renderComposite(
  ctx: Ctx2D,
  scale: number,
  layout: ExportLayout,
  doc: MapDoc,
  geo: MapGeometry,
  numbers: Record<string, number>,
): void {
  const { opts } = layout;
  const dims = {
    cw: geo.cw,
    ch: geo.ch,
    imgW: layout.imgW,
    imgH: layout.imgH,
    gridW: geo.gridW,
    gridH: geo.gridH,
  };
  const catColor = new Map(doc.categories.map((c) => [c.id, c.color]));

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, layout.width, layout.totalH);

  if (opts.title) {
    ctx.fillStyle = "#0e3b43";
    ctx.font = "700 44px 'Noto Sans TC',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.title, layout.width / 2, layout.titleH / 2, layout.width - 80);
  }

  ctx.save();
  ctx.translate(layout.padX, layout.titleH + layout.padY);

  if (opts.mode === "plan" || opts.mode === "overlay") {
    drawPlanFill(ctx, doc, dims, opts.baseOpacity / 100);
  }
  if (opts.mode !== "plan") {
    drawActualFill(ctx, geo, dims, opts.actualOpacity);
  }
  if (opts.showGrid) drawGridLines(ctx, geo, dims, opts.mode !== "plan");
  if (opts.mode !== "plan") {
    drawBandCells(ctx, geo, opts.actualOpacity);
    if (opts.showGrid) drawBandGridLines(ctx, doc, dims);
    drawFeatureBorders(ctx, geo, dims);
  }
  drawWallLines(ctx, doc, dims, false);

  if (opts.mode !== "plan" && !opts.omitLabels) {
    for (const f of layout.features) {
      const num = numbers[f.id];
      const icon = facilityById(f.facility)?.icon;
      if (!num && !icon) continue;
      const rr = geo.ch * 0.75;
      for (const [cx, cy] of geo.featureLabelAnchors(f.id)) {
        if (icon) {
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "rgba(14,59,67,.35)";
          ctx.lineWidth = rr * 0.12;
          ctx.beginPath();
          ctx.arc(cx, cy, rr * 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.font = `${rr * 1.6}px 'Noto Sans TC',sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon, cx, cy + rr * 0.05);
        } else {
          ctx.fillStyle = "#0e3b43";
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = `700 ${geo.ch * 0.9}px 'Noto Sans TC',sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(num), cx, cy + geo.ch * 0.03);
        }
      }
    }
  }
  ctx.restore();

  drawLegend(ctx, layout, doc);
  drawList(ctx, layout, catColor, new Map(doc.categories.map((c) => [c.id, c.name])), numbers);
  ctx.restore();
}

function drawLegend(ctx: Ctx2D, layout: ExportLayout, doc: MapDoc): void {
  const y = layout.mapH;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, y, layout.width, layout.legendH);
  ctx.strokeStyle = "#cad4d5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(layout.width, y + 0.5);
  ctx.stroke();
  ctx.fillStyle = "#0e3b43";
  ctx.font = "700 27px 'Noto Sans TC',sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(layout.opts.mode === "plan" ? "顏色圖例（規劃）" : "顏色圖例（實際）", 36, y + 40);

  const colW = (layout.width - 72) / EXPORT_COLS;
  layout.legendItems.forEach((item, i) => {
    const x = 36 + (i % EXPORT_COLS) * colW;
    const yy = y + 83 + Math.floor(i / EXPORT_COLS) * 48;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, yy - 21, 29, 29);
    ctx.strokeStyle = "rgba(0,0,0,.22)";
    ctx.strokeRect(x + 0.5, yy - 20.5, 28, 28);
    ctx.fillStyle = "#203236";
    ctx.font = "600 21px 'Noto Sans TC',sans-serif";
    ctx.fillText(item.name, x + 41, yy + 2, colW - 49);
  });

  // 設施 icon 圖例（若有）
  const facs = FACILITIES.filter((fa) => doc.features.some((f) => f.facility === fa.id));
  if (facs.length) {
    const rows = Math.ceil(layout.legendItems.length / EXPORT_COLS);
    let fy = y + 83 + rows * 48 + 8;
    ctx.fillStyle = "#0e3b43";
    ctx.font = "700 22px 'Noto Sans TC',sans-serif";
    ctx.fillText("設施", 36, fy);
    fy += 30;
    facs.forEach((fa, i) => {
      const x = 36 + (i % EXPORT_COLS) * colW;
      const yy = fy + Math.floor(i / EXPORT_COLS) * 40;
      ctx.font = "26px 'Noto Sans TC',sans-serif";
      ctx.fillText(fa.icon, x, yy + 4);
      ctx.fillStyle = "#203236";
      ctx.font = "600 20px 'Noto Sans TC',sans-serif";
      ctx.fillText(fa.label, x + 38, yy, colW - 46);
      ctx.fillStyle = "#0e3b43";
    });
  }
}

function drawList(
  ctx: Ctx2D,
  layout: ExportLayout,
  catColor: Map<string, string>,
  catName: Map<string, string>,
  numbers: Record<string, number>,
): void {
  if (!layout.opts.includeList) return;
  const top = layout.mapH + layout.legendH;
  const pad = 32;
  const colW = (layout.width - pad * 2) / EXPORT_COLS;

  ctx.fillStyle = "#f7f9f9";
  ctx.fillRect(0, top, layout.width, layout.listH);
  ctx.strokeStyle = "#cad4d5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, top + 0.5);
  ctx.lineTo(layout.width, top + 0.5);
  ctx.stroke();
  ctx.fillStyle = "#0e3b43";
  ctx.font = "700 34px 'Noto Sans TC',sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("對照清單", pad, top + 45);

  if (!layout.features.length) {
    ctx.fillStyle = "#627579";
    ctx.font = "22px 'Noto Sans TC',sans-serif";
    ctx.fillText("尚無資料", pad, top + 94);
    return;
  }

  for (let col = 0; col < EXPORT_COLS; col++) {
    let y = top + 67;
    const cellX = pad + col * colW;
    for (const { feature, lines, height } of layout.listColumns[col]!) {
      const x = cellX + 9;
      const num = numbers[feature.id];
      const color = catColor.get(feature.category) ?? "#D9DEE0";
      const nameY = y + (lines.length > 1 ? 22 : 25);
      const catY = y + (lines.length > 1 ? 79 : 52);

      ctx.fillStyle = hexA(color, 0.14);
      ctx.fillRect(cellX, y, colW, height);
      ctx.strokeStyle = "rgba(90,110,114,.24)";
      ctx.strokeRect(cellX + 0.5, y + 0.5, colW - 1, height - 1);

      ctx.fillStyle = "#0e3b43";
      ctx.beginPath();
      ctx.arc(x + 20, y + height / 2, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 19px 'Noto Sans TC',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(num ?? ""), x + 20, y + height / 2);

      ctx.fillStyle = "#1c2b2e";
      ctx.font = "600 27px 'Noto Sans TC',sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      lines.forEach((line, i) => ctx.fillText(line, x + 50, nameY + i * 28, colW - 70));

      ctx.fillStyle = "#53676b";
      ctx.font = "21px 'Noto Sans TC',sans-serif";
      ctx.fillText(catName.get(feature.category) ?? "", x + 50, catY, colW - 70);

      y += height;
    }
  }
}
