/**
 * 唯一狀態源。元件透過 signals 訂閱；改文件一律走這裡的 action，
 * 由 action 負責 history、重算 geometry/numbers、以及防抖存檔。
 */
import { batch, computed, signal } from "@preact/signals";
import type { CellKey, MapDoc } from "../core/types";
import { MapGeometry } from "../core/geometry";
import { computeNumbers } from "../core/numbering";
import { DocHistory } from "../model/commands";
import { cloneDoc } from "../model/document";
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
import type { Scene } from "../render/scene";

// ---- signals ----

export const project = signal<Project | null>(null);
export const projectList = signal<ProjectSummary[]>([]);
export const ready = signal(false);

export const selection = signal<ReadonlySet<CellKey>>(new Set());
export const inspectedFeature = signal<string | null>(null);
export const activeToolId = signal<string>("assign");

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
    highlightFeature: inspectedFeature.value,
    cutMode: activeToolId.value === "cut",
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
  const input = t.build();
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
    const legacy = safeReadLegacy();
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

function safeReadLegacy(): Project | null {
  try {
    return readLegacyProject();
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
