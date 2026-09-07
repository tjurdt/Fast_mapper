/**
 * 唯一狀態源。元件透過 signals 訂閱；改文件一律走這裡的 action，
 * 由 action 負責 history、重算 geometry/numbers、以及防抖存檔。
 */
import { batch, computed, signal } from "@preact/signals";
import type { CellKey, CellPoly, MapDoc } from "../core/types";
import { MapGeometry } from "../core/geometry";
import { selectEnclosedRegion } from "../core/enclosed";
import { computeNumbers } from "../core/numbering";
import { DocHistory } from "../model/commands";
import { cloneDoc, loadProject, serializeProject } from "../model/document";
import { createProject, type Project, type ViewSettings } from "../model/schema";
import { templateById, TEMPLATES } from "../templates";
import {
  createStorageAdapter,
  META_LAST_PROJECT,
  META_LEGACY_IMPORTED,
  type ProjectSummary,
  type StorageAdapter,
} from "../persistence";
import { readLegacyProject, projectFromLegacyState, type LegacyState } from "../model/legacy";
import {
  addCategory,
  addPlanLayer,
  addWall,
  assignCells,
  buildClipboard,
  copyObjects,
  copySelection,
  cycleCutSide,
  deleteCategory,
  deleteCut,
  deleteFeature,
  deleteObjects,
  deletePlanLayer,
  eraseCells,
  moveCutEndpoint,
  moveObjects,
  moveSelection,
  pasteObjects,
  renameFeature,
  toggleFeatureCell,
  setFeatureCategory,
  setFeatureFacility,
  setGridSize,
  setCutDepth,
  stepCutDepth,
  toggleCutWall,
  updateCategory,
  updatePlanLayer,
  type AssignArgs,
  type Clipboard,
  type MoveDir,
  type MoveResult,
  type ObjectSelection,
} from "../model/edits";
import type { Scene } from "../render/scene";
import { exportImage, exportXlsx, downloadFile, type ExportOptions } from "../export";

import { uiEvents } from "./events";
export { uiEvents };

// ---- signals ----

export const project = signal<Project | null>(null);
export const projectList = signal<ProjectSummary[]>([]);
export const ready = signal(false);

export const selection = signal<ReadonlySet<CellKey>>(new Set());
/** 封閉區框選帶來的每格裁切形狀（跟 selection 平行）。 */
export const selectionShapes = signal<ReadonlyMap<CellKey, CellPoly | null>>(new Map());
/** 「選取」模式下被選中的牆 / 切線 id。 */
export const selectedCutIds = signal<ReadonlySet<string>>(new Set());
export const inspectedFeature = signal<string | null>(null);
/** 舊筆刷用的目標命名區域（保留供內部）。 */
export const activeFeatureId = signal<string | null>(null);
export const activeToolId = signal<string>("grid");
/** 貼上錨點（「選取」模式最後點的格）。 */
export const pasteAnchor = signal<[number, number] | null>(null);

let clipboard: Clipboard | null = null;
export const clipboardFilled = signal(false);
/** 「選取」模式的複製→貼上流程：true 時動作列只剩 貼上／取消複製／完成。 */
export const pasteMode = signal(false);

/** 進入貼上流程：把目前選取存進剪貼簿。 */
export function startPasteMode(): boolean {
  if (!clipboardCopy(false)) return false;
  batch(() => {
    pasteMode.value = true;
    pasteAnchor.value = null; // 進入貼上流程 → 先清掉舊錨點，逼使用者點一個位置
  });
  return true;
}
export function exitPasteMode(): void {
  batch(() => {
    pasteMode.value = false;
    pasteAnchor.value = null;
  });
}
/** 是否已標記貼上位置。 */
export const hasPasteAnchor = computed(() => pasteMode.value && pasteAnchor.value !== null);

export function setTool(id: string): void {
  if (activeToolId.value === id) return;
  activeToolId.value = id;
  pasteMode.value = false;
  clearSelection();
  editingCutId.value = null;
  ghostCut.value = null;
  activeFeatureId.value = null;
  if (listReveal.value !== null) revealFeatureInList(null);
  else inspectedFeature.value = null;
}

