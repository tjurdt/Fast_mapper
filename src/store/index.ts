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
import { readLegacyProject } from "../model/legacy";
import {
  addCategory,
  addPlanLayer,
  addWall,
  assignCells,
  cycleCutSide,
  deleteCategory,
  deleteCut,
  deleteFeature,
  deletePlanLayer,
  eraseCells,
  moveCutEndpoint,
  moveSelection,
  renameFeature,
  toggleFeatureCell,
  setFeatureCategory,
  setGridSize,
  stepCutDepth,
  toggleCutWall,
  updateCategory,
  updatePlanLayer,
  type AssignArgs,
  type MoveDir,
  type MoveResult,
} from "../model/edits";
import type { Scene } from "../render/scene";
import { exportImage, exportXlsx, downloadFile, type ExportOptions } from "../export";

export { uiEvents } from "./events";

// ---- signals ----

export const project = signal<Project | null>(null);
export const projectList = signal<ProjectSummary[]>([]);
export const ready = signal(false);

export const selection = signal<ReadonlySet<CellKey>>(new Set());
/** 封閉區框選帶來的每格裁切形狀（跟 selection 平行）。 */
export const selectionShapes = signal<ReadonlyMap<CellKey, CellPoly | null>>(new Map());
export const inspectedFeature = signal<string | null>(null);
/** 筆刷工具的目標命名區域。 */
export const activeFeatureId = signal<string | null>(null);
export const activeToolId = signal<string>("select");

export function setTool(id: string): void {
  if (activeToolId.value === id) return;
  activeToolId.value = id;
  clearSelection();
  editingCutId.value = null;
  ghostCut.value = null;
  if (id !== "paint") activeFeatureId.value = null;
}

/** 只影響渲染、不進歷史的暫時狀態（拖曳框、幽靈切線、正在編輯的切線）。 */
export const dragRect = signal<readonly [number, number, number, number] | null>(null);
export const ghostCut = signal<readonly [number, number, number, number] | null>(null);
export const editingCutId = signal<string | null>(null);

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
    editingCut: editingCutId.value ? (p.doc.cuts.find((c) => c.id === editingCutId.value) ?? null) : null,
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

/** 套用一次文件變更。fn 收到深拷貝的 doc，回傳新 doc（或原地改後回傳）。 */
export function editDoc(fn: (doc: MapDoc) => MapDoc | void, opts: { record?: boolean } = {}): void {
  const p = project.value;
  if (!p) return;
  const draft = cloneDoc(p.doc);
  const next = fn(draft) ?? draft;
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
  editDoc((doc) => assignCells(doc, keys, { ...args, shapes }));
  clearSelection();
}

export function eraseSelection(): void {
  if (!selection.value.size) return;
  const keys = [...selection.value];
  editDoc((doc) => eraseCells(doc, keys));
  clearSelection();
}

export function moveSelectionBy(dir: MoveDir): { ok: boolean; reason?: string } {
  const p = project.value;
  if (!p || !selection.value.size) return { ok: false, reason: "沒有選取" };
  const keys = [...selection.value];
  let result: MoveResult = { ok: false };
  editDoc((doc) => {
    result = moveSelection(doc, keys, dir);
    return result.ok ? doc : undefined;
  });
  if (result.ok && result.keys) selection.value = new Set(result.keys);
  return { ok: result.ok, ...(result.reason ? { reason: result.reason } : {}) };
}

export function inspectFeature(id: string | null): void {
  inspectedFeature.value = id;
}

// ---- 筆刷（目標命名區域）----

export function setActiveFeature(id: string | null): void {
  activeFeatureId.value = id;
  if (id) {
    activeToolId.value = "paint";
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
  if (cutId) clearSelection();
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

// JSON 備份 / 匯入
export function exportProjectJson(): string {
  const p = project.value;
  return p ? JSON.stringify(serializeProject(p), null, 2) : "{}";
}
export async function importProjectJson(text: string): Promise<boolean> {
  try {
    const p = loadProject(JSON.parse(text));
    const fresh: Project = { ...p, id: p.id || createProject().id, updatedAt: Date.now() };
    setProject(fresh);
    await persistNow();
    await refreshProjectList();
    return true;
  } catch {
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
