/**
 * 匯入 legacy 單檔 app 的 localStorage 存檔（key `grid-market-v4`）。
 *
 * legacy 狀態形狀：
 *   { zones, cats, shops:[{id,name,cat}], cells:{ "r_c": {plan?,cat?,shop?,poly?} },
 *     gridW, gridH, view, fillA, showGrid, showLabels, showNames, lastShopId,
 *     taxonomyVersion, cuts:[{id,ax,ay,bx,by,side,depth,wall?}] }
 *
 * 這裡凍結 legacy `normalizeTaxonomy` 的市場別名邏輯 —— 未來不再改動。
 */
import type { Cell, MapDoc } from "../core/types";
import { normalizeDoc } from "./normalize";
import { createProject, type Project } from "./schema";
import {
  DONGGANG_CATEGORIES,
  DONGGANG_PLAN_LAYERS,
  LEGACY_CATEGORY_ALIASES,
} from "../templates/donggangMarket";
import canonicalPlan from "../templates/donggang-market.canonical.json";

export const LEGACY_LS_KEY = "grid-market-v4";

const WALL_PLANS = new Set(["zw", "zf", "zs"]);
const CANON: Record<string, string> = canonicalPlan;

interface LegacyCat {
  id: string;
  name?: string;
  color?: string;
}
interface LegacyShop {
  id: string;
  name?: string;
  cat?: string;
}
interface LegacyCell {
  plan?: string;
  cat?: string;
  shop?: string;
  poly?: [number, number][];
}
export interface LegacyState {
  zones?: LegacyCat[];
  cats?: LegacyCat[];
  shops?: LegacyShop[];
  cells?: Record<string, LegacyCell>;
  cuts?: unknown[];
  gridW?: number;
  gridH?: number;
  view?: string;
  fillA?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  showNames?: boolean;
  taxonomyVersion?: number;
}

const strip = (s: string) => s.replace(/\s/g, "");
const isCatId = (v: string | undefined) => /^c(?:[1-9]|10)$/.test(v ?? "");

/** 港市場舊分類 id → 正規 c1..c10。移植自 legacy normalizeTaxonomy。 */
function buildCategoryMap(cats: LegacyCat[]): Record<string, string> {
  const byColor: Record<string, string> = {};
  for (const c of DONGGANG_CATEGORIES) byColor[c.color.toUpperCase()] = c.id;
  const map: Record<string, string> = {};
  for (const c of cats) {
    const name = strip(String(c.name ?? ""));
    const idx = LEGACY_CATEGORY_ALIASES.findIndex((group) => group.some((n) => strip(n) === name));
    map[c.id] = idx >= 0 ? "c" + (idx + 1) : (byColor[String(c.color ?? "").toUpperCase()] ?? "c9");
  }
  return map;
}

/**
 * 把任意 taxonomyVersion 的 legacy 狀態正規化到 v4 語意：
 * 分類/分區固定為港市場正規表，牆壁 plan 收斂為 "zw"，
 * shop/cell 的分類 id 重新對應。
 */
export function normalizeLegacyTaxonomy(state: LegacyState): LegacyState {
  const version = state.taxonomyVersion ?? 0;
  const cells = state.cells ?? {};

  if (version === 4) return state;

  if (version === 3) {
    for (const k in cells) {
      if (WALL_PLANS.has(CANON[k] ?? "")) cells[k]!.plan = "zw";
    }
    return { ...state, cells, taxonomyVersion: 4 };
  }

  const catMap = buildCategoryMap(state.cats ?? []);
  const shops = (state.shops ?? []).map((sh) => ({
    ...sh,
    cat: catMap[sh.cat ?? ""] ?? (isCatId(sh.cat) ? sh.cat : "c9"),
  }));
  const shopCat: Record<string, string> = {};
  for (const sh of shops) shopCat[sh.id] = sh.cat!;

  for (const k in cells) {
    const d = cells[k]!;
    const canon = CANON[k];
    if (canon && WALL_PLANS.has(canon)) d.plan = "zw";
    else if (d.plan === "zf" || d.plan === "zs") d.plan = "zw";
    else if (d.plan && !/^(?:z[1-9]|zw)$/.test(d.plan)) d.plan = "z9";
    if (d.cat) d.cat = catMap[d.cat] ?? (isCatId(d.cat) ? d.cat : "c9");
    else if (d.shop && shopCat[d.shop]) d.cat = shopCat[d.shop];
  }

  return {
    ...state,
    cells,
    shops,
    zones: DONGGANG_PLAN_LAYERS.map((z) => ({ ...z })),
    cats: DONGGANG_CATEGORIES.map((c) => ({ ...c })),
    taxonomyVersion: 4,
  };
}

/** legacy 狀態 → 新的 Project（schema v1）。 */
export function projectFromLegacyState(raw: LegacyState): Project {
  const state = normalizeLegacyTaxonomy(structuredClone(raw));

  const cells: Record<string, Cell> = {};
  for (const k in state.cells ?? {}) {
    const d = state.cells![k]!;
    const cell: Cell = {};
    if (d.plan && !WALL_PLANS.has(d.plan)) cell.plan = d.plan;
    if (d.cat) cell.cat = d.cat;
    if (d.shop) cell.feature = d.shop;
    if (Array.isArray(d.poly)) cell.poly = d.poly;
    if (Object.keys(cell).length) cells[k] = cell;
  }

  const doc: MapDoc = normalizeDoc({
    grid: { w: state.gridW || 156, h: state.gridH || 54, cellPx: 14 },
    planLayers: (state.zones ?? DONGGANG_PLAN_LAYERS).map((z) => ({
      id: z.id,
      name: z.name ?? "",
      color: z.color ?? "#D9DEE0",
    })),
    categories: (state.cats ?? DONGGANG_CATEGORIES).map((c) => ({
      id: c.id,
      name: c.name ?? "",
      color: c.color ?? "#D9DEE0",
    })),
    features: (state.shops ?? []).map((s) => ({
      id: s.id,
      name: s.name ?? "",
      category: s.cat ?? "",
    })),
    cells,
    cuts: (state.cuts ?? []) as MapDoc["cuts"],
  });

  return createProject({
    name: "東港華僑市場",
    vocabulary: { planLayer: "規劃分區", category: "實際分類", feature: "店家" },
    view: {
      view: state.view === "plan" ? "plan" : "actual",
      fillA: typeof state.fillA === "number" ? state.fillA : 80,
      showGrid: state.showGrid !== false,
      showLabels: state.showLabels !== false,
      showNames: state.showNames === true,
    },
    doc,
  });
}

/** 從瀏覽器 localStorage 讀 legacy 存檔；沒有則回 null。 */
export function readLegacyProject(storage: Pick<Storage, "getItem"> = localStorage): Project | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(LEGACY_LS_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LegacyState;
    if (!parsed || !parsed.cells || !parsed.zones) return null;
    return projectFromLegacyState(parsed);
  } catch {
    return null;
  }
}
