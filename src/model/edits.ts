/**
 * 文件編輯操作 —— 全部是純函式 `(doc, args) => MapDoc`（回傳可能是原地改後的
 * 同一物件；呼叫端 store.editDoc 已先深拷貝）。tools 只呼叫這些，不自己動 cells。
 * 移植自 legacy 的 assign apply / eraseSelection / moveSelection / ensureNamedRegions /
 * cut sheet handlers。
 */
import type { Cell, CellKey, CellPoly, Cut, Feature, MapDoc } from "../core/types";
import { bandKey, isBandKey, keyRC, parseBandKey } from "../core/keys";
import { cellHidden } from "../core/cells";
import { MapGeometry } from "../core/geometry";
import { bandLocate, cutGeom } from "../core/bands";
import { clamp } from "../core/poly";

const UNNAMED_PREFIX = "未命名";
const MAX_CUT_DEPTH = 8;

function rid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function keepOrDrop(cells: Record<CellKey, Cell>, k: CellKey, cell: Cell): void {
  if (cell.plan || cell.cat || cell.feature || cell.poly) cells[k] = cell;
  else delete cells[k];
}

function featureById(doc: MapDoc, id: string | undefined): Feature | undefined {
  return id ? doc.features.find((f) => f.id === id) : undefined;
}

export function nextUnnamedName(doc: MapDoc, categoryId: string): string {
  const catName = doc.categories.find((c) => c.id === categoryId)?.name || "區域";
  const base = UNNAMED_PREFIX + catName;
  let n = 1;
  while (doc.features.some((f) => f.name === base + n)) n++;
  return base + n;
}

/** 移除「未命名*且沒有任何格子使用」的 feature（legacy pruneUnusedUnnamedShops）。 */
export function pruneUnnamedFeatures(doc: MapDoc): MapDoc {
  const used = new Set<string>();
  for (const k in doc.cells) {
    const f = doc.cells[k]!.feature;
    if (f) used.add(f);
  }
  doc.features = doc.features.filter((f) => !(f.name.startsWith(UNNAMED_PREFIX) && !used.has(f.id)));
  return doc;
}

/** 移除所有沒有格子的 feature（legacy pruneOrphanedShops）。 */
export function pruneOrphanFeatures(doc: MapDoc): MapDoc {
  const used = new Set<string>();
  for (const k in doc.cells) {
    const f = doc.cells[k]!.feature;
    if (f) used.add(f);
  }
  doc.features = doc.features.filter((f) => used.has(f.id));
  return doc;
}

// ---- 指定分類與命名區域 ----

export interface AssignArgs {
  categoryId: string;
  /** 選既有 feature。 */
  featureId?: string;
  /** 或輸入名稱（比對既有、否則新建）。留空 → 自動命名。 */
  featureName?: string;
  /** 封閉區框選帶來的裁切形狀：key → 局部多邊形（null = 整格、清掉既有形狀）。 */
  shapes?: ReadonlyMap<CellKey, CellPoly | null> | null;
}

export function assignCells(doc: MapDoc, keys: Iterable<CellKey>, args: AssignArgs): MapDoc {
  const { categoryId } = args;
  const typed = (args.featureName ?? "").trim();
  const picked =
    featureById(doc, args.featureId) ?? (typed ? doc.features.find((f) => f.name === typed) : undefined);
  const name = picked?.name || typed || nextUnnamedName(doc, categoryId);

  let feature = picked ?? (typed ? doc.features.find((f) => f.name === name) : undefined);
  if (!feature) {
    feature = { id: rid("f"), name, category: categoryId };
    doc.features.push(feature);
  } else {
    feature.name = name;
    feature.category = categoryId;
    for (const k in doc.cells) if (doc.cells[k]!.feature === feature.id) doc.cells[k]!.cat = categoryId;
  }

  for (const k of keys) {
    const cur: Cell = doc.cells[k] ? { ...doc.cells[k]! } : {};
    if (cellHidden(cur)) delete cur.poly;
    if (args.shapes?.has(k)) {
      const sp = args.shapes.get(k);
      if (sp) cur.poly = sp;
      else delete cur.poly;
    }
    cur.cat = categoryId;
    cur.feature = feature.id;
    keepOrDrop(doc.cells, k, cur);
  }

  return pruneUnnamedFeatures(doc);
}