/** 只影響渲染、不進歷史的暫時狀態（拖曳框、幽靈切線、正在編輯的切線）。 */
export const dragRect = signal<readonly [number, number, number, number] | null>(null);
export const ghostCut = signal<readonly [number, number, number, number] | null>(null);
export const editingCutId = signal<string | null>(null);
/** 拖曳切線端點時的即時預覽（格為單位）；放手才 commit 進文件。 */
export const cutDragPreview = signal<readonly [number, number, number, number] | null>(null);

export const ui = {
  legendOpen: signal(false),
  listCollapsed: signal(false),
};

export const geometry = computed(() => {
  const p = project.value;
  return p ? new MapGeometry(p.doc) : null;
});

export const numbers = computed<Record<string, number>>(() => {
  const p = project.value;
  const geo = geometry.value;
  return p && geo ? computeNumbers(geo, p.doc.features) : {};
});

export const canUndo = signal(false);
export const canRedo = signal(false);

/** 一次重繪所需的全部輸入；render engine 訂閱這個。 */
export const scene = computed<Scene | null>(() => {
  const p = project.value;
  const geo = geometry.value;
  if (!p || !geo) return null;
  return {
    doc: p.doc,
    geo,
    view: p.view,
    numbers: numbers.value,
    selection: selection.value,
    highlightFeature: inspectedFeature.value ?? activeFeatureId.value,
    cutMode: activeToolId.value === "cut",
    dragRect: dragRect.value,
    ghostCut: ghostCut.value,
    selectionShapes: selectionShapes.value,
    selectedCutIds: selectedCutIds.value,
    editingCut: editingCutId.value ? (p.doc.cuts.find((c) => c.id === editingCutId.value) ?? null) : null,
    cutDragPreview: cutDragPreview.value,
    pasteMarker: pasteMode.value ? pasteAnchor.value : null,
  };
});

// ---- 內部 ----

let adapter: StorageAdapter = createStorageAdapter();
const history = new DocHistory();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function _setAdapterForTests(a: StorageAdapter): void {
  adapter = a;
}

function syncHistoryFlags(): void {
  canUndo.value = history.canUndo;
  canRedo.value = history.canRedo;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, 400);
}

export async function persistNow(): Promise<void> {
  const p = project.value;
  if (!p) return;
  await adapter.saveProject(p);
  await adapter.setMeta(META_LAST_PROJECT, p.id);
}

function setProject(p: Project, { resetHistory = true } = {}): void {
  batch(() => {
    project.value = p;
    selection.value = new Set();
    inspectedFeature.value = null;
    ui.listCollapsed.value = false;
  });
  if (resetHistory) history.reset(p.doc);
  syncHistoryFlags();
}

// ---- actions ----

/**
 * 套用一次文件變更。fn 收到深拷貝的 doc，回傳新 doc（或原地改後回傳 void）。
 * 回傳 `null` 代表「這次不算數」—— 不更新、不進歷史（給失敗的移動 / 複製用）。
 */
export function editDoc(fn: (doc: MapDoc) => MapDoc | void | null, opts: { record?: boolean } = {}): void {
  const p = project.value;
  if (!p) return;
  const draft = cloneDoc(p.doc);
  const ret = fn(draft);
  if (ret === null) return; // 明確 no-op
  const next = ret ?? draft;
  const updated: Project = { ...p, doc: next, updatedAt: Date.now() };
  project.value = updated;
  if (opts.record !== false) history.record(next);
  syncHistoryFlags();
  schedulePersist();
}

export function undo(): void {
  const doc = history.undo();
  if (!doc) return;
  applyHistoryDoc(doc);
}

export function redo(): void {
  const doc = history.redo();
  if (!doc) return;
  applyHistoryDoc(doc);
}

function applyHistoryDoc(doc: MapDoc): void {
  const p = project.value;
  if (!p) return;
  batch(() => {
    project.value = { ...p, doc, updatedAt: Date.now() };
    selection.value = new Set();
    inspectedFeature.value = null;
  });
  syncHistoryFlags();
  schedulePersist();
}

