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
  moveCutEndpoint,
  type BandStashEntry,
  moveObjects,
  moveSelection,
  pasteObjects,
  setCutDepth,
  setFeatureCategory,
  setFeatureFacility,
} from "../src/model/edits";
import { polyArea } from "../src/core/poly";
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

  it("斜切格已屬別區時：兩片段共存、互補鋪滿整格、主片段取面積大者", () => {
    let doc = makeDoc({
      categories: [
        { id: "c1", name: "A", color: "#111" },
        { id: "c2", name: "B", color: "#222" },
      ],
    });
    // 這格 70% 給 A
    doc = assignCells(doc, ["0_0"], {
      categoryId: "c1",
      featureName: "A區",
      shapes: new Map([
        [
          "0_0",
          [
            [0, 0],
            [1, 0],
            [1, 0.7],
            [0, 0.7],
          ] as [number, number][],
        ],
      ]),
    });
    // 再把剩下 30% 給 B → A 保留為主片段、B 成為 frag，兩片鋪滿整格
    doc = assignCells(doc, ["0_0"], {
      categoryId: "c2",
      featureName: "B區",
      shapes: new Map([
        [
          "0_0",
          [
            [0, 0.7],
            [1, 0.7],
            [1, 1],
            [0, 1],
          ] as [number, number][],
        ],
      ]),
    });
    const d = doc.cells["0_0"]!;
    expect(d.cat).toBe("c1"); // 主片段＝面積大的 A
    expect(d.frags).toHaveLength(1);
    expect(d.frags![0]!.cat).toBe("c2");
    const covered = polyArea(d.poly!) + d.frags!.reduce((s, f) => s + polyArea(f.poly), 0);
    expect(covered).toBeGreaterThan(0.98);
    expect(covered).toBeLessThan(1.02);

    // 再指定同一格給 A（含 B 那塊）→ frags 清空、整格回歸 A
    doc = assignCells(doc, ["0_0"], { categoryId: "c1", featureId: d.feature });
    expect(doc.cells["0_0"]!.frags).toBeUndefined();
    expect(doc.cells["0_0"]!.cat).toBe("c1");
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

  it("copyObjects 複製牆（新 id）與格內容、來源保留、共用 feature id", () => {
    const doc = build();
    const r = copyObjects(doc, { cutIds: ["w1"], cellKeys: ["3_3"] }, 0, 4);
    expect(r.ok).toBe(true);
    expect(doc.cuts).toHaveLength(2);
    expect(r.cutIds[0]).not.toBe("w1");
    expect(doc.cells["3_3"]).toBeDefined();
    expect(doc.cells["7_3"]!.feature).toBeDefined();
    // 不再造新 feature id：複本與來源共用同一個（分開的兩塊，靠連通分量避免連動選取）
    expect(doc.cells["7_3"]!.feature).toBe(doc.cells["3_3"]!.feature);
    expect(doc.features.length).toBe(1);
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

  it("pasteObjects：貼上位置靠邊 → 夾進網格、至少貼得下", () => {
    const doc = build(); // grid 12x12
    const clip = buildClipboard(doc, { cutIds: [], cellKeys: ["3_3"] })!;
    // 點在最右下角 (11,11)，內容 1 格 → 夾到 (11,11) 貼得下
    const res = pasteObjects(doc, clip, 11, 11);
    expect(res.cellKeys.length).toBe(1);
    expect(doc.cells["11_11"]!.feature).toBeDefined();
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

describe("moveCutEndpoint：斜格內容依段索引搬移／犧牲", () => {
  it("把 a 端拉近時，犧牲的是靠近 a 端（正在移動）的斜格內容", () => {
    // 水平切線 a=(2,10)→b=(22,10)，cellPx 10 → 影像 20..220，長 200，U=10 → k≈20 段
    let doc = makeDoc({
      grid: { w: 30, h: 20, cellPx: 10 },
      cuts: [{ id: "w1", ax: 2, ay: 10, bx: 22, by: 10, side: 1, depth: 1, wall: true }],
    });
    // 第 0 段（靠 a）與第 18 段（靠 b）各放一個店家
    doc.cells["Bw1_0_0"] = { cat: "c1", feature: "nearA" };
    doc.cells["Bw1_18_0"] = { cat: "c1", feature: "nearB" };

    // 把 a 端往 b 拉近 10 格（新 a=(12,10)）→ 線縮短一半
    doc = moveCutEndpoint(doc, "w1", "a", 12, 10);

    const keys = Object.keys(doc.cells).filter((k) => k.startsWith("Bw1_"));
    const feats = new Set(keys.map((k) => doc.cells[k]!.feature));
    expect(feats.has("nearB")).toBe(true); // 靠 b 端的保留
    expect(feats.has("nearA")).toBe(false); // 靠 a 端（移動中）的被犧牲
  });

  it("拉長切線時斜格內容都保留、往 b 端延伸不影響靠 a 的內容", () => {
    let doc = makeDoc({
      grid: { w: 40, h: 20, cellPx: 10 },
      cuts: [{ id: "w1", ax: 2, ay: 10, bx: 12, by: 10, side: 1, depth: 1, wall: true }],
    });
    doc.cells["Bw1_0_0"] = { cat: "c1", feature: "a" };
    doc.cells["Bw1_8_0"] = { cat: "c1", feature: "b" };
    doc = moveCutEndpoint(doc, "w1", "b", 30, 10); // 只把 b 端往外拉，不動 a 端
    const feats = new Set(
      Object.keys(doc.cells)
        .filter((k) => k.startsWith("Bw1_"))
        .map((k) => doc.cells[k]!.feature),
    );
    expect(feats.has("a")).toBe(true);
    expect(feats.has("b")).toBe(true);
  });

  it("長度不變（繞 a 端轉一圈回原位）→ 斜格內容完全不變", () => {
    let doc = makeDoc({
      grid: { w: 30, h: 30, cellPx: 10 },
      cuts: [{ id: "w1", ax: 5, ay: 15, bx: 15, by: 15, side: 1, depth: 2, wall: true }],
    });
    doc.cells["Bw1_2_0"] = { cat: "c1", feature: "x" };
    doc.cells["Bw1_5_1"] = { cat: "c1", feature: "x" };
    const before = JSON.stringify(
      Object.keys(doc.cells)
        .filter((k) => k.startsWith("Bw1_"))
        .sort(),
    );
    // b 端維持與 a 距離 10（等長）：從 (15,15) 轉到 (5,25) 再轉回 (15,15)
    doc = moveCutEndpoint(doc, "w1", "b", 5, 25);
    doc = moveCutEndpoint(doc, "w1", "b", 15, 15);
    const after = JSON.stringify(
      Object.keys(doc.cells)
        .filter((k) => k.startsWith("Bw1_"))
        .sort(),
    );
    expect(after).toBe(before);
  });

  it("stash：縮短犧牲的內容在同一次編輯內把線拉回去會復原", () => {
    let doc = makeDoc({
      grid: { w: 40, h: 20, cellPx: 10 },
      cuts: [{ id: "w1", ax: 2, ay: 10, bx: 22, by: 10, side: 1, depth: 1, wall: true }],
    });
    doc.cells["Bw1_0_0"] = { cat: "c1", feature: "nearA" };
    doc.cells["Bw1_18_0"] = { cat: "c1", feature: "nearB" };

    const stash: BandStashEntry[] = [];
    // b 端拉近 → 靠 b 的 nearB 被犧牲，進 stash
    doc = moveCutEndpoint(doc, "w1", "b", 8, 10, stash);
    let feats = new Set(
      Object.keys(doc.cells)
        .filter((k) => k.startsWith("Bw1_"))
        .map((k) => doc.cells[k]!.feature),
    );
    expect(feats.has("nearA")).toBe(true);
    expect(feats.has("nearB")).toBe(false);
    expect(stash.length).toBeGreaterThan(0);

    // 同一次編輯內把 b 端拉回原位 → nearB 復原
    doc = moveCutEndpoint(doc, "w1", "b", 22, 10, stash);
    feats = new Set(
      Object.keys(doc.cells)
        .filter((k) => k.startsWith("Bw1_"))
        .map((k) => doc.cells[k]!.feature),
    );
    expect(feats.has("nearB")).toBe(true);
    expect(stash.length).toBe(0);
  });

  it("stash：不帶 stash（切到別條線後）縮短再拉長不復原", () => {
    let doc = makeDoc({
      grid: { w: 40, h: 20, cellPx: 10 },
      cuts: [{ id: "w1", ax: 2, ay: 10, bx: 22, by: 10, side: 1, depth: 1, wall: true }],
    });
    doc.cells["Bw1_18_0"] = { cat: "c1", feature: "nearB" };
    doc = moveCutEndpoint(doc, "w1", "b", 8, 10); // 無 stash
    doc = moveCutEndpoint(doc, "w1", "b", 22, 10);
    const feats = new Set(
      Object.keys(doc.cells)
        .filter((k) => k.startsWith("Bw1_"))
        .map((k) => doc.cells[k]!.feature),
    );
    expect(feats.has("nearB")).toBe(false);
  });
});
