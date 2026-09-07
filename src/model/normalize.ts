/**
 * MapDoc 結構整理：修掉懸空參照、強制型別。純函式，回傳新物件。
 * （自動建立命名區域之類的「編輯行為」在 model/commands.ts，不在這裡。）
 */
import type { Cell, Cut, MapDoc } from "../core/types";
import { isBandKey } from "../core/keys";

function coerceCut(raw: unknown): Cut | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const id = typeof c.id === "string" ? c.id : "";
  if (!id) return null;
  const sideRaw = num(c.side, 1);
  const side: Cut["side"] = sideRaw === 0 ? 0 : sideRaw < 0 ? -1 : 1;
  const cut: Cut = {
    id,
    ax: num(c.ax),
    ay: num(c.ay),
    bx: num(c.bx),
    by: num(c.by),
    side,
    depth: Math.max(0, Math.trunc(num(c.depth))),
  };
  if (c.wall === true) cut.wall = true;
  return cut;
}

function coerceCell(raw: unknown): Cell | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const cell: Cell = {};
  if (typeof r.plan === "string") cell.plan = r.plan;
  if (typeof r.cat === "string") cell.cat = r.cat;
  if (typeof r.feature === "string") cell.feature = r.feature;
  if (Array.isArray(r.poly)) {
    cell.poly = (r.poly as unknown[])
      .filter(
        (p): p is [number, number] =>
          Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && typeof p[1] === "number",
      )
      .map((p) => [p[0], p[1]] as [number, number]);
  }
  return cell;
}

export function normalizeDoc(input: MapDoc): MapDoc {
  const planLayers = (input.planLayers ?? []).filter((z) => z && typeof z.id === "string");
  const categories = (input.categories ?? []).filter((c) => c && typeof c.id === "string");
  const features = (input.features ?? []).filter((f) => f && typeof f.id === "string");
  const cuts = (input.cuts ?? []).map(coerceCut).filter((c): c is Cut => !!c);

  const catIds = new Set(categories.map((c) => c.id));
  const featureIds = new Set(features.map((f) => f.id));
  const cutIds = new Set(cuts.map((c) => c.id));

  // feature.category 指向不存在的分類 → 清掉（保留 feature，UI 會提示補分類）
  for (const f of features) {
    if (f.category && !catIds.has(f.category)) f.category = "";
  }

  const cells: Record<string, Cell> = {};
  for (const k in input.cells) {
    if (isBandKey(k)) {
      // band 格：其 cut 必須存在
      const cutId = k.slice(1, k.indexOf("_", 1));
      if (!cutIds.has(cutId)) continue;
    }
    const cell = coerceCell(input.cells[k]);
    if (!cell) continue;
    if (cell.feature && !featureIds.has(cell.feature)) delete cell.feature;
    if (Object.keys(cell).length === 0) continue;
    cells[k] = cell;
  }

  // 沒有任何格子的 feature 保留（可能剛建立）；只丟掉 id 重複的
  const seen = new Set<string>();
  const dedupFeatures = features.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));

  const doc: MapDoc = {
    grid: {
      w: Math.max(1, Math.round(input.grid?.w) || 1),
      h: Math.max(1, Math.round(input.grid?.h) || 1),
      cellPx: Math.max(1, Math.round(input.grid?.cellPx) || 14),
    },
    planLayers,
    categories,
    features: dedupFeatures,
    cells,
    cuts,
  };
  if (input.baseImage && typeof input.baseImage.blobId === "string") doc.baseImage = input.baseImage;
  return doc;
}

/** 移除沒有任何可見格的命名區域（編輯後清理用）。 */
export function pruneEmptyFeatures(doc: MapDoc): MapDoc {
  const used = new Set<string>();
  for (const k in doc.cells) {
    const f = doc.cells[k]!.feature;
    if (f) used.add(f);
  }
  return { ...doc, features: doc.features.filter((f) => used.has(f.id)) };
}
