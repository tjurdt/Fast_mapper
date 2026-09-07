/**
 * Tool 介面 —— 這是「持續加功能」的主要接縫。
 * 新工具 = 新增一個檔案實作 Tool + 在 registry.ts 註冊。
 * 工具只透過 ToolContext.actions 改狀態，不直接碰 MapDoc / store。
 */
import type { MapGeometry } from "../../core/geometry";
import type { CellKey } from "../../core/types";
import type { ViewSettings } from "../../model/schema";
import type { GesturePoint } from "../gestures";

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
  selectRect(rect: readonly [number, number, number, number], add?: boolean): void;
  clearSelection(): void;
  eraseSelection(): void;
  inspectFeature(id: string | null): void;
  addWall(seg: { ax: number; ay: number; bx: number; by: number }): void;
  beginEditCut(cutId: string | null): void;
  /** 開啟指定分類 sheet（Phase 5 接 UI；在那之前可 no-op）。 */
  openAssignSheet(): void;
  /** 開啟單格細節 sheet。 */
  openCellDetail(k: CellKey): void;
}

/** 只影響渲染的暫時狀態。 */
export interface TransientActions {
  setDragRect(rect: readonly [number, number, number, number] | null): void;
  setGhostCut(seg: readonly [number, number, number, number] | null): void;
}

export interface Tool {
  id: string;
  /** i18n key；UI 顯示用。 */
  labelKey: string;
  onTap?(ctx: ToolContext, p: ResolvedPoint): void;
  onLongPress?(ctx: ToolContext, p: ResolvedPoint): void;
  onDragStart?(ctx: ToolContext, from: ResolvedPoint): void;
  onDrag?(ctx: ToolContext, from: ResolvedPoint, to: ResolvedPoint): void;
  onDragEnd?(ctx: ToolContext, from: ResolvedPoint, to: ResolvedPoint): void;
  /** 進入 / 離開此工具時。 */
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
}