export function setView(patch: Partial<ViewSettings>): void {
  const p = project.value;
  if (!p) return;
  project.value = { ...p, view: { ...p.view, ...patch }, updatedAt: Date.now() };
  schedulePersist();
}

export function renameProject(name: string): void {
  const p = project.value;
  if (!p) return;
  project.value = { ...p, name: name.trim() || p.name, updatedAt: Date.now() };
  schedulePersist();
  void refreshProjectList();
}

export function setSelection(keys: Iterable<CellKey>): void {
  selection.value = new Set(keys);
  if (selectionShapes.value.size) selectionShapes.value = new Map();
}

export function clearSelection(): void {
  if (selection.value.size) selection.value = new Set();
  if (selectionShapes.value.size) selectionShapes.value = new Map();
  if (selectedCutIds.value.size) selectedCutIds.value = new Set();
  if (pasteMode.value) pasteMode.value = false;
}

export function toggleCell(k: CellKey): void {
  const next = new Set(selection.value);
  if (next.has(k)) next.delete(k);
  else next.add(k);
  selection.value = next;
  if (selectionShapes.value.size) selectionShapes.value = new Map();
}

/** 依影像矩形框選（一般格 + actual 視圖的 band 格）。add=false 時取代選取。 */
export function selectRect(rect: readonly [number, number, number, number], add = false): void {
  const geo = geometry.value;
  const p = project.value;
  if (!geo || !p) return;
  const keys = geo.cellsInRect(rect[0], rect[1], rect[2], rect[3], p.view.view === "actual");
  const next = add ? new Set(selection.value) : new Set<CellKey>();
  for (const k of keys) next.add(k);
  selection.value = next;
  if (selectionShapes.value.size) selectionShapes.value = new Map();
}

/** 點在被牆圍住的空白處 → 選取整塊封閉區域（邊界格裁成斜切形狀）。 */
export function selectEnclosed(x: number, y: number): { ok: boolean; reason?: string } {
  const geo = geometry.value;
  const p = project.value;
  if (!geo || !p) return { ok: false };
  const res = selectEnclosedRegion(geo, x, y, p.view.view);
  if ("error" in res) return { ok: false, reason: res.error };
  batch(() => {
    selection.value = new Set(res.keys);
    selectionShapes.value = res.shapes;
    editingCutId.value = null;
  });
  return { ok: true };
}

export function assignSelection(args: AssignArgs): void {
  if (!selection.value.size) return;
  const keys = [...selection.value];
  const shapes = selectionShapes.value.size ? new Map(selectionShapes.value) : null;
  batch(() => {
    editDoc((doc) => assignCells(doc, keys, { ...args, shapes }));
    clearSelection();
  });
}

export interface OverlapMark {
  type: "feature" | "category";
  id: string;
  name: string;
  color: string;
  count: number;
}

/** 目前選取的格子（band 格展開到底下的一般格）重疊到的既有命名區域 / 分類，依格數排序。 */
export function selectionOverlapMarks(): OverlapMark[] {
  const geo = geometry.value;
  const p = project.value;
  if (!geo || !p) return [];
  const src = new Set<CellKey>();
  for (const k of selection.value) {
    if (k.charCodeAt(0) === 66) for (const nk of geo.gridKeysUnderQuad(geo.keyQuad(k))) src.add(nk);
    else src.add(k);
  }
  const catColor = new Map(p.doc.categories.map((c) => [c.id, c.color]));
  const featById = new Map(p.doc.features.map((f) => [f.id, f]));
  const acc = new Map<string, OverlapMark>();
  for (const k of src) {
    const d = p.doc.cells[k];
    if (!d) continue;
    if (d.feature && featById.has(d.feature)) {
      const f = featById.get(d.feature)!;
      const e =
        acc.get("f:" + f.id) ??
        acc
          .set("f:" + f.id, {
            type: "feature",
            id: f.id,
            name: f.name,
            color: catColor.get(f.category) ?? "#ccc",
            count: 0,
          })
          .get("f:" + f.id)!;
      e.count++;
    } else if (d.cat && catColor.has(d.cat)) {
      const e =
        acc.get("c:" + d.cat) ??
        acc
          .set("c:" + d.cat, {
            type: "category",
            id: d.cat,
            name: p.doc.categories.find((c) => c.id === d.cat)!.name,
            color: catColor.get(d.cat)!,
            count: 0,
          })
          .get("c:" + d.cat)!;
      e.count++;
    }
  }
  return [...acc.values()].sort((a, b) => b.count - a.count);
}

