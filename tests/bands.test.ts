import { describe, expect, it } from "vitest";
import { bandLocate, bandOuter, computeBandCover, cutGeom } from "../src/core/bands";
import type { Cut } from "../src/core/types";

const H_CUT: Cut = { id: "k1", ax: 0, ay: 2, bx: 4, by: 2, side: 1, depth: 1 };

describe("cutGeom", () => {
  it("水平切線的方向與法向量", () => {
    const g = cutGeom(H_CUT, 14, 14);
    expect(g.ux).toBeCloseTo(1);
    expect(g.uy).toBeCloseTo(0);
    expect(g.nx).toBeCloseTo(0);
    expect(g.ny).toBeCloseTo(1); // side=1 → 往下
    expect(g.L).toBeCloseTo(56);
    expect(g.k).toBe(4);
    expect(g.step).toBeCloseTo(14);
    expect(g.jMin).toBe(0);
    expect(g.jMax).toBe(0);
  });

  it("side=0 時雙側展開", () => {
    const g = cutGeom({ ...H_CUT, side: 0, depth: 2 }, 14, 14);
    expect(g.jMin).toBe(-2);
    expect(g.jMax).toBe(1);
  });
});

describe("bandOuter", () => {
  it("水平帶外框為軸對齊矩形", () => {
    const pts = bandOuter(cutGeom(H_CUT, 14, 14));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(56);
    expect(Math.min(...ys)).toBeCloseTo(28);
    expect(Math.max(...ys)).toBeCloseTo(42);
  });
});

describe("bandLocate", () => {
  it("帶內座標 → 格索引", () => {
    const g = cutGeom(H_CUT, 14, 14);
    expect(bandLocate(g, 21, 35)).toEqual({ i: 1, j: 0 });
    expect(bandLocate(g, 3, 30)).toEqual({ i: 0, j: 0 });
  });
  it("帶外 → null", () => {
    const g = cutGeom(H_CUT, 14, 14);
    expect(bandLocate(g, 21, 10)).toBeNull(); // 在切線上方
    expect(bandLocate(g, 200, 35)).toBeNull(); // 超出長度
  });
});

describe("computeBandCover", () => {
  it("水平帶覆蓋整列格子", () => {
    const cover = computeBandCover([H_CUT], 14, 14, 6, 4);
    expect([...cover].sort()).toEqual(["2_0", "2_1", "2_2", "2_3"]);
  });
  it("depth 0 不覆蓋任何格", () => {
    expect(computeBandCover([{ ...H_CUT, depth: 0 }], 14, 14, 6, 4).size).toBe(0);
  });
});
