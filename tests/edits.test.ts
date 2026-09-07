import { describe, expect, it } from "vitest";
import {
  addWall,
  assignCells,
  buildClipboard,
  copyObjects,
  copySelection,
  deleteCut,
  deleteFeature,
  deleteObjects,
  ensureFeatureRegions,
  eraseCells,
  moveObjects,
  moveSelection,
  pasteObjects,
  setCutDepth,
  setFeatureCategory,
  setFeatureFacility,
} from "../src/model/edits";
import { makeDoc } from "./helpers";

describe("assignCells", () => {
  it("新建 feature 並套用分類到選取格", () => {
    const doc = assignCells(
      makeDoc({ categories: [{ id: "c1", name: "食", color: "#111" }] }),
      ["0_0", "0_1"],
      {
        categoryId: "c1",
        featureName: "阿明",
      },
    );
    expect(doc.features).toHaveLength(1);
    expect(doc.features[0]!.name).toBe("阿明");
    expect(doc.cells["0_0"]).toEqual({ cat: "c1", feature: doc.features[0]!.id });
  });

  it("同名 feature 重用、改分類會連帶更新既有格", () => {
    let doc = makeDoc({
      categories: [
        { id: "c1", name: "A", color: "#111" },
        { id: "c2", name: "B", color: "#222" },
      ],
    });
    doc = assignCells(doc, ["0_0"], { categoryId: "c1", featureName: "店" });
    doc = assignCells(doc, ["0_1"], { categoryId: "c2", featureName: "店" });
    expect(doc.features).toHaveLength(1);
    expect(doc.cells["0_0"]!.cat).toBe("c2");
    expect(doc.cells["0_1"]!.cat).toBe("c2");
  });

  it("留空名稱 → 自動命名 未命名<分類>1", () => {
    const doc = assignCells(makeDoc({ categories: [{ id: "c1", name: "熟食", color: "#111" }] }), ["0_0"], {
      categoryId: "c1",
    });
    expect(doc.features[0]!.name).toBe("未命名熟食1");
  });
});

describe("eraseCells", () => {
  it("清掉實際標記、保留規劃底圖、清掉變空的未命名 feature", () => {
    let doc = makeDoc({ categories: [{ id: "c1", name: "A", color: "#111" }] });
    doc.cells["0_0"] = { plan: "z1" };
    doc = assignCells(doc, ["0_0", "0_1"], { categoryId: "c1" });
    doc = eraseCells(doc, ["0_0", "0_1"]);
    expect(doc.cells["0_0"]).toEqual({ plan: "z1" });
    expect(doc.cells["0_1"]).toBeUndefined();
    expect(doc.features).toHaveLength(0);
  });
});

describe("copySelection", () => {
  it("複製實際標記到位移處、來源保留", () => {
    let doc = makeDoc({ categories: [{ id: "c1", name: "A", color: "#111" }] });
    doc = assignCells(doc, ["1_1"], { categoryId: "c1", featureName: "x" });
    const r = copySelection(doc, ["1_1"], 0, 3); // 右方 3 格
    expect(r.ok).toBe(true);
    expect(r.keys).toEqual(["1_4"]);
    expect(doc.cells["1_1"]!.feature).toBeDefined(); // 來源還在
    expect(doc.cells["1_4"]!.feature).toBe(doc.cells["1_1"]!.feature);
  });

  it("越界則拒絕", () => {
    let doc = makeDoc({
      grid: { w: 5, h: 5, cellPx: 14 },
      categories: [{ id: "c1", name: "A", color: "#111" }],
    });
    doc = assignCells(doc, ["0_0"], { categoryId: "c1", featureName: "x" });
    expect(copySelection(doc, ["0_0"], -2, 0).ok).toBe(false);
  });
});

describe("moveSelection", () => {
  it("平移實際標記一格，回傳新格鍵", () => {
    let doc = makeDoc({ categories: [{ id: "c1", name: "A", color: "#111" }] });
    doc = assignCells(doc, ["1_1"], { categoryId: "c1", featureName: "x" });
    const r = moveSelection(doc, ["1_1"], "right");
    expect(r.ok).toBe(true);
    expect(r.keys).toEqual(["1_2"]);
    expect(doc.cells["1_1"]).toBeUndefined();
    expect(doc.cells["1_2"]!.cat).toBe("c1");
  });

  it("越界則拒絕且不改動", () => {
    let doc = makeDoc({
      grid: { w: 4, h: 4, cellPx: 14 },
      categories: [{ id: "c1", name: "A", color: "#111" }],
    });
    doc = assignCells(doc, ["0_0"], { categoryId: "c1", featureName: "x" });
    const r = moveSelection(doc, ["0_0"], "up");
    expect(r.ok).toBe(false);
    expect(doc.cells["0_0"]).toBeDefined();
  });
});