export function eraseSelection(): void {
  if (!selection.value.size) return;
  const keys = [...selection.value];
  batch(() => {
    editDoc((doc) => eraseCells(doc, keys));
    clearSelection();
  });
}

export function moveSelectionBy(dir: MoveDir): { ok: boolean; reason?: string } {
  const p = project.value;
  if (!p || !selection.value.size) return { ok: false, reason: "沒有選取" };
  const keys = [...selection.value];
  let result: MoveResult = { ok: false };
  batch(() => {
    editDoc((doc) => {
      result = moveSelection(doc, keys, dir);
      return result.ok ? doc : null;
    });
    if (result.ok && result.keys) selection.value = new Set(result.keys);
  });
  return { ok: result.ok, ...(result.reason ? { reason: result.reason } : {}) };
}

const DELTA: Record<MoveDir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

/** 把選取的實際標記複製到某方向第 n 格處。 */
export function copySelectionBy(dir: MoveDir, distance: number): { ok: boolean; reason?: string } {
  const p = project.value;
  const n = Math.max(1, Math.round(distance));
  if (!p || !selection.value.size) return { ok: false, reason: "沒有選取" };
  const [ur, uc] = DELTA[dir];
  const keys = [...selection.value];
  let result: MoveResult = { ok: false };
  batch(() => {
    editDoc((doc) => {
      result = copySelection(doc, keys, ur * n, uc * n);
      return result.ok ? doc : null;
    });
    if (result.ok && result.keys) selection.value = new Set(result.keys);
  });
  return { ok: result.ok, ...(result.reason ? { reason: result.reason } : {}) };
}

export function inspectFeature(id: string | null): void {
  inspectedFeature.value = id;
}

/** 檢視工具點到的店家：右側清單分頁篩出它（並在手機展開面板）；null 清除並收回。 */
export const listReveal = signal<string | null>(null);
let revealClearTimer: ReturnType<typeof setTimeout> | null = null;
export function revealFeatureInList(id: string | null): void {
  if (revealClearTimer) {
    clearTimeout(revealClearTimer);
    revealClearTimer = null;
  }
  if (id) {
    batch(() => {
      listReveal.value = id;
      inspectedFeature.value = id;
    });
    uiEvents.emit("panel-open");
    return;
  }
  // 收合：先讓抽屜開始關（動畫），等它關完再清 filter，避免清單先展開再收合的閃動
  uiEvents.emit("panel-close");
  const mobile = typeof matchMedia === "function" && matchMedia("(max-width: 959px)").matches;
  const clear = () => {
    revealClearTimer = null;
    batch(() => {
      listReveal.value = null;
      inspectedFeature.value = null;
    });
  };
  if (mobile) revealClearTimer = setTimeout(clear, 260);
  else clear();
}

// ---- 「選取」模式：整體移動 / 複製 / 刪除 / 剪貼簿 ----

function currentObjSelection(): ObjectSelection {
  return { cutIds: [...selectedCutIds.value], cellKeys: [...selection.value] };
}
function hasObjSelection(): boolean {
  return selection.value.size > 0 || selectedCutIds.value.size > 0;
}