/** 清除選取格的實際標記（保留規劃底圖）。legacy selErase。 */
export function eraseCells(doc: MapDoc, keys: Iterable<CellKey>): MapDoc {
  for (const k of keys) {
    const cur = doc.cells[k];
    if (!cur) continue;
    delete cur.cat;
    delete cur.feature;
    delete cur.poly;
    if (!cur.plan) delete doc.cells[k];
  }
  return pruneUnnamedFeatures(doc);
}

/** 用「目標區域」筆刷點格：已是該 feature → 取消，否則設為該 feature + 其分類。legacy addSelOrShop(activeShop)。 */
export function toggleFeatureCell(doc: MapDoc, key: CellKey, featureId: string): MapDoc {
  const feature = featureById(doc, featureId);
  if (!feature) return doc;
  const cur: Cell = doc.cells[key] ? { ...doc.cells[key]! } : {};
  if (cur.feature === featureId) {
    delete cur.feature;
    if (!cur.cat) delete cur.cat;
  } else {
    cur.feature = featureId;
    cur.cat = feature.category;
  }
  keepOrDrop(doc.cells, key, cur);
  return doc;
}

// ---- 移動選取 ----

export type MoveDir = "up" | "down" | "left" | "right";
const MOVE_DELTAS: Record<MoveDir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export interface MoveResult {
  ok: boolean;
  reason?: string;
  keys?: CellKey[];
}

/** 移動選取格的實際標記一格（規劃底圖不動）。legacy moveSelection。 */
export function moveSelection(doc: MapDoc, keys: CellKey[], dir: MoveDir): MoveResult {
  const delta = MOVE_DELTAS[dir];
  if (!keys.length) return { ok: false, reason: "沒有選取" };
  for (const k of keys) if (isBandKey(k)) return { ok: false, reason: "對齊網格的格子不支援移動" };

  const geo = new MapGeometry(doc);
  const [dr, dc] = delta;
  const targets = new Map<CellKey, CellKey>();
  const carried = new Map<CellKey, { cat?: string; feature?: string; poly?: CellPoly }>();
  let hasActual = false;

  for (const k of keys) {
    const [r, c] = keyRC(k);
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= geo.gridH || nc < 0 || nc >= geo.gridW)
      return { ok: false, reason: "已到達網格邊界" };
    const d = doc.cells[k] ?? {};
    targets.set(k, `${nr}_${nc}`);
    const c2: { cat?: string; feature?: string; poly?: CellPoly } = {};
    if (d.cat) c2.cat = d.cat;
    if (d.feature) c2.feature = d.feature;
    if (d.poly) c2.poly = d.poly;
    carried.set(k, c2);
    if (d.cat || d.feature) hasActual = true;
  }
  if (!hasActual) return { ok: false, reason: "所選區域沒有可移動的實際標記（牆壁不能移動）" };

  const next: Record<CellKey, Cell> = {};
  for (const k in doc.cells) next[k] = { ...doc.cells[k]! };
  const clearActual = (k: CellKey) => {
    const d = next[k];
    if (!d) return;
    delete d.cat;
    delete d.feature;
    delete d.poly;
    if (!d.plan) delete next[k];
  };
  for (const k of keys) clearActual(k);
  for (const k of keys) clearActual(targets.get(k)!);
  for (const k of keys) {
    const moved = carried.get(k)!;
    if (!moved.cat && !moved.feature) continue;
    const nk = targets.get(k)!;
    const d = next[nk] ?? {};
    if (moved.cat) d.cat = moved.cat;
    if (moved.feature) d.feature = moved.feature;
    if (moved.poly) d.poly = moved.poly;
    next[nk] = d;
  }

  doc.cells = next;
  pruneOrphanFeatures(doc);
  return { ok: true, keys: keys.map((k) => targets.get(k)!) };
}

/**
 * 把選取格的實際標記複製到 (dr, dc) 位移處（來源保留，覆蓋目的地）。
 * legacy 沒有；沿用 moveSelection 的規則（不含 band、不越界）。
 */
