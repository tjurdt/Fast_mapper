import { describe, expect, it } from "vitest";
import {
  clamp,
  clipPolyToRect,
  pointInPoly,
  pointSegDist,
  polyArea,
  subtractIntervals,
} from "../src/core/poly";
import type { Polygon } from "../src/core/types";

const UNIT: Polygon = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

describe("polyArea", () => {
  it("計算單位正方形面積", () => {
    expect(polyArea(UNIT)).toBeCloseTo(1);
  });
  it("與頂點方向無關", () => {
    const reversed: Polygon = [...UNIT].reverse();
    expect(polyArea(reversed)).toBeCloseTo(1);
  });
  it("三角形", () => {
    expect(
      polyArea([
        [0, 0],
        [4, 0],
        [0, 3],
      ]),
    ).toBeCloseTo(6);
  });
});

describe("clipPolyToRect", () => {
  it("完全在內時不改變面積", () => {
    expect(polyArea(clipPolyToRect(UNIT, -1, -1, 2, 2))).toBeCloseTo(1);
  });
  it("裁掉一半", () => {
    expect(polyArea(clipPolyToRect(UNIT, 0, 0, 0.5, 1))).toBeCloseTo(0.5);
  });
  it("完全在外時面積為 0", () => {
    expect(polyArea(clipPolyToRect(UNIT, 5, 5, 6, 6))).toBeCloseTo(0);
  });
});

describe("pointInPoly", () => {
  it("內部點", () => {
    expect(pointInPoly(0.5, 0.5, UNIT)).toBe(true);
  });
  it("外部點", () => {
    expect(pointInPoly(1.5, 0.5, UNIT)).toBe(false);
  });
  it("三角形斜邊外", () => {
    const tri: Polygon = [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
    expect(pointInPoly(0.9, 0.9, tri)).toBe(false);
    expect(pointInPoly(0.2, 0.2, tri)).toBe(true);
  });
});

describe("pointSegDist", () => {
  it("垂直距離", () => {
    expect(pointSegDist(1, 1, 0, 0, 2, 0)).toBeCloseTo(1);
  });
  it("端點外側夾到端點", () => {
    expect(pointSegDist(-3, 0, 0, 0, 2, 0)).toBeCloseTo(3);
  });
});

describe("subtractIntervals", () => {
  it("中間挖洞", () => {
    expect(subtractIntervals([0, 1], [[0.4, 0.6]])).toEqual([
      [0, 0.4],
      [0.6, 1],
    ]);
  });
  it("完全覆蓋 → 空", () => {
    expect(subtractIntervals([0, 1], [[-1, 2]])).toEqual([]);
  });
  it("不相交 → 原樣", () => {
    expect(subtractIntervals([0, 1], [[2, 3]])).toEqual([[0, 1]]);
  });
  it("多段相減", () => {
    expect(
      subtractIntervals(
        [0, 10],
        [
          [1, 2],
          [5, 6],
        ],
      ),
    ).toEqual([
      [0, 1],
      [2, 5],
      [6, 10],
    ]);
  });
});

describe("clamp", () => {
  it("夾在範圍內", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
