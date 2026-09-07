/** 匯出版面計算。移植自 legacy exportLayout / exportScaleFor / wrapSvgText / exportOrderedShops。 */
import type { Category, Feature, MapDoc, PlanLayer } from "../core/types";
import type { MapGeometry } from "../core/geometry";
import { clamp } from "../core/poly";
import type { ExportOptions } from "./types";

export const EXPORT_COLS = 5;
export const EXPORT_LEGEND_H = 174;
const EXPORT_LIST_ROW_H = 65;
const EXPORT_LIST_ROW_WRAP_H = 92;

export function padX(cw: number): number {
  return cw * 5;
}
export function padY(ch: number): number {
  return ch * 5;
}

/** 依編號排序、只保留有可見格的 feature。 */
export function orderedFeatures(doc: MapDoc, geo: MapGeometry, numbers: Record<string, number>): Feature[] {
  const idx = geo.featureKeyIndex();
  return doc.features
    .filter((f) => (idx.get(f.id)?.length ?? 0) > 0)
    .sort((a, b) => (numbers[a.id] ?? 999) - (numbers[b.id] ?? 999));
}

export function wrapText(text: string, maxChars: number, maxLines = 2): string[] {
  const chars = Array.from(String(text || ""));
  const lines: string[] = [];
  for (let i = 0; i < chars.length && lines.length < maxLines; i += maxChars) {
    lines.push(chars.slice(i, i + maxChars).join(""));
  }
  if (lines.join("").length < chars.length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1]!.slice(0, -1) + "…";
  }
  return lines.length ? lines : [""];
}

export interface ExportLayout {
  opts: ExportOptions;
  features: Feature[];
  listColumns: { feature: Feature; lines: string[]; height: number }[][];
  legendItems: (Category | PlanLayer)[];
  width: number;
  mapH: number;
  titleH: number;
  padX: number;
  padY: number;
  legendH: number;
  listH: number;
  totalH: number;
  imgW: number;
  imgH: number;
}

export function computeLayout(
  doc: MapDoc,
  geo: MapGeometry,
  numbers: Record<string, number>,
  opts: ExportOptions,
): ExportLayout {
  const cw = geo.cw;
  const ch = geo.ch;
  const imgW = geo.gridW * cw;
  const imgH = geo.gridH * ch;
  const px = padX(cw);
  const py = padY(ch);

  const features = orderedFeatures(doc, geo, numbers);
  const rowsPerCol = Math.max(1, Math.ceil(features.length / EXPORT_COLS));
  const width = imgW + px * 2;
  const titleH = opts.title ? 96 : 0;
  const mapH = titleH + imgH + py * 2;

  const listColumns = Array.from({ length: EXPORT_COLS }, (_, col) =>
    features.slice(col * rowsPerCol, (col + 1) * rowsPerCol).map((feature) => {
      const lines = wrapText(feature.name, 13, 2);
      return { feature, lines, height: lines.length > 1 ? EXPORT_LIST_ROW_WRAP_H : EXPORT_LIST_ROW_H };
    }),
  );

  const legendItems: (Category | PlanLayer)[] = opts.mode === "plan" ? doc.planLayers : doc.categories;
  const legendRows = Math.max(1, Math.ceil(legendItems.length / EXPORT_COLS));
  const facilityCount = new Set(doc.features.map((f) => f.facility).filter(Boolean)).size;
  const facilityH = facilityCount ? 38 + Math.ceil(facilityCount / EXPORT_COLS) * 40 : 0;
  const legendH = Math.max(EXPORT_LEGEND_H, 83 + (legendRows - 1) * 48 + 36) + facilityH;

  const listContentH = features.length
    ? Math.max(...listColumns.map((c) => c.reduce((s, r) => s + r.height, 0)))
    : 52;
  const listH = opts.includeList ? 67 + listContentH + 20 : 0;

  return {
    opts,
    features,
    listColumns,
    legendItems,
    width,
    mapH,
    titleH,
    padX: px,
    padY: py,
    legendH,
    listH,
    totalH: mapH + legendH + listH,
    imgW,
    imgH,
  };
}

export function exportScaleFor(layout: ExportLayout): number {
  // 上限拉低 → 大地圖匯出（光柵化 + PNG 編碼）不會卡太久，畫質仍足夠列印
  const byPixels = Math.sqrt(9_000_000 / (layout.width * layout.totalH));
  const bySide = Math.min(12000 / layout.width, 12000 / layout.totalH);
  return clamp(Math.min(1.6, byPixels, bySide), 0.6, 1.6);
}