export function toggleCutSelected(id: string): void {
  const next = new Set(selectedCutIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedCutIds.value = next;
}

/**
 * 把種子牆 / 種子命名區域展開成完整「group」：
 *  - 牆 → 其斜格上的所有店家 → 那些店家的所有格
 *  - 店家 → 若跨到斜格，連同該斜格所屬的牆
 * 直到收斂。回傳 { cells（一般格）, cuts }。
 */
function expandObjectGroup(
  seedCuts: Iterable<string>,
  seedFeatures: Iterable<string>,
): { cells: Set<CellKey>; cuts: Set<string> } {
  const geo = geometry.value;
  const cuts = new Set(seedCuts);
  const feats = new Set(seedFeatures);
  const cells = new Set<CellKey>();
  if (!geo) return { cells, cuts };

  let changed = true;
  while (changed) {
    changed = false;
    for (const cid of [...cuts]) {
      for (const f of geo.featuresOnCut(cid)) {
        if (!feats.has(f)) {
          feats.add(f);
          changed = true;
        }
      }
    }
    for (const fid of [...feats]) {
      for (const k of geo.featureKeys(fid)) {
        if (k.charCodeAt(0) === 66) {
          const cid = k.slice(1, k.indexOf("_", 1));
          if (!cuts.has(cid)) {
            cuts.add(cid);
            changed = true;
          }
        }
      }
    }
  }
  for (const fid of feats) {
    for (const k of geo.featureKeys(fid)) if (k.charCodeAt(0) !== 66) cells.add(k);
  }
  return { cells, cuts };
}

/** 點選一個物件（牆或店家）→ 選取整個 group。toggle=true 時再點取消整組。 */
export function pickObjectGroup(
  seed: { cutId?: string; featureId?: string },
  additive: boolean,
  toggle: boolean,
): void {
  const { cells, cuts } = expandObjectGroup(
    seed.cutId ? [seed.cutId] : [],
    seed.featureId ? [seed.featureId] : [],
  );
  const curCells = new Set(selection.value);
  const curCuts = new Set(selectedCutIds.value);
  const alreadyIn =
    (seed.cutId && curCuts.has(seed.cutId)) || (seed.featureId && [...cells].some((k) => curCells.has(k)));

  batch(() => {
    if (toggle && alreadyIn) {
      for (const k of cells) curCells.delete(k);
      for (const c of cuts) curCuts.delete(c);
      selection.value = curCells;
      selectedCutIds.value = curCuts;
      return;
    }
    const nextCells = additive ? curCells : new Set<CellKey>();
    const nextCuts = additive ? curCuts : new Set<string>();
    for (const k of cells) nextCells.add(k);
    for (const c of cuts) nextCuts.add(c);
    selection.value = nextCells;
    selectedCutIds.value = nextCuts;
  });
}

/** 選取整個命名區域 group（供舊呼叫端 / 清單使用）。 */
export function selectWholeFeature(id: string, additive: boolean): void {
  pickObjectGroup({ featureId: id }, additive, false);
}

/**
 * 以「物件」為單位框選：矩形只要碰到店家的任一格或牆的線段，整個物件（連同 group）就被選。
 */
export function objSelectRect(rect: readonly [number, number, number, number], additive: boolean): void {
  const geo = geometry.value;
  if (!geo) return;
  const feats = geo.featuresInRect(rect[0], rect[1], rect[2], rect[3]);
  const seedCuts = geo.cutsInRect(rect[0], rect[1], rect[2], rect[3]);
  const { cells, cuts } = expandObjectGroup(seedCuts, feats);
  batch(() => {
    const nextCells = additive ? new Set(selection.value) : new Set<CellKey>();
    const nextCuts = additive ? new Set(selectedCutIds.value) : new Set<string>();
    for (const k of cells) nextCells.add(k);
    for (const c of cuts) nextCuts.add(c);
    selection.value = nextCells;
    selectedCutIds.value = nextCuts;
  });
}

export function setPasteAnchor(rowCol: [number, number] | null): void {
  pasteAnchor.value = rowCol;
}

export function moveObjectsBy(dx: number, dy: number): { ok: boolean; reason?: string } {
  if (!hasObjSelection()) return { ok: false, reason: "沒有選取物件" };
  const sel = currentObjSelection();
  let result: MoveResult = { ok: false };
  batch(() => {
    editDoc((doc) => {
      result = moveObjects(doc, sel, dx, dy);
      return result.ok ? doc : null;
    });
    if (result.ok && result.keys) selection.value = new Set(result.keys);
  });
  return { ok: result.ok, ...(result.reason ? { reason: result.reason } : {}) };
}

export function copyObjectsBy(dx: number, dy: number): { ok: boolean; reason?: string } {
  if (!hasObjSelection()) return { ok: false, reason: "沒有選取物件" };
  const sel = currentObjSelection();
  let res: { ok: boolean; reason?: string; cutIds: string[]; cellKeys: CellKey[] } = {
    ok: false,
    cutIds: [],
    cellKeys: [],
  };
  editDoc((doc) => {
    res = copyObjects(doc, sel, dx, dy);
    return res.ok ? doc : null;
  });
  if (res.ok) {
    batch(() => {
      selection.value = new Set(res.cellKeys);
      selectedCutIds.value = new Set(res.cutIds);
    });
  }
  return { ok: res.ok, ...(res.reason ? { reason: res.reason } : {}) };
}

export function deleteObjectsAction(): void {
  if (!hasObjSelection()) return;
  const sel = currentObjSelection();
  editDoc((doc) => deleteObjects(doc, sel));
  clearSelection();
}

export function clipboardCopy(cut: boolean): boolean {
  const p = project.value;
  if (!p || !hasObjSelection()) return false;
  clipboard = buildClipboard(p.doc, currentObjSelection());
  clipboardFilled.value = !!clipboard;
  if (cut && clipboard) {
    const sel = currentObjSelection();
    editDoc((doc) => deleteObjects(doc, sel));
    clearSelection();
  }
  return !!clipboard;
}

export function clipboardPaste(): boolean {
  if (!clipboard || !pasteAnchor.value) return false;
  const anchor = pasteAnchor.value;
  let res: { cutIds: string[]; cellKeys: CellKey[] } = { cutIds: [], cellKeys: [] };
  batch(() => {
    editDoc((doc) => {
      res = pasteObjects(doc, clipboard!, anchor[0], anchor[1]);
      return res.cutIds.length || res.cellKeys.length ? doc : null;
    });
    if (res.cutIds.length || res.cellKeys.length) {
      selection.value = new Set(res.cellKeys);
      selectedCutIds.value = new Set(res.cutIds);
    }
  });
  return res.cutIds.length > 0 || res.cellKeys.length > 0;
}

export function setFeatureFacilityAction(id: string, facility: string | null): void {
  editDoc((doc) => setFeatureFacility(doc, id, facility));
}

// ---- 舊筆刷（保留內部；UI 已改為「檢視」工具）----

export function setActiveFeature(id: string | null): void {
  activeFeatureId.value = id;
  if (id) {
    clearSelection();
    inspectedFeature.value = null;
  }
}

export function paintCell(k: CellKey): void {
  const id = activeFeatureId.value;
  if (!id) return;
  editDoc((doc) => toggleFeatureCell(doc, k, id));
}

export function paintRect(rect: readonly [number, number, number, number], erase: boolean): void {
  const id = activeFeatureId.value;
  const geo = geometry.value;
  const p = project.value;
  if (!id || !geo || !p) return;
  const keys = geo.cellsInRect(rect[0], rect[1], rect[2], rect[3], p.view.view === "actual");
  editDoc((doc) => {
    for (const k of keys) {
      const cur = doc.cells[k];
      const has = cur?.feature === id;
      if (erase ? has : !has) toggleFeatureCell(doc, k, id);
    }
    return doc;
  });
}

// ---- 切線端點拖曳 ----

export function moveCutEndpointTo(cutId: string, end: "a" | "b", x: number, y: number): void {
  editDoc((doc) => moveCutEndpoint(doc, cutId, end, x, y));
}

export function addWallSegment(seg: { ax: number; ay: number; bx: number; by: number }): string {
  let id = "";
  editDoc((doc) => {
    const r = addWall(doc, seg);
    id = r.cutId;
    return r.doc;
  });
  return id;
}

export function beginEditCut(cutId: string | null): void {
  editingCutId.value = cutId;
  if (cutDragPreview.value) cutDragPreview.value = null;
  if (cutId) clearSelection();
}

export function setCutDepthAction(cutId: string, depth: number): void {
  editDoc((doc) => setCutDepth(doc, cutId, depth));
}

export function updateCut(cutId: string, op: "depth+" | "depth-" | "side" | "wall" | "delete"): void {
  editDoc((doc) => {
    if (op === "depth+") return stepCutDepth(doc, cutId, 1);
    if (op === "depth-") return stepCutDepth(doc, cutId, -1);
    if (op === "side") return cycleCutSide(doc, cutId);
    if (op === "wall") return toggleCutWall(doc, cutId);
    return deleteCut(doc, cutId);
  });
  if (op === "delete") editingCutId.value = null;
}

// feature CRUD
export function renameFeatureAction(id: string, name: string): void {
  editDoc((doc) => renameFeature(doc, id, name));
}
export function setFeatureCategoryAction(id: string, categoryId: string): void {
  editDoc((doc) => setFeatureCategory(doc, id, categoryId));
}
export function deleteFeatureAction(id: string): void {
  editDoc((doc) => deleteFeature(doc, id));
  if (inspectedFeature.value === id) inspectedFeature.value = null;
}

// 分類 / 規劃層
export function addCategoryAction(name: string, color: string): void {
  editDoc((doc) => addCategory(doc, name, color));
}
export function updateCategoryAction(id: string, patch: { name?: string; color?: string }): void {
  editDoc((doc) => updateCategory(doc, id, patch));
}
export function deleteCategoryAction(id: string): void {
  editDoc((doc) => deleteCategory(doc, id));
}
export function addPlanLayerAction(name: string, color: string): void {
  editDoc((doc) => addPlanLayer(doc, name, color));
}
export function updatePlanLayerAction(id: string, patch: { name?: string; color?: string }): void {
  editDoc((doc) => updatePlanLayer(doc, id, patch));
}
export function deletePlanLayerAction(id: string): void {
  editDoc((doc) => deletePlanLayer(doc, id));
}
export function setGridSizeAction(w: number, h: number): void {
  editDoc((doc) => setGridSize(doc, w, h));
}

// 底圖圖片
export async function importBaseImage(file: Blob): Promise<void> {
  const p = project.value;
  if (!p) return;
  const blobId = "img" + Date.now().toString(36);
  await adapter.putBlob(blobId, file);
  editDoc((doc) => {
    doc.baseImage = { blobId, opacity: 0.6, transform: { x: 0, y: 0, scale: 1, rotation: 0 } };
    return doc;
  });
}
export async function removeBaseImage(): Promise<void> {
  const p = project.value;
  const blobId = p?.doc.baseImage?.blobId;
  editDoc((doc) => {
    delete doc.baseImage;
    return doc;
  });
  if (blobId) await adapter.deleteBlob(blobId);
}
export function setBaseImageOpacity(opacity: number): void {
  editDoc((doc) => {
    if (doc.baseImage) doc.baseImage = { ...doc.baseImage, opacity };
    return doc;
  });
}
export function setBaseImageTransform(
  patch: Partial<{ x: number; y: number; scale: number; rotation: number }>,
): void {
  editDoc((doc) => {
    if (doc.baseImage)
      doc.baseImage = { ...doc.baseImage, transform: { ...doc.baseImage.transform, ...patch } };
    return doc;
  });
}

// 匯出圖片 / Excel
export async function exportMap(
  format: "png" | "svg" | "pdf" | "xlsx",
  opts: Partial<ExportOptions> = {},
): Promise<boolean> {
  const p = project.value;
  const geo = geometry.value;
  if (!p || !geo) return false;
  try {
    const file =
      format === "xlsx"
        ? exportXlsx(p, geo, numbers.value)
        : await exportImage(p, geo, numbers.value, format, opts);
    downloadFile(file);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// JSON 備份 / 匯入 —— 底圖圖片一併以 data URI 內嵌在 `assets`
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}
function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(",", 2);
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "application/octet-stream";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportProjectJson(): Promise<string> {
  const p = project.value;
  if (!p) return "{}";
  const out = serializeProject(p) as Record<string, unknown>;
  const blobId = p.doc.baseImage?.blobId;
  if (blobId) {
    const blob = await adapter.getBlob(blobId);
    if (blob) out.assets = { [blobId]: await blobToDataUrl(blob) };
  }
  return JSON.stringify(out, null, 2);
}

export async function importProjectJson(text: string): Promise<boolean> {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    // legacy 單檔存檔（grid-market-v4）：有 zones/cells、沒有 doc/schemaVersion
    const isLegacy =
      raw && typeof raw === "object" && !raw.doc && !raw.schemaVersion && raw.cells && raw.zones;
    const p = isLegacy ? await projectFromLegacyState(raw as LegacyState) : loadProject(raw);
    const fresh: Project = { ...p, id: createProject().id, updatedAt: Date.now() };

    // 內嵌的底圖圖片 → 還原成 blob
    const assets = (raw.assets ?? null) as Record<string, string> | null;
    const bId = fresh.doc.baseImage?.blobId;
    if (assets && bId && typeof assets[bId] === "string") {
      try {
        await adapter.putBlob(bId, dataUrlToBlob(assets[bId]));
      } catch (e) {
        console.warn("restore base image failed", e);
        delete fresh.doc.baseImage;
      }
    } else if (bId && !isLegacy) {
      // 有參照但沒帶圖 → 拿掉，免得畫面卡在載入
      delete fresh.doc.baseImage;
    }

    setProject(fresh);
    await persistNow();
    await refreshProjectList();
    return true;
  } catch (e) {
    console.error("importProjectJson", e);
    return false;
  }
}

export async function refreshProjectList(): Promise<void> {
  projectList.value = await adapter.listProjects();
}

export function loadBlob(id: string): Promise<Blob | null> {
  return adapter.getBlob(id);
}

export async function openProject(id: string): Promise<boolean> {
  const p = await adapter.loadProject(id);
  if (!p) return false;
  setProject(p);
  await adapter.setMeta(META_LAST_PROJECT, id);
  return true;
}

export async function createFromTemplate(templateId: string, name?: string): Promise<Project> {
  const t = templateById(templateId) ?? TEMPLATES[0]!;
  const input = await t.build();
  const p = createProject({ ...input, ...(name ? { name } : {}) });
  setProject(p);
  await persistNow();
  await refreshProjectList();
  return p;
}

export async function deleteProject(id: string): Promise<void> {
  await adapter.deleteProject(id);
  await refreshProjectList();
  if (project.value?.id === id) {
    const first = projectList.value[0];
    if (first) await openProject(first.id);
    else project.value = null;
  }
}

export interface BootstrapResult {
  opened: boolean;
  legacyImported: boolean;
}

/** app 啟動：跑 legacy 匯入（僅一次）、載入上次開啟或最新的專案。 */
export async function bootstrap(): Promise<BootstrapResult> {
  let legacyImported = false;

  const alreadyImported = await adapter.getMeta<boolean>(META_LEGACY_IMPORTED);
  if (!alreadyImported) {
    const legacy = await safeReadLegacy();
    if (legacy) {
      await adapter.saveProject(legacy);
      legacyImported = true;
      await adapter.setMeta(META_LAST_PROJECT, legacy.id);
    }
    await adapter.setMeta(META_LEGACY_IMPORTED, true);
  }

  await refreshProjectList();

  const lastId = await adapter.getMeta<string>(META_LAST_PROJECT);
  const target = (lastId && projectList.value.find((s) => s.id === lastId)?.id) || projectList.value[0]?.id;

  let opened = false;
  if (target) opened = await openProject(target);

  ready.value = true;
  return { opened, legacyImported };
}

async function safeReadLegacy(): Promise<Project | null> {
  try {
    return await readLegacyProject();
  } catch {
    return null;
  }
}

export const _internal = {
  history,
  get adapter() {
    return adapter;
  },
};
