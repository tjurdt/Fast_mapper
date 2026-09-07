/** 匯出入口。format: png / svg / pdf / xlsx。 */
import type { MapGeometry } from "../core/geometry";
import type { Project } from "../model/schema";
import { computeLayout, exportScaleFor } from "./layout";
import { renderComposite } from "./composite";
import { buildSvg } from "./svg";
import { buildXlsx } from "./xlsx";
import { buildRows } from "./rows";
import { buildPdf, dataUrlToBytes } from "./pdf";
import { utf8 } from "./zip";
import { normalizeOptions, type ExportOptions } from "./types";

export type { ExportOptions, ExportMode, ImageFormat } from "./types";
export { normalizeOptions } from "./types";

export interface ExportFile {
  bytes: Uint8Array;
  mime: string;
  filename: string;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function canvasToBytes(cv: HTMLCanvasElement, type: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    cv.toBlob(
      (b) =>
        b
          ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)))
          : reject(new Error("canvas export failed")),
      type,
    ),
  );
}

export async function exportImage(
  project: Project,
  geo: MapGeometry,
  numbers: Record<string, number>,
  format: "png" | "svg" | "pdf",
  optsIn: Partial<ExportOptions>,
): Promise<ExportFile> {
  const opts = normalizeOptions({
    actualOpacity: project.view.fillA / 100,
    showGrid: project.view.showGrid,
    ...optsIn,
  });
  const layout = computeLayout(project.doc, geo, numbers, opts);
  const base = `${project.name || "map"}-${stamp()}`;

  if (format === "svg") {
    return {
      bytes: utf8(buildSvg(project.doc, geo, numbers, layout)),
      mime: "image/svg+xml",
      filename: `${base}.svg`,
    };
  }

  const scale = exportScaleFor(layout);
  const cv = document.createElement("canvas");
  cv.width = Math.round(layout.width * scale);
  cv.height = Math.round(layout.totalH * scale);
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  renderComposite(ctx, scale, layout, project.doc, geo, numbers);

  if (format === "png") {
    return { bytes: await canvasToBytes(cv, "image/png"), mime: "image/png", filename: `${base}.png` };
  }
  const jpeg = dataUrlToBytes(cv.toDataURL("image/jpeg", 0.94));
  return { bytes: buildPdf(jpeg, cv.width, cv.height), mime: "application/pdf", filename: `${base}.pdf` };
}

export function exportXlsx(project: Project, geo: MapGeometry, numbers: Record<string, number>): ExportFile {
  const v = project.vocabulary;
  const rows = buildRows(project.doc, geo, numbers, {
    number: "編號",
    feature: v.feature,
    category: v.category,
  });
  return {
    bytes: buildXlsx(v.feature + "對照表", rows),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${project.name || "map"}-${stamp()}.xlsx`,
  };
}

export function downloadFile(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
