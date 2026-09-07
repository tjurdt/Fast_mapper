import { describe, expect, it } from "vitest";
import { DocHistory } from "../src/model/commands";
import { createProject, SCHEMA_VERSION } from "../src/model/schema";
import { loadProject, serializeProject } from "../src/model/document";
import { normalizeDoc } from "../src/model/normalize";
import { projectFromLegacyState, type LegacyState } from "../src/model/legacy";
import type { MapDoc } from "../src/core/types";

const emptyDoc = (): MapDoc => ({
  grid: { w: 6, h: 4, cellPx: 14 },
  planLayers: [],
  categories: [],
  features: [],
  cells: {},
  cuts: [],
});

describe("createProject", () => {
  it("帶預設值與時間戳", () => {
    const p = createProject({ name: "  測試  " });
    expect(p.name).toBe("測試");
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.doc.grid.cellPx).toBe(14);
    expect(p.createdAt).toBeLessThanOrEqual(Date.now());
  });
});

describe("DocHistory", () => {
  it("undo / redo 往返", () => {
    const h = new DocHistory();
    const a = emptyDoc();
    h.reset(a);
    expect(h.canUndo).toBe(false);

    const b = { ...a, grid: { ...a.grid, w: 10 } };
    h.record(b);
    expect(h.canUndo).toBe(true);

    const back = h.undo();
    expect(back?.grid.w).toBe(6);
    expect(h.canRedo).toBe(true);

    const fwd = h.redo();
    expect(fwd?.grid.w).toBe(10);
  });

  it("相同快照不進堆疊", () => {
    const h = new DocHistory();
    const a = emptyDoc();
    h.reset(a);
    h.record(structuredClone(a));
    expect(h.canUndo).toBe(false);
  });

  it("限制堆疊深度", () => {
    const h = new DocHistory(3);
    h.reset(emptyDoc());
    for (let w = 1; w <= 10; w++) h.record({ ...emptyDoc(), grid: { w, h: 4, cellPx: 14 } });
    let steps = 0;
    while (h.undo()) steps++;
    expect(steps).toBe(3);
  });
});

describe("normalizeDoc", () => {
  it("丟掉指向不存在 feature 的格子參照", () => {
    const doc = normalizeDoc({
      ...emptyDoc(),
      features: [{ id: "f1", name: "A", category: "" }],
      cells: { "0_0": { feature: "f1" }, "0_1": { feature: "ghost" }, "0_2": {} },
    });
    expect(doc.cells["0_0"]).toEqual({ feature: "f1" });
    expect(doc.cells["0_1"]).toBeUndefined();
    expect(doc.cells["0_2"]).toBeUndefined();
  });

  it("丟掉 cut 不存在的 band 格", () => {
    const doc = normalizeDoc({
      ...emptyDoc(),
      cuts: [{ id: "k1", ax: 0, ay: 0, bx: 1, by: 0, side: 1, depth: 1 }],
      cells: { Bk1_0_0: { cat: "c1" }, Bghost_0_0: { cat: "c1" } },
    });
    expect(doc.cells["Bk1_0_0"]).toBeDefined();
    expect(doc.cells["Bghost_0_0"]).toBeUndefined();
  });
});

describe("loadProject", () => {
  it("round-trips serialize", () => {
    const p = createProject({ name: "x", doc: { categories: [{ id: "c1", name: "食", color: "#fff" }] } });
    const back = loadProject(serializeProject(p));
    expect(back.name).toBe("x");
    expect(back.doc.categories).toEqual(p.doc.categories);
  });

  it("壞資料不丟例外", () => {
    expect(() => loadProject(null)).not.toThrow();
    expect(() => loadProject({ doc: "nope" })).not.toThrow();
    expect(loadProject(42).schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("projectFromLegacyState", () => {
  const legacyV4: LegacyState = {
    taxonomyVersion: 4,
    gridW: 156,
    gridH: 54,
    view: "actual",
    fillA: 80,
    zones: [{ id: "z1", name: "熟食區", color: "#ED7D31" }],
    cats: [{ id: "c1", name: "熟食區", color: "#ED7D31" }],
    shops: [{ id: "s1", name: "阿明", cat: "c1" }],
    cells: {
      "0_0": { plan: "z1" },
      "0_1": { plan: "zw" },
      "0_2": { cat: "c1", shop: "s1" },
    },
    cuts: [],
  };

  it("shop → feature、牆壁 plan 被丟棄", async () => {
    const p = await projectFromLegacyState(legacyV4);
    expect(p.name).toBe("東港華僑市場");
    expect(p.vocabulary.feature).toBe("店家");
    expect(p.doc.features).toEqual([{ id: "s1", name: "阿明", category: "c1" }]);
    expect(p.doc.cells["0_0"]).toEqual({ plan: "z1" });
    expect(p.doc.cells["0_1"]).toBeUndefined(); // zw 丟棄，格子清空
    expect(p.doc.cells["0_2"]).toEqual({ cat: "c1", feature: "s1" });
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("舊 taxonomy（version < 3）用別名對應分類", async () => {
    const old: LegacyState = {
      taxonomyVersion: 1,
      gridW: 156,
      gridH: 54,
      zones: [{ id: "z1", name: "熟食", color: "#ED7D31" }],
      cats: [{ id: "cX", name: "黃區", color: "#FFD966" }],
      shops: [{ id: "s1", name: "攤A", cat: "cX" }],
      cells: { "5_5": { cat: "cX", shop: "s1" } },
      cuts: [],
    };
    const p = await projectFromLegacyState(old);
    // 「黃區」→ 別名索引 3（第 4 組）→ c4
    expect(p.doc.features[0]!.category).toBe("c4");
    expect(p.doc.cells["5_5"]).toEqual({ cat: "c4", feature: "s1" });
    // 分類表被重置為港市場正規表
    expect(p.doc.categories.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"]);
  });
});
