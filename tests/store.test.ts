import { beforeEach, describe, expect, it } from "vitest";
import { MemoryAdapter } from "../src/persistence/memory";
import * as store from "../src/store";
import { LEGACY_LS_KEY, type LegacyState } from "../src/model/legacy";

function seedLegacy(): void {
  const legacy: LegacyState = {
    taxonomyVersion: 4,
    gridW: 156,
    gridH: 54,
    zones: [{ id: "z1", name: "熟食區", color: "#ED7D31" }],
    cats: [{ id: "c1", name: "熟食區", color: "#ED7D31" }],
    shops: [{ id: "s1", name: "阿明", cat: "c1" }],
    cells: { "0_2": { cat: "c1", shop: "s1" } },
    cuts: [],
  };
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (k === LEGACY_LS_KEY ? JSON.stringify(legacy) : null),
    setItem: () => {},
    removeItem: () => {},
  };
}

describe("store bootstrap", () => {
  beforeEach(() => {
    store._setAdapterForTests(new MemoryAdapter());
    store.project.value = null;
  });

  it("首次啟動匯入 legacy 存檔並開啟", async () => {
    seedLegacy();
    const res = await store.bootstrap();
    expect(res.legacyImported).toBe(true);
    expect(res.opened).toBe(true);
    expect(store.project.value?.name).toBe("東港華僑市場");
    expect(store.geometry.value).not.toBeNull();
  });

  it("importProjectJson 認得 legacy 單檔存檔格式", async () => {
    delete (globalThis as Record<string, unknown>).localStorage;
    store._setAdapterForTests(new MemoryAdapter());
    await store.bootstrap();
    const legacy: LegacyState = {
      taxonomyVersion: 4,
      gridW: 156,
      gridH: 54,
      zones: [{ id: "z1", name: "熟食區", color: "#ED7D31" }],
      cats: [{ id: "c1", name: "熟食區", color: "#ED7D31" }],
      shops: [{ id: "s1", name: "阿明", cat: "c1" }],
      cells: { "0_2": { cat: "c1", shop: "s1" } },
      cuts: [],
    };
    const ok = await store.importProjectJson(JSON.stringify(legacy));
    expect(ok).toBe(true);
    expect(store.project.value?.name).toBe("東港華僑市場");
    expect(store.project.value?.doc.features).toHaveLength(1);
    expect(store.project.value?.doc.cells["0_2"]?.feature).toBe("s1");
  });

  it("沒有 legacy 存檔時從範本建立", async () => {
    delete (globalThis as Record<string, unknown>).localStorage;
    const adapter = new MemoryAdapter();
    store._setAdapterForTests(adapter);
    await store.bootstrap();
    const p = await store.createFromTemplate("blank-grid", "我的地圖");
    expect(p.name).toBe("我的地圖");
    expect((await adapter.listProjects()).length).toBe(1);
  });

  it("editDoc 記錄歷史、undo 還原", async () => {
    delete (globalThis as Record<string, unknown>).localStorage;
    store._setAdapterForTests(new MemoryAdapter());
    await store.createFromTemplate("blank-grid");
    const base = store.project.value!.doc.categories.length;

    store.editDoc((doc) => {
      doc.categories.push({ id: "cX", name: "A", color: "#111" });
      return doc;
    });
    expect(store.project.value?.doc.categories.length).toBe(base + 1);
    expect(store.canUndo.value).toBe(true);

    store.undo();
    expect(store.project.value?.doc.categories.length).toBe(base);
    store.redo();
    expect(store.project.value?.doc.categories.length).toBe(base + 1);
  });

  it("numbers 計算隨文件更新", async () => {
    delete (globalThis as Record<string, unknown>).localStorage;
    store._setAdapterForTests(new MemoryAdapter());
    await store.createFromTemplate("blank-grid");
    store.editDoc((doc) => {
      doc.features.push({ id: "f1", name: "一", category: "c1" });
      doc.features.push({ id: "f2", name: "二", category: "c1" });
      doc.cells["0_0"] = { feature: "f1" };
      doc.cells["0_5"] = { feature: "f2" };
      return doc;
    });
    expect(store.numbers.value).toEqual({ f1: 1, f2: 2 });
  });

  it("pickObjectGroup：點店家會連同其斜格所屬的牆一起選（group）", async () => {
    delete (globalThis as Record<string, unknown>).localStorage;
    store._setAdapterForTests(new MemoryAdapter());
    await store.createFromTemplate("blank-grid");
    const cat = store.project.value!.doc.categories[0]!.id;
    store.editDoc((doc) => {
      doc.cuts.push({ id: "w1", ax: 1, ay: 4, bx: 9, by: 4, side: 1, depth: 1, wall: true });
      doc.features.push({ id: "fA", name: "跨牆店", category: cat });
      doc.cells["2_2"] = { cat, feature: "fA" }; // 一般格
      doc.cells["Bw1_0_0"] = { cat, feature: "fA" }; // 斜格
      return doc;
    });
    store.pickObjectGroup({ featureId: "fA" }, false, false);
    expect([...store.selection.value]).toContain("2_2");
    expect([...store.selectedCutIds.value]).toContain("w1");

    // 反向：點牆 → 也把牆上的店家一般格帶進來
    store.clearSelection();
    store.pickObjectGroup({ cutId: "w1" }, false, false);
    expect([...store.selectedCutIds.value]).toContain("w1");
    expect([...store.selection.value]).toContain("2_2");
  });

  it("editDoc 回傳 null → 不更新、不進歷史", async () => {
    delete (globalThis as Record<string, unknown>).localStorage;
    store._setAdapterForTests(new MemoryAdapter());
    await store.createFromTemplate("blank-grid");
    const doc0 = store.project.value!.doc;
    store.editDoc(() => null);
    expect(store.project.value!.doc).toBe(doc0); // 同一份 doc
    expect(store.canUndo.value).toBe(false);
  });

  it("selectionOverlapMarks 找出選取重疊的既有區域 / 分類", async () => {
    delete (globalThis as Record<string, unknown>).localStorage;
    store._setAdapterForTests(new MemoryAdapter());
    await store.createFromTemplate("blank-grid");
    const cat = store.project.value!.doc.categories[0]!.id;
    store.editDoc((doc) => {
      doc.features.push({ id: "fA", name: "阿明", category: cat });
      doc.cells["1_1"] = { cat, feature: "fA" };
      doc.cells["1_2"] = { cat, feature: "fA" };
      doc.cells["1_3"] = { cat }; // 有分類、無區域
      return doc;
    });
    store.setSelection(["1_1", "1_2", "1_3", "2_9"]);
    const marks = store.selectionOverlapMarks();
    expect(marks[0]).toMatchObject({ type: "feature", id: "fA", name: "阿明", count: 2 });
    expect(marks[1]).toMatchObject({ type: "category", id: cat, count: 1 });
  });
});
