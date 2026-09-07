import type { MapDoc } from "../src/core/types";

/** 建一份最小 MapDoc，欄位可覆寫。 */
export function makeDoc(partial: Partial<MapDoc> = {}): MapDoc {
  return {
    grid: { w: 6, h: 4, cellPx: 14 },
    planLayers: [],
    categories: [{ id: "cat1", name: "分類一", color: "#ED7D31" }],
    features: [],
    cells: {},
    cuts: [],
    ...partial,
  };
}
