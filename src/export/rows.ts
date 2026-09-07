/** feature 對照表資料列（給 XLSX）。移植自 legacy exportRows。 */
import type { MapDoc } from "../core/types";
import type { MapGeometry } from "../core/geometry";
import type { XlsxCell } from "./xlsx";
import { orderedFeatures } from "./layout";

export function buildRows(
  doc: MapDoc,
  geo: MapGeometry,
  numbers: Record<string, number>,
  headers: { number: string; feature: string; category: string },
): XlsxCell[][] {
  const catName = new Map(doc.categories.map((c) => [c.id, c.name]));
  const idx = geo.featureKeyIndex();
  const rows: XlsxCell[][] = [
    [
      { t: "s", v: headers.number },
      { t: "s", v: headers.feature },
      { t: "s", v: headers.category },
      { t: "s", v: "格數" },
      { t: "s", v: "分布區塊數" },
      { t: "s", v: "首格位置" },
    ],
  ];
  for (const f of orderedFeatures(doc, geo, numbers)) {
    const keys = idx.get(f.id) ?? [];
    const anchor = geo.featureAnchor(f.id, keys);
    rows.push([
      { t: "n", v: numbers[f.id] ?? 0 },
      { t: "s", v: f.name },
      { t: "s", v: catName.get(f.category) ?? "" },
      { t: "n", v: keys.length },
      { t: "n", v: geo.featureComponents(f.id, keys).length },
      { t: "s", v: anchor ? `第 ${Math.round(anchor[0]) + 1} 列／第 ${Math.round(anchor[1]) + 1} 欄` : "" },
    ]);
  }
  return rows;
}
