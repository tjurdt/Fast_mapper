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
