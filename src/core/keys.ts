import type { CellKey } from "./types";

/** 一般格鍵 "r_c"。 */
export function gridKey(r: number, c: number): CellKey {
  return r + "_" + c;
}

/** 解析一般格鍵 → [row, col]。對 band 鍵無意義。 */
export function keyRC(k: CellKey): [number, number] {
  const i = k.indexOf("_");
  return [parseInt(k.slice(0, i), 10), parseInt(k.slice(i + 1), 10)];
}

/** band 格鍵以 'B' (charCode 66) 開頭。 */
export function isBandKey(k: CellKey): boolean {
  return k.charCodeAt(0) === 66;
}

export function bandKey(cutId: string, i: number, j: number): CellKey {
  return "B" + cutId + "_" + i + "_" + j;
}

export function parseBandKey(k: CellKey): { id: string; i: number; j: number } {
  const p = k.slice(1).split("_");
  return { id: p[0]!, i: Number(p[1]), j: Number(p[2]) };
}
