import { describe, expect, it } from "vitest";
import { MapGeometry } from "../src/core/geometry";
import { selectEnclosedRegion } from "../src/core/enclosed";
import { assignCells } from "../src/model/edits";
import { makeDoc } from "./helpers";
import type { Cut } from "../src/core/types";

/** 由 (2,2)–(5,5) 四邊圍成的方框（格頂點座標）。 */
const box: Cut[] = [
  { id: "w1", ax: 2, ay: 2, bx: 5, by: 2, side: 1, depth: 0, wall: true },
  { id: "w2", ax: 5, ay: 2, bx: 5, by: 5, side: 1, depth: 0, wall: true },
  { id: "w3", ax: 5, ay: 5, bx: 2, by: 5, side: 1, depth: 0, wall: true },
  { id: "w4", ax: 2, ay: 5, bx: 2, by: 2, side: 1, depth: 0, wall: true },
];

describe("selectEnclosedRegion", () => {
  const doc = makeDoc({ grid: { w: 8, h: 8, cellPx: 14 }, cuts: box });
  const geo = new MapGeometry(doc);

  it("點框內空白處 → 選取封閉的 9 格", () => {
    const res = selectEnclosedRegion(geo, 3.5 * 14, 3.5 * 14, "plan");
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(res.keys.sort()).toEqual(["2_2", "2_3", "2_4", "3_2", "3_3", "3_4", "4_2", "4_3", "4_4"]);
  });

  it("點框外 → 回傳未封閉錯誤", () => {
    const res = selectEnclosedRegion(geo, 0.5 * 14, 0.5 * 14, "plan");
    expect("error" in res).toBe(true);
  });

  it("沒有切線 → 錯誤訊息", () => {
    const bare = new MapGeometry(makeDoc({ grid: { w: 8, h: 8, cellPx: 14 } }));
    const res = selectEnclosedRegion(bare, 20, 20, "plan");
    expect("error" in res && res.error).toContain("切線");
  });
});

/** 直角三角形 (2,2)-(8,2)-(2,8)，中線 (5,2)-(2,5) 把靠 (2,2) 的角切成 A 半、其餘為 B 半。 */
const triangle: Cut[] = [
  { id: "t1", ax: 2, ay: 2, bx: 8, by: 2, side: 1, depth: 0, wall: true },
  { id: "t2", ax: 2, ay: 2, bx: 2, by: 8, side: 1, depth: 0, wall: true },
  { id: "t3", ax: 8, ay: 2, bx: 2, by: 8, side: 1, depth: 0, wall: true },
  { id: "mid", ax: 5, ay: 2, bx: 2, by: 5, side: 1, depth: 0, wall: true },
];

describe("被中線切開的三角形 A/B 兩半", () => {
  const cats = [
    { id: "cA", name: "A", color: "#111" },
    { id: "cB", name: "B", color: "#222" },
  ];
  const geo = new MapGeometry(makeDoc({ grid: { w: 12, h: 12, cellPx: 10 }, cuts: triangle, categories: cats }));

  it("選 A 半上色、再選 B 半上色，A 半不會被 B 吃掉", () => {
    const rA = selectEnclosedRegion(geo, 2.6 * 10, 2.6 * 10, "plan");
    expect("error" in rA).toBe(false);
    if ("error" in rA) return;
    const rB = selectEnclosedRegion(geo, 5 * 10, 4 * 10, "plan");
    expect("error" in rB).toBe(false);
    if ("error" in rB) return;

    // 中線把兩半分開：A 半深處的格不應出現在 B 半的選取結果
    expect(rB.keys).not.toContain("2_2");
    // 兩半不共用「整格內部格」（邊界斜切格允許重疊，之後由 assignCells 依面積裁決）
    const interiorA = rA.keys.filter((k) => !rA.shapes.get(k));
    const interiorB = new Set(rB.keys.filter((k) => !rB.shapes.get(k)));
    for (const k of interiorA) expect(interiorB.has(k)).toBe(false);

    let doc = makeDoc({ grid: { w: 12, h: 12, cellPx: 10 }, cuts: triangle, categories: cats });
    doc = assignCells(doc, rA.keys, { categoryId: "cA", shapes: rA.shapes });
    const featA = doc.cells["2_2"]!.feature;
    doc = assignCells(doc, rB.keys, { categoryId: "cB", shapes: rB.shapes });
    // A 半內部格仍屬 A
    expect(doc.cells["2_2"]!.cat).toBe("cA");
    expect(doc.cells["2_2"]!.feature).toBe(featA);
  });
});

describe("assignCells with shapes", () => {
  it("套用裁切形狀成為 cell.poly", () => {
    const shapes = new Map([
      [
        "0_0",
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ] as [number, number][],
      ],
    ]);
    const doc = assignCells(makeDoc({ categories: [{ id: "c1", name: "A", color: "#111" }] }), ["0_0"], {
      categoryId: "c1",
      shapes,
    });
    expect(doc.cells["0_0"]!.poly).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
    ]);
  });
});
