/**
 * 專案 schema。改動資料結構時：SCHEMA_VERSION +1，並在 migrations/ 新增一支
 * 只往前的 migration（見 docs/ARCHITECTURE.md）。
 */
import type { MapDoc } from "../core/types";
import { DEFAULT_VOCABULARY, type Vocabulary } from "../vocabulary";

export const SCHEMA_VERSION = 1;

export interface ViewSettings {
  view: "actual" | "plan";
  /** 實際標記透明度 20..95。 */
  fillA: number;
  showGrid: boolean;
  showLabels: boolean;
  showNames: boolean;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  vocabulary: Vocabulary;
}

/** 一個完整專案 = metadata + 可繪製內容 + 視圖設定。 */
export interface Project extends ProjectMeta {
  doc: MapDoc;
  view: ViewSettings;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  view: "actual",
  fillA: 80,
  showGrid: true,
  showLabels: true,
  showNames: false,
};

export const DEFAULT_GRID = { w: 60, h: 40, cellPx: 14 } as const;

export function newProjectId(): string {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface NewProjectInput {
  name?: string;
  doc?: Partial<MapDoc>;
  view?: Partial<ViewSettings>;
  vocabulary?: Partial<Vocabulary>;
}

export function createProject(input: NewProjectInput = {}): Project {
  const now = Date.now();
  return {
    id: newProjectId(),
    name: input.name?.trim() || "未命名地圖",
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    vocabulary: { ...DEFAULT_VOCABULARY, ...input.vocabulary },
    view: { ...DEFAULT_VIEW_SETTINGS, ...input.view },
    doc: {
      grid: { ...DEFAULT_GRID, ...input.doc?.grid },
      planLayers: input.doc?.planLayers ?? [],
      categories: input.doc?.categories ?? [],
      features: input.doc?.features ?? [],
      cells: input.doc?.cells ?? {},
      cuts: input.doc?.cuts ?? [],
      ...(input.doc?.baseImage ? { baseImage: input.doc.baseImage } : {}),
    },
  };
}
