import { describe, expect, it } from "vitest";
import { MapGeometry } from "../src/core/geometry";
import { makeDoc } from "./helpers";
import type { Cell } from "../src/core/types";

describe("MapGeometry — 基本格子", () => {
  const geo = new MapGeometry(
    makeDoc({
      cells: {
        "0_0": { feature: "A" },
        "1_0": { feature: "A" },
        "0_3": {
          feature: "B",
          poly: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        } as Cell,
      },
    }),
  );

  it("方形格四邊形", () => {
    expect(geo.keyQuad("0_0")).toEqual([
      [0, 0],
      [14, 0],
      [14, 14],
      [0, 14],
    ]);
  });

  it("斜切格四邊形依 poly", () => {
    expect(geo.keyQuad("0_3")).toEqual([
      [42, 0],
      [56, 0],
      [42, 14],
    ]);
  });

  it("keyCenter 為頂點平均", () => {
    expect(geo.keyCenter("0_0")).toEqual([7, 7]);
  });

  it("cellNeighbors 回傳四鄰", () => {
    expect(geo.cellNeighbors("1_1")).toEqual(["0_1", "1_2", "2_1", "1_0"]);
  });

  it("命中測試落在 feature 上", () => {
    expect(geo.regularFeatureAtPoint(7, 7)).toBe("A");
    expect(geo.regularFeatureAtPoint(7, 30)).toBeNull(); // 空格
  });

  it("斜切格命中測試尊重 poly", () => {
    expect(geo.regularFeatureAtPoint(43, 1)).toBe("B"); // 三角形內
    expect(geo.regularFeatureAtPoint(55, 13)).toBeNull(); // 三角形外
  });
});

describe("MapGeometry — band 覆蓋", () => {
  const geo = new MapGeometry(
    makeDoc({
      cells: {
        "2_1": { feature: "X" },
        Bk1_0_0: { feature: "Y" },
      },
      cuts: [{ id: "k1", ax: 0, ay: 2, bx: 4, by: 2, side: 1, depth: 1 }],
    }),
  );

  it("被帶覆蓋的一般格不可見", () => {
    expect(geo.cellCovered("2_1")).toBe(true);
    expect(geo.cellVisible("2_1")).toBe(false);
    expect(geo.keyQuad("2_1")).toBeNull();
  });

  it("actual 視圖點擊優先落在 band 格", () => {
    expect(geo.cellAtPoint(21, 35, "actual")).toBe("Bk1_1_0");
    expect(geo.cellAtPoint(21, 35, "plan")).toBe("2_1");
  });

  it("band 格命中測試", () => {
    expect(geo.bandFeatureAtPoint(3, 30)).toBe("Y");
  });
});

describe("MapGeometry — featureBounds", () => {
  it("回傳所有可見格的影像座標包圍盒", () => {
    const geo = new MapGeometry(
      makeDoc({
        cells: { "1_1": { feature: "A" }, "1_2": { feature: "A" }, "3_1": { feature: "A" } },
      }),
    );
    expect(geo.featureBounds("A")).toEqual([14, 14, 42, 56]);
    expect(geo.featureBounds("missing")).toBeNull();
  });
});

describe("MapGeometry — 連通分量", () => {
  it("分開的兩塊算兩個分量", () => {
    const geo = new MapGeometry(
      makeDoc({
        grid: { w: 6, h: 4, cellPx: 14 },
        cells: {
          "0_0": { feature: "A" },
          "0_1": { feature: "A" },
          "3_4": { feature: "A" },
        },
      }),
    );
    const comps = geo.featureComponents("A");
    expect(comps.length).toBe(2);
    expect(geo.featureLabelAnchors("A").length).toBe(2);
  });
});
