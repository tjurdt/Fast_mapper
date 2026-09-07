import type { CellKey, MapDoc } from "../core/types";
import type { MapGeometry } from "../core/geometry";
import type { ViewSettings } from "../model/schema";

/** 一次重繪所需的全部輸入。由 store 組裝、傳給 renderer。 */
export interface Scene {
  doc: MapDoc;
  geo: MapGeometry;
  view: ViewSettings;
  numbers: Record<string, number>;
  selection: ReadonlySet<CellKey>;
  /** 高亮顯示的命名區域（點選清單 / 地圖時）。 */
  highlightFeature: string | null;
  /** 目前是否在切線模式（畫出虛線幽靈切線）。 */
  cutMode: boolean;
  /** 拖曳框選中的矩形（影像單位座標 [x0,y0,x1,y1]）。 */
  dragRect: readonly [number, number, number, number] | null;
  /** 正在拉的幽靈切線（格為單位 [ax,ay,bx,by]）。 */
  ghostCut: readonly [number, number, number, number] | null;
}

export interface SceneDims {
  cw: number;
  ch: number;
  imgW: number;
  imgH: number;
  gridW: number;
  gridH: number;
}

export function sceneDims(geo: MapGeometry): SceneDims {
  return {
    cw: geo.cw,
    ch: geo.ch,
    imgW: geo.gridW * geo.cw,
    imgH: geo.gridH * geo.ch,
    gridW: geo.gridW,
    gridH: geo.gridH,
  };
}
