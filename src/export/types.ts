export type ExportMode = "plan" | "overlay" | "actual";
export type ImageFormat = "png" | "svg" | "pdf";

export interface ExportOptions {
  /** plan：只底圖；overlay：底圖 + 實際；actual：只實際。 */
  mode: ExportMode;
  /** 規劃層 / 底圖透明度 0..100。 */
  baseOpacity: number;
  /** 實際標記透明度 0..1（來自專案 view.fillA / 100）。 */
  actualOpacity: number;
  showGrid: boolean;
  /** 不畫 feature 編號徽章。 */
  omitLabels: boolean;
  /** 圖片下方附 feature 對照清單。 */
  includeList: boolean;
  /** 在圖片上方加標題（地圖名稱）。空字串 = 不加。 */
  title: string;
}

export function normalizeOptions(o: Partial<ExportOptions>): ExportOptions {
  const mode: ExportMode = o.mode === "plan" || o.mode === "actual" ? o.mode : "overlay";
  const omitLabels = mode !== "plan" && !!o.omitLabels;
  return {
    mode,
    baseOpacity: Math.min(100, Math.max(0, Number.isFinite(o.baseOpacity) ? (o.baseOpacity as number) : 90)),
    actualOpacity: Number.isFinite(o.actualOpacity) ? (o.actualOpacity as number) : 0.8,
    showGrid: o.showGrid !== false,
    omitLabels,
    includeList: mode !== "plan" && !omitLabels && !!o.includeList,
    title: typeof o.title === "string" ? o.title.trim() : "",
  };
}

export interface ExportResult {
  bytes: Uint8Array | string;
  mime: string;
  ext: string;
}
