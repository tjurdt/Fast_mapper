import { describe, expect, it } from "vitest";
import { MapGeometry } from "../src/core/geometry";
import { computeNumbers } from "../src/core/numbering";
import { makeDoc } from "./helpers";
import type { Feature } from "../src/core/types";

const feats = (...ids: string[]): Feature[] => ids.map((id) => ({ id, name: id, category: "cat1" }));

describe("computeNumbers", () => {
  it("依左側開口 → 最小 row 排序", () => {
    const doc = makeDoc({
      features: feats("A", "B", "C"),
      cells: {
        "0_0": { feature: "A" },
        "1_0": { feature: "A" },
        "2_0": { feature: "B" },
        "3_0": { feature: "B" },
        "0_3": { feature: "C" },
        "1_3": { feature: "C" },
      },
    });
    const numbers = computeNumbers(new MapGeometry(doc), doc.features);
    expect(numbers).toEqual({ A: 1, B: 2, C: 3 });
  });

  it("往左掃描跳過連續的 feature 欄", () => {
    // D 在 col 2，左邊 col 0-1 都被 E 佔滿 → D 的左側開口也是 -1，與 E 並列靠前
    const doc = makeDoc({
      features: feats("E", "D"),
      cells: {
        "0_0": { feature: "E" },
        "0_1": { feature: "E" },
        "0_2": { feature: "D" },
      },
    });
    const numbers = computeNumbers(new MapGeometry(doc), doc.features);
    // 同 firstOpenX(-1)、同 minY(0)，再比 minX：E(0) < D(2)
    expect(numbers).toEqual({ E: 1, D: 2 });
  });

  it("沒有格子的 feature 不編號", () => {
    const doc = makeDoc({
      features: feats("A", "ghost"),
      cells: { "0_0": { feature: "A" } },
    });
    expect(computeNumbers(new MapGeometry(doc), doc.features)).toEqual({ A: 1 });
  });

  it("編號穩定：相同版面重算結果一致", () => {
    const doc = makeDoc({
      features: feats("A", "B"),
      cells: { "0_0": { feature: "A" }, "0_5": { feature: "B" } },
    });
    const geo = new MapGeometry(doc);
    expect(computeNumbers(geo, doc.features)).toEqual(computeNumbers(geo, doc.features));
  });
});
