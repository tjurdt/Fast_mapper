import { describe, expect, it } from "vitest";
import {
  addWall,
  assignCells,
  deleteCut,
  deleteFeature,
  ensureFeatureRegions,
  eraseCells,
  moveSelection,
  setCutDepth,
  setFeatureCategory,
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
