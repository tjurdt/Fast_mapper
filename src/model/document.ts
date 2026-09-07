/**
 * 序列化 ↔ Project 的邊界：載入（含遷移 + 驗證）、複製、匯出。
 */
import type { MapDoc } from "../core/types";
import { applyMigrations } from "./migrations";
import { normalizeDoc } from "./normalize";
import {
  createProject,
  SCHEMA_VERSION,
  type Project,
  type ViewSettings,
  DEFAULT_VIEW_SETTINGS,
} from "./schema";
import { DEFAULT_VOCABULARY, type Vocabulary } from "../vocabulary";

export function cloneDoc(doc: MapDoc): MapDoc {
  return structuredClone(doc);
}

export function cloneProject(p: Project): Project {
  return structuredClone(p);
}

function coerceView(raw: unknown): ViewSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    view: r.view === "plan" ? "plan" : "actual",
    fillA: typeof r.fillA === "number" ? Math.min(95, Math.max(20, r.fillA)) : DEFAULT_VIEW_SETTINGS.fillA,
    showGrid: r.showGrid !== false,
    showLabels: r.showLabels !== false,
    showNames: r.showNames === true,
  };
}

function coerceVocabulary(raw: unknown): Vocabulary {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (v: unknown, d: string) => (typeof v === "string" && v.trim() ? v : d);
  return {
    planLayer: pick(r.planLayer, DEFAULT_VOCABULARY.planLayer),
    category: pick(r.category, DEFAULT_VOCABULARY.category),
    feature: pick(r.feature, DEFAULT_VOCABULARY.feature),
    ...(typeof r.featureList === "string" && r.featureList ? { featureList: r.featureList } : {}),
  };
}

/**
 * 把任意來源的已存物件變成合法 Project：套用遷移、補欄位、整理 doc。
 * 壞資料不丟例外 —— 盡量救回，最差回傳一個空專案。
 */
export function loadProject(stored: unknown): Project {
  if (!stored || typeof stored !== "object") return createProject();
  const raw = applyMigrations({ ...(stored as Record<string, unknown>) });

  const now = Date.now();
  const base = createProject();
  const docInput = (raw.doc ?? {}) as Partial<MapDoc>;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : base.id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : base.name,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
    schemaVersion: SCHEMA_VERSION,
    vocabulary: coerceVocabulary(raw.vocabulary),
    view: coerceView(raw.view),
    doc: normalizeDoc({
      grid: { w: 60, h: 40, cellPx: 14, ...docInput.grid },
      planLayers: docInput.planLayers ?? [],
      categories: docInput.categories ?? [],
      features: docInput.features ?? [],
      cells: docInput.cells ?? {},
      cuts: docInput.cuts ?? [],
      ...(docInput.baseImage ? { baseImage: docInput.baseImage } : {}),
    }),
  };
}

/** Project → 可 JSON 化的純物件（存檔 / 匯出用）。 */
export function serializeProject(p: Project): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    schemaVersion: SCHEMA_VERSION,
    vocabulary: p.vocabulary,
    view: p.view,
    doc: p.doc,
  };
}
