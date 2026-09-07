/**
 * Feature 編號演算法。移植自 legacy 的 shopSortMetrics + recompute。
 *
 * 排序鍵（由前到後）：
 *   1. 左側開口 x（往左數到第一個沒有 feature 的欄）—— 越靠左的動線入口越前面
 *   2. 佔用格的最小 row
 *   3. 佔用格的最小 col
 *   4. 平均 x + 1.01 × 平均 y（讓同列由左到右、再往下一列）
 *   5. feature id（穩定 tie-break）
 */
import type { CellKey, Feature } from "./types";
import { isBandKey, keyRC } from "./keys";
import type { MapGeometry } from "./geometry";

export interface FeatureSortMetrics {
  firstOpenX: number;
  minY: number;
  minX: number;
  averageScore: number;
}

export function featureSortMetrics(geo: MapGeometry, keys: CellKey[]): FeatureSortMetrics | null {
  let firstOpenX = Infinity;
  let minY = Infinity;
  let minX = Infinity;
  let sumX = 0;
  let sumY = 0;
  let n = 0;
  for (const k of keys) {
    const d = geo.cell(k);
    if (!d) continue;
    let y: number;
    let x: number;
    let left: number;
    if (isBandKey(k)) {
      const ctr = geo.keyCenter(k);
      if (!ctr) continue;
      x = ctr[0] / geo.cw - 0.5;
      y = ctr[1] / geo.ch - 0.5;
      left = Math.floor(x) - 1;
    } else {
      const [r, c] = keyRC(k);
      y = r;
      x = c;
      left = x - 1;
      while (left >= 0 && geo.cell(r + "_" + left)?.feature) left--;
    }
    firstOpenX = Math.min(firstOpenX, left);
    minY = Math.min(minY, y);
    minX = Math.min(minX, x);
    sumX += x;
    sumY += y;
    n++;
  }
  return n ? { firstOpenX, minY, minX, averageScore: sumX / n + 1.01 * (sumY / n) } : null;
}

/** 回傳 featureId → 編號（1-based）。沒有可見格的 feature 不編號。 */
export function computeNumbers(
  geo: MapGeometry,
  features: readonly Feature[],
  idx?: Map<string, CellKey[]>,
): Record<string, number> {
  const index = idx ?? geo.featureKeyIndex();
  const arr = features
    .map((f) => {
      const keys = index.get(f.id);
      if (!keys) return null;
      const m = featureSortMetrics(geo, keys);
      return m ? { id: f.id, ...m } : null;
    })
    .filter((x): x is { id: string } & FeatureSortMetrics => !!x);

  arr.sort(
    (p, q) =>
      p.firstOpenX - q.firstOpenX ||
      p.minY - q.minY ||
      p.minX - q.minX ||
      p.averageScore - q.averageScore ||
      p.id.localeCompare(q.id),
  );

  const numbers: Record<string, number> = {};
  arr.forEach((x, i) => (numbers[x.id] = i + 1));
  return numbers;
}