export function copySelection(doc: MapDoc, keys: CellKey[], dr: number, dc: number): MoveResult {
  if (!keys.length) return { ok: false, reason: "沒有選取" };
  for (const k of keys) if (isBandKey(k)) return { ok: false, reason: "對齊網格的格子不支援複製" };
  const geo = new MapGeometry(doc);
  const dest: CellKey[] = [];
  for (const k of keys) {
    const [r, c] = keyRC(k);
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= geo.gridH || nc < 0 || nc >= geo.gridW)
      return { ok: false, reason: "已到達網格邊界" };
    dest.push(`${nr}_${nc}`);
  }
  let copied = 0;
  keys.forEach((k, i) => {
    const src = doc.cells[k];
    if (!src || (!src.cat && !src.feature)) return;
    const target: Cell = { ...(doc.cells[dest[i]!] ?? {}) };
    if (src.cat) target.cat = src.cat;
    if (src.feature) target.feature = src.feature;
    if (src.poly) target.poly = src.poly;
    else delete target.poly;
    doc.cells[dest[i]!] = target;
    copied++;
  });
  if (!copied) return { ok: false, reason: "所選區域沒有可複製的實際標記" };
  return { ok: true, keys: dest };
}

// ---- 物件選取模式：整體移動 / 複製 / 刪除（牆 + 其斜格 + 格上的內容）----

export interface ObjectSelection {
  cutIds: string[];
  cellKeys: CellKey[];
}

function bandCutId(k: CellKey): string {
  return k.slice(1, k.indexOf("_", 1));
}

function outOfGrid(x: number, y: number, geo: MapGeometry): boolean {
  return x < 0 || x > geo.gridW || y < 0 || y > geo.gridH;
}

/** 把選取的牆與格子整體位移 (dx, dy) 格。牆的斜格與其內容會跟著牆移動。 */
export function moveObjects(doc: MapDoc, sel: ObjectSelection, dx: number, dy: number): MoveResult {
  const geo = new MapGeometry(doc);
  const cuts = doc.cuts.filter((c) => sel.cutIds.includes(c.id));
  const gridKeys = sel.cellKeys.filter((k) => !isBandKey(k));
  if (!cuts.length && !gridKeys.length) return { ok: false, reason: "沒有選取物件" };

  for (const c of cuts) {
    if (outOfGrid(c.ax + dx, c.ay + dy, geo) || outOfGrid(c.bx + dx, c.by + dy, geo))
      return { ok: false, reason: "牆會超出網格" };
  }
  for (const k of gridKeys) {
    const [r, c] = keyRC(k);
    if (r + dy < 0 || r + dy >= geo.gridH || c + dx < 0 || c + dx >= geo.gridW)
      return { ok: false, reason: "已到達網格邊界" };
  }

  for (const c of cuts) {
    c.ax += dx;
    c.ay += dy;
    c.bx += dx;
    c.by += dy;
  }

  const targets = new Map<CellKey, CellKey>();
  const carried = new Map<CellKey, { cat?: string; feature?: string; poly?: CellPoly }>();
  for (const k of gridKeys) {
    const [r, c] = keyRC(k);
    targets.set(k, `${r + dy}_${c + dx}`);
    const d = doc.cells[k] ?? {};
    carried.set(k, {
      ...(d.cat ? { cat: d.cat } : {}),
      ...(d.feature ? { feature: d.feature } : {}),
      ...(d.poly ? { poly: d.poly } : {}),
    });
  }
  const clearActual = (k: CellKey) => {
    const d = doc.cells[k];
    if (!d) return;
    delete d.cat;
    delete d.feature;
    delete d.poly;
    if (!d.plan) delete doc.cells[k];
  };
  for (const k of gridKeys) clearActual(k);
  for (const k of gridKeys) clearActual(targets.get(k)!);
  for (const k of gridKeys) {
    const moved = carried.get(k)!;
    if (!moved.cat && !moved.feature) continue;
    const nk = targets.get(k)!;
    doc.cells[nk] = { ...(doc.cells[nk] ?? {}), ...moved };
  }

  pruneBandCells(doc);
  pruneOrphanFeatures(doc);
  return { ok: true, keys: gridKeys.map((k) => targets.get(k)!) };
}