describe("cuts", () => {
  it("addWall 建立牆切線；deleteCut 一併清 band 格", () => {
    let doc = makeDoc();
    const { cutId } = addWall(doc, { ax: 0, ay: 2, bx: 4, by: 2 });
    expect(doc.cuts[0]).toMatchObject({ id: cutId, wall: true, depth: 0 });
    doc = setCutDepth(doc, cutId, 1);
    doc.cells[`B${cutId}_0_0`] = { cat: "c1" };
    doc = deleteCut(doc, cutId);
    expect(doc.cuts).toHaveLength(0);
    expect(doc.cells[`B${cutId}_0_0`]).toBeUndefined();
  });

  it("setCutDepth 夾在 0..8", () => {
    let doc = makeDoc();
    const { cutId } = addWall(doc, { ax: 0, ay: 2, bx: 4, by: 2 });
    doc = setCutDepth(doc, cutId, 99);
    expect(doc.cuts[0]!.depth).toBe(8);
  });
});

describe("ensureFeatureRegions", () => {
  it("同分類相連的無主格併為一個未命名區域", () => {
    const doc = makeDoc({ categories: [{ id: "c1", name: "A", color: "#111" }] });
    doc.cells["0_0"] = { cat: "c1" };
    doc.cells["0_1"] = { cat: "c1" };
    doc.cells["3_3"] = { cat: "c1" };
    ensureFeatureRegions(doc);
    expect(doc.features).toHaveLength(2);
    expect(doc.cells["0_0"]!.feature).toBe(doc.cells["0_1"]!.feature);
    expect(doc.cells["0_0"]!.feature).not.toBe(doc.cells["3_3"]!.feature);
  });
});

describe("feature CRUD", () => {
  it("setFeatureCategory 連帶更新格；deleteFeature 清乾淨", () => {
    let doc = makeDoc({
      categories: [
        { id: "c1", name: "A", color: "#111" },
        { id: "c2", name: "B", color: "#222" },
      ],
    });
    doc = assignCells(doc, ["0_0", "0_1"], { categoryId: "c1", featureName: "x" });
    const fid = doc.features[0]!.id;
    doc = setFeatureCategory(doc, fid, "c2");
    expect(doc.cells["0_0"]!.cat).toBe("c2");
    doc = deleteFeature(doc, fid);
    expect(doc.features).toHaveLength(0);
    expect(doc.cells["0_0"]).toBeUndefined();
  });
});

describe("物件選取：moveObjects / copyObjects / deleteObjects", () => {
  const build = () => {
    let doc = makeDoc({
      grid: { w: 12, h: 12, cellPx: 14 },
      categories: [{ id: "c1", name: "A", color: "#111" }],
      cuts: [{ id: "w1", ax: 2, ay: 2, bx: 6, by: 2, side: 1, depth: 0, wall: true }],
    });
    doc = assignCells(doc, ["3_3"], { categoryId: "c1", featureName: "x" });
    return doc;
  };

  it("moveObjects 同時平移牆與格內容", () => {
    const doc = build();
    const r = moveObjects(doc, { cutIds: ["w1"], cellKeys: ["3_3"] }, 1, 1);
    expect(r.ok).toBe(true);
    expect(doc.cuts[0]).toMatchObject({ ax: 3, ay: 3, bx: 7, by: 3 });
    expect(doc.cells["3_3"]).toBeUndefined();
    expect(doc.cells["4_4"]!.feature).toBeDefined();
  });

  it("copyObjects 複製牆（新 id）與格內容、來源保留", () => {
    const doc = build();
    const r = copyObjects(doc, { cutIds: ["w1"], cellKeys: ["3_3"] }, 0, 4);
    expect(r.ok).toBe(true);
    expect(doc.cuts).toHaveLength(2);
    expect(r.cutIds[0]).not.toBe("w1");
    expect(doc.cells["3_3"]).toBeDefined();
    expect(doc.cells["7_3"]!.feature).toBe(doc.cells["3_3"]!.feature);
  });

  it("deleteObjects 移除牆與格標記", () => {
    const doc = build();
    deleteObjects(doc, { cutIds: ["w1"], cellKeys: ["3_3"] });
    expect(doc.cuts).toHaveLength(0);
    expect(doc.cells["3_3"]).toBeUndefined();
  });

  it("剪貼簿：buildClipboard → pasteObjects", () => {
    const doc = build();
    const clip = buildClipboard(doc, { cutIds: ["w1"], cellKeys: ["3_3"] })!;
    expect(clip).not.toBeNull();
    const res = pasteObjects(doc, clip, 8, 5);
    expect(res.cutIds).toHaveLength(1);
    expect(res.cellKeys).toHaveLength(1);
    // 貼到 (8,5) 為左上角；原本相對位置 (row3-2, col3-2)=(1,1) → (9,6)
    expect(doc.cells["9_6"]!.feature).toBeDefined();
  });
});

describe("setFeatureFacility", () => {
  it("設定與清除設施", () => {
    let doc = assignCells(makeDoc({ categories: [{ id: "c1", name: "A", color: "#111" }] }), ["0_0"], {
      categoryId: "c1",
      featureName: "x",
    });
    const id = doc.features[0]!.id;
    doc = setFeatureFacility(doc, id, "toilet");
    expect(doc.features[0]!.facility).toBe("toilet");
    doc = setFeatureFacility(doc, id, null);
    expect(doc.features[0]!.facility).toBeUndefined();
  });
});
