/**
 * Tool 介面 —— 這是「持續加功能」的主要接縫。
 * 新工具 = 新增一個檔案實作 Tool + 在 registry.ts 註冊。
 * 工具只透過 ToolContext.actions 改狀態，不直接碰 MapDoc / store。
 */
import type { MapGeometry } from "../../core/geometry";
import type { CellKey } from "../../core/types";
import type { ViewSettings } from "../../model/schema";
import type { GesturePoint } from "../gestures";

export type ImgRect = readonly [number, number, number, number];

/** 一個手勢點，已解析出影像座標 / 格鍵 / 最近格線交點。 */
export interface ResolvedPoint {
  stage: GesturePoint;
  img: { x: number; y: number };
  cell: CellKey;
  vertex: { x: number; y: number };
}

export interface ToolContext {
  geo: MapGeometry;
  view: ViewSettings;
  selection: ReadonlySet<CellKey>;
  editingCutId: string | null;
  activeFeatureId: string | null;
  resolve(p: GesturePoint): ResolvedPoint;
  /** 影像單位容差（約等於 26 螢幕像素），給「靠近某條線」判定用。 */
  hitTolerance(): number;
  actions: ToolActions;
  transient: TransientActions;
}

/** 改文件 / 選取的行為，由 store 實作。 */
export interface ToolActions {
  toggleCell(k: CellKey): void;
  setSelection(keys: Iterable<CellKey>): void;
  selectRect(rect: ImgRect, add?: boolean): void;
  clearSelection(): void;
  eraseSelection(): void;
  inspectFeature(id: string | null): void;
  addWall(seg: { ax: number; ay: number; bx: number; by: number }): void;
  beginEditCut(cutId: string | null): void;
  moveCutEndpoint(cutId: string, end: "a" | "b", x: number, y: number): void;
  /** 封閉區洪水框選；失敗回傳原因字串。 */
  selectEnclosed(x: number, y: number): { ok: boolean; reason?: string };
  focusFeature(id: string): void;
  /** 「選取」模式：切換牆的選取狀態 / 選整個命名區域 / 框選物件 / 記錄貼上錨點。 */
  toggleCutSelected(cutId: string): void;
  selectWholeFeature(id: string, additive: boolean): void;
  objSelectRect(rect: ImgRect, additive: boolean): void;
  setPasteAnchor(cell: CellKey): void;
  toast(message: string): void;
  /** 開啟指定分類 sheet。 */
  openAssignSheet(): void;
  /** 開啟單格細節 sheet。 */
  openCellDetail(k: CellKey): void;
}

/** 只影響渲染的暫時狀態。 */
export interface TransientActions {
  setDragRect(rect: ImgRect | null): void;
  setGhostCut(seg: ImgRect | null): void;
}

export interface Tool {
  id: string;
  /** i18n key；UI 顯示用。 */
  labelKey: string;
  /** 提示文字 i18n key（顯示在地圖上的 hint pill）。 */
  hintKey?: string;
  onTap?(ctx: ToolContext, p: ResolvedPoint): void;
  onLongPress?(ctx: ToolContext, p: ResolvedPoint): void;
  onDragStart?(ctx: ToolContext, from: ResolvedPoint): void;
  onDrag?(ctx: ToolContext, from: ResolvedPoint, to: ResolvedPoint): void;
  onDragEnd?(ctx: ToolContext, from: ResolvedPoint, to: ResolvedPoint): void;
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
}