/** 複製選取的牆與格子到 (dx, dy) 位移處（來源保留）。回傳新選取（新牆 id + 新格鍵）。 */
export function copyObjects(
  doc: MapDoc,
  sel: ObjectSelection,
  dx: number,
  dy: number,
): { ok: boolean; reason?: string; cutIds: string[]; cellKeys: CellKey[] } {
  const geo = new MapGeometry(doc);
  const cuts = doc.cuts.filter((c) => sel.cutIds.includes(c.id));
  const gridKeys = sel.cellKeys.filter((k) => !isBandKey(k));
  if (!cuts.length && !gridKeys.length)
    return { ok: false, reason: "沒有選取物件", cutIds: [], cellKeys: [] };

  for (const c of cuts) {
    if (outOfGrid(c.ax + dx, c.ay + dy, geo) || outOfGrid(c.bx + dx, c.by + dy, geo))
      return { ok: false, reason: "牆會超出網格", cutIds: [], cellKeys: [] };
  }
  for (const k of gridKeys) {
    const [r, c] = keyRC(k);
    if (r + dy < 0 || r + dy >= geo.gridH || c + dx < 0 || c + dx >= geo.gridW)
      return { ok: false, reason: "已到達網格邊界", cutIds: [], cellKeys: [] };
  }

  const newCutIds: string[] = [];
  for (const c of cuts) {
    const nid = rid("k");
    doc.cuts.push({ ...c, id: nid, ax: c.ax + dx, ay: c.ay + dy, bx: c.bx + dx, by: c.by + dy });
    newCutIds.push(nid);
    for (const k in doc.cells) {
      if (!isBandKey(k) || bandCutId(k) !== c.id) continue;
      const rest = k.slice(("B" + c.id).length); // "_i_j"
      doc.cells["B" + nid + rest] = { ...doc.cells[k]! };
    }
  }

  const newCellKeys: CellKey[] = [];
  for (const k of gridKeys) {
    const [r, c] = keyRC(k);
    const nk = `${r + dy}_${c + dx}`;
    const src = doc.cells[k];
    if (!src || (!src.cat && !src.feature)) continue;
    const t: Cell = { ...(doc.cells[nk] ?? {}) };
    if (src.cat) t.cat = src.cat;
    if (src.feature) t.feature = src.feature;
    if (src.poly) t.poly = src.poly;
    else delete t.poly;
    doc.cells[nk] = t;
    newCellKeys.push(nk);
  }

  pruneBandCells(doc);
  return { ok: true, cutIds: newCutIds, cellKeys: newCellKeys };
}

/** 刪除選取的物件：牆（連同斜格）+ 格上的實際標記。 */
export function deleteObjects(doc: MapDoc, sel: ObjectSelection): MapDoc {
  for (const id of sel.cutIds) deleteCut(doc, id);
  const gridKeys = sel.cellKeys.filter((k) => !isBandKey(k));
  eraseCells(doc, gridKeys);
  return pruneUnnamedFeatures(doc);
}

// ---- 剪貼簿（Ctrl+C / X / V）----

export interface ClipCut {
  cut: Cut;
  bands: Array<{ i: number; j: number; cell: Cell }>;
}
export interface ClipCell {
  dr: number;
  dc: number;
  cat?: string;
  feature?: string;
  poly?: CellPoly;
}
export interface Clipboard {
  cuts: ClipCut[];
  cells: ClipCell[];
}

