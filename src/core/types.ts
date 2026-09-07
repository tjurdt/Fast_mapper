/**
 * 核心網域型別 —— 零 DOM、零框架。
 *
 * 命名採中性用語，UI 顯示名稱另由 `vocabulary` + `i18n` 決定：
 *   - PlanLayer  規劃層（原 zone）
 *   - Category   實際分類（原 cat）
 *   - Feature    由多個格子組成的命名區域（原 shop）
 */

/** 網格格子鍵："r_c"（一般格）或 "B<cutId>_<i>_<j>"（切線 band 格）。 */
export type CellKey = string;

/** `#rrggbb` 色碼字串。 */
export type HexColor = string;

export interface PlanLayer {
  id: string;
  name: string;
  color: HexColor;
}

export interface Category {
  id: string;
  name: string;
  color: HexColor;
}

export interface Feature {
  id: string;
  name: string;
  /** Category id */
  category: string;
  /** 公共設施類型 id（見 src/facilities.ts）；設定後地圖與圖例會顯示 icon。 */
  facility?: string;
}

/**
 * 格子的斜切外形：頂點為 `[x, y]`，座標在格子局部空間 0..1。
 * - `undefined`：整格方形
 * - `length >= 3`：多邊形
 * - `length < 3`：整格隱藏
 */
export type CellPoly = ReadonlyArray<readonly [number, number]>;

export interface Cell {
  /** PlanLayer id（規劃底圖） */
  plan?: string;
  /** Category id（實際分類上色） */
  cat?: string;
  /** Feature id（所屬命名區域） */
  feature?: string;
  /** 斜切外形 */
  poly?: CellPoly;
}

/** 切線 / 對齊帶。端點座標以「格」為單位（非像素）。 */
export interface Cut {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** 帶展開方向：-1 上側、1 下側、0 雙側。 */
  side: -1 | 0 | 1;
  /** 帶的深度（格數）。0 表示只是一條線。 */
  depth: number;
  /** 是否為實牆（會被匯出、阻擋覆蓋）。 */
  wall?: boolean;
}

export interface GridSpec {
  w: number;
  h: number;
  /** 每格像素大小（影像空間）。 */
  cellPx: number;
}

export interface BaseImageSpec {
  /** persistence 層 blob store 的鍵。 */
  blobId: string;
  opacity: number;
  transform: { x: number; y: number; scale: number; rotation: number };
}

/** 一張地圖的完整內容（一個專案的可繪製資料）。 */
export interface MapDoc {
  grid: GridSpec;
  planLayers: PlanLayer[];
  categories: Category[];
  features: Feature[];
  cells: Record<CellKey, Cell>;
  cuts: Cut[];
  baseImage?: BaseImageSpec;
}

export type Point = readonly [number, number];
/** 凸/凹多邊形，影像空間座標。 */
export type Polygon = ReadonlyArray<Point>;