/** 從選取建立剪貼簿內容（座標相對於選取包圍盒左上角）。 */
export function buildClipboard(doc: MapDoc, sel: ObjectSelection): Clipboard | null {
  const cuts = doc.cuts.filter((c) => sel.cutIds.includes(c.id));
  const gridKeys = sel.cellKeys.filter((k) => !isBandKey(k) && (doc.cells[k]?.cat || doc.cells[k]?.feature));
  if (!cuts.length && !gridKeys.length) return null;

  let minR = Infinity;
  let minC = Infinity;
  for (const k of gridKeys) {
    const [r, c] = keyRC(k);
    minR = Math.min(minR, r);
    minC = Math.min(minC, c);
  }
  for (const c of cuts) {
    minR = Math.min(minR, Math.floor(Math.min(c.ay, c.by)));
    minC = Math.min(minC, Math.floor(Math.min(c.ax, c.bx)));
  }

  return {
    cuts: cuts.map((c) => ({
      cut: { ...c, ax: c.ax - minC, ay: c.ay - minR, bx: c.bx - minC, by: c.by - minR },
      bands: Object.keys(doc.cells)
        .filter((k) => isBandKey(k) && bandCutId(k) === c.id)
        .map((k) => {
          const p = k.slice(1).split("_");
          return { i: Number(p[1]), j: Number(p[2]), cell: { ...doc.cells[k]! } };
        }),
    })),
    cells: gridKeys.map((k) => {
      const [r, c] = keyRC(k);
      const d = doc.cells[k]!;
      return {
        dr: r - minR,
        dc: c - minC,
        ...(d.cat ? { cat: d.cat } : {}),
        ...(d.feature ? { feature: d.feature } : {}),
        ...(d.poly ? { poly: d.poly } : {}),
      };
    }),
  };
}

/** 把剪貼簿內容貼到 (row, col) 為左上角處。回傳新選取。 */
export function pasteObjects(
  doc: MapDoc,
  clip: Clipboard,
  row: number,
  col: number,
): { cutIds: string[]; cellKeys: CellKey[] } {
  const geo = new MapGeometry(doc);
  const cutIds: string[] = [];
  for (const cc of clip.cuts) {
    const nid = rid("k");
    doc.cuts.push({
      ...cc.cut,
      id: nid,
      ax: cc.cut.ax + col,
      ay: cc.cut.ay + row,
      bx: cc.cut.bx + col,
      by: cc.cut.by + row,
    });
    cutIds.push(nid);
    for (const b of cc.bands) doc.cells[`B${nid}_${b.i}_${b.j}`] = { ...b.cell };
  }
  const cellKeys: CellKey[] = [];
  for (const c of clip.cells) {
    const r = row + c.dr;
    const cc = col + c.dc;
    if (r < 0 || r >= geo.gridH || cc < 0 || cc >= geo.gridW) continue;
    const k = `${r}_${cc}`;
    const t: Cell = { ...(doc.cells[k] ?? {}) };
    if (c.cat) t.cat = c.cat;
    if (c.feature) t.feature = c.feature;
    if (c.poly) t.poly = c.poly;
    else delete t.poly;
    doc.cells[k] = t;
    cellKeys.push(k);
  }
  pruneBandCells(doc);
  return { cutIds, cellKeys };
}

// ---- 命名區域 CRUD ----

export function renameFeature(doc: MapDoc, id: string, name: string): MapDoc {
  const f = featureById(doc, id);
  if (f) f.name = name.trim() || f.name;
  return doc;
}

export function setFeatureCategory(doc: MapDoc, id: string, categoryId: string): MapDoc {
  const f = featureById(doc, id);
  if (!f) return doc;
  f.category = categoryId;
  for (const k in doc.cells) if (doc.cells[k]!.feature === id) doc.cells[k]!.cat = categoryId;
  return doc;
}

export function setFeatureFacility(doc: MapDoc, id: string, facility: string | null): MapDoc {
  const f = featureById(doc, id);
  if (!f) return doc;
  if (facility) f.facility = facility;
  else delete f.facility;
  return doc;
}

export function deleteFeature(doc: MapDoc, id: string): MapDoc {
  doc.features = doc.features.filter((f) => f.id !== id);
  for (const k in doc.cells) {
    const d = doc.cells[k]!;
    if (d.feature !== id) continue;
    delete d.feature;
    delete d.cat;
    if (!d.plan) delete doc.cells[k];
  }
  return doc;
}

// ---- 分類 / 規劃層 CRUD ----

export function addCategory(doc: MapDoc, name: string, color: string): MapDoc {
  doc.categories.push({ id: rid("c"), name: name.trim() || "分類", color });
  return doc;
}

export function updateCategory(doc: MapDoc, id: string, patch: { name?: string; color?: string }): MapDoc {
  const c = doc.categories.find((x) => x.id === id);
  if (!c) return doc;
  if (patch.name !== undefined) c.name = patch.name.trim() || c.name;
  if (patch.color !== undefined) c.color = patch.color;
  return doc;
}

export function deleteCategory(doc: MapDoc, id: string): MapDoc {
  doc.categories = doc.categories.filter((c) => c.id !== id);
  doc.features = doc.features.filter((f) => f.category !== id);
  for (const k in doc.cells) {
    const d = doc.cells[k]!;
    if (d.cat === id) delete d.cat;
    if (d.feature && !doc.features.some((f) => f.id === d.feature)) delete d.feature;
    if (!d.plan && !d.cat && !d.feature && !d.poly) delete doc.cells[k];
  }
  return doc;
}

export function addPlanLayer(doc: MapDoc, name: string, color: string): MapDoc {
  doc.planLayers.push({ id: rid("z"), name: name.trim() || "分區", color });
  return doc;
}

export function updatePlanLayer(doc: MapDoc, id: string, patch: { name?: string; color?: string }): MapDoc {
  const z = doc.planLayers.find((x) => x.id === id);
  if (!z) return doc;
  if (patch.name !== undefined) z.name = patch.name.trim() || z.name;
  if (patch.color !== undefined) z.color = patch.color;
  return doc;
}

export function deletePlanLayer(doc: MapDoc, id: string): MapDoc {
  doc.planLayers = doc.planLayers.filter((z) => z.id !== id);
  for (const k in doc.cells) {
    const d = doc.cells[k]!;
    if (d.plan !== id) continue;
    delete d.plan;
    if (!d.cat && !d.feature && !d.poly) delete doc.cells[k];
  }
  return doc;
}

// ---- 網格 ----

export function setGridSize(doc: MapDoc, w: number, h: number): MapDoc {
  doc.grid = { ...doc.grid, w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  return doc;
}

// ---- 格子外形（斜切）----

export function setCellShape(doc: MapDoc, key: CellKey, poly: CellPoly | null): MapDoc {
  const cur: Cell = doc.cells[key] ? { ...doc.cells[key]! } : {};
  if (poly && poly.length >= 3) cur.poly = poly;
  else if (poly && poly.length < 3)
    cur.poly = poly; // 隱藏整格
  else delete cur.poly;
  keepOrDrop(doc.cells, key, cur);
  return doc;
}

// ---- 切線 / 牆 / 帶 ----

export function addWall(
  doc: MapDoc,
  seg: { ax: number; ay: number; bx: number; by: number },
): { doc: MapDoc; cutId: string } {
  const cut: Cut = {
    id: rid("k"),
    ax: seg.ax,
    ay: seg.ay,
    bx: seg.bx,
    by: seg.by,
    wall: true,
    side: 1,
    depth: 0,
  };
  doc.cuts.push(cut);
  return { doc, cutId: cut.id };
}

function cutById(doc: MapDoc, id: string): Cut | undefined {
  return doc.cuts.find((c) => c.id === id);
}

/** 刪掉超出目前帶範圍的 band 格（legacy pruneBandCells）。 */
function pruneBandCells(doc: MapDoc): void {
  const geo = new MapGeometry(doc);
  for (const k in doc.cells) {
    if (isBandKey(k) && !geo.cellVisible(k)) delete doc.cells[k];
  }
}

export function setCutDepth(doc: MapDoc, id: string, depth: number): MapDoc {
  const cut = cutById(doc, id);
  if (!cut) return doc;
  cut.depth = clamp(Math.trunc(depth), 0, MAX_CUT_DEPTH);
  pruneBandCells(doc);
  return doc;
}

export function stepCutDepth(doc: MapDoc, id: string, delta: number): MapDoc {
  const cut = cutById(doc, id);
  return cut ? setCutDepth(doc, id, cut.depth + delta) : doc;
}

export function cycleCutSide(doc: MapDoc, id: string): MapDoc {
  const cut = cutById(doc, id);
  if (!cut) return doc;
  const order: Cut["side"][] = [-1, 1, 0];
  cut.side = order[(order.indexOf(cut.side) + 1) % order.length]!;
  pruneBandCells(doc);
  return doc;
}

export function toggleCutWall(doc: MapDoc, id: string): MapDoc {
  const cut = cutById(doc, id);
  if (cut) cut.wall = !cut.wall;
  return doc;
}

export function deleteCut(doc: MapDoc, id: string): MapDoc {
  doc.cuts = doc.cuts.filter((c) => c.id !== id);
  for (const k in doc.cells) {
    if (isBandKey(k) && k.slice(1, k.indexOf("_", 1)) === id) delete doc.cells[k];
  }
  return doc;
}

export function moveCutEndpoint(doc: MapDoc, id: string, end: "a" | "b", x: number, y: number): MapDoc {
  const cut = cutById(doc, id);
  if (!cut) return doc;

  const cw = doc.grid.cellPx;
  const ch = doc.grid.cellPx;
  const prefix = "B" + id + "_";

  // 移動端點前，先記錄每個斜格「內容」+ 它的世界座標中心（用舊幾何）
  const carried: { cx: number; cy: number; cell: Cell }[] = [];
  if (cut.depth) {
    const gOld = cutGeom(cut, cw, ch);
    for (const k in doc.cells) {
      if (!k.startsWith(prefix)) continue;
      const b = parseBandKey(k);
      // 舊 band 格中心（沿切線 u = (i+0.5)*step，法向 v = (j+0.5)*U）
      const u = (b.i + 0.5) * gOld.step;
      const v = (b.j + 0.5) * gOld.U;
      carried.push({
        cx: gOld.ax + gOld.ux * u + gOld.nx * v,
        cy: gOld.ay + gOld.uy * u + gOld.ny * v,
        cell: doc.cells[k]!,
      });
      delete doc.cells[k];
    }
  }

  if (end === "a") {
    cut.ax = x;
    cut.ay = y;
  } else {
    cut.bx = x;
    cut.by = y;
  }

  // 移動端點後：把每個斜格內容依世界座標重新定位到新的 band 格
  // 落在新帶範圍外的（通常在被拉近的那個端點附近）就被犧牲
  if (cut.depth && carried.length) {
    const gNew = cutGeom(cut, cw, ch);
    for (const item of carried) {
      const hit = bandLocate(gNew, item.cx, item.cy);
      if (!hit) continue;
      const nk = bandKey(id, hit.i, hit.j);
      doc.cells[nk] = { ...(doc.cells[nk] ?? {}), ...item.cell };
    }
  }

  pruneBandCells(doc);
  return doc;
}

// ---- 自動建立命名區域（legacy ensureNamedRegions 的洪水填充部分）----

/**
 * 為「有分類、沒歸屬 feature」的格子建立未命名區域，同分類且相連者歸為一個。
 * band 格與任一相鄰待處理格相連（不論分類，沿用 legacy 行為）。
 */
export function ensureFeatureRegions(doc: MapDoc): MapDoc {
  const known = new Set(doc.features.map((f) => f.id));
  for (const k in doc.cells) {
    if (doc.cells[k]!.feature && !known.has(doc.cells[k]!.feature!)) delete doc.cells[k]!.feature;
  }
  for (const f of doc.features) if (!f.name.trim()) f.name = nextUnnamedName(doc, f.category);

  const geo = new MapGeometry(doc);
  const pending = new Set(Object.keys(doc.cells).filter((k) => doc.cells[k]!.cat && !doc.cells[k]!.feature));

  while (pending.size) {
    const first = pending.values().next().value as CellKey;
    const catId = doc.cells[first]!.cat!;
    const stack: CellKey[] = [first];
    const region: CellKey[] = [];
    pending.delete(first);
    while (stack.length) {
      const k = stack.pop()!;
      region.push(k);
      if (isBandKey(k)) {
        for (const nk of geo.cellNeighbors(k)) if (pending.delete(nk)) stack.push(nk);
        continue;
      }
      const [r, c] = keyRC(k);
      for (const [nr, nc] of [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ]) {
        const nk = `${nr}_${nc}`;
        if (pending.has(nk) && doc.cells[nk]!.cat === catId) {
          pending.delete(nk);
          stack.push(nk);
        }
      }
    }
    const feature: Feature = { id: rid("f"), name: nextUnnamedName(doc, catId), category: catId };
    doc.features.push(feature);
    for (const k of region) doc.cells[k]!.feature = feature.id;
  }
  return doc;
}
