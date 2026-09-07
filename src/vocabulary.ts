/**
 * 每個專案自訂「規劃層 / 分類 / 命名區域」在 UI 上怎麼稱呼。
 * core/ 一律用中性名稱，這裡只影響顯示文字。
 */
export interface Vocabulary {
  /** 規劃層（PlanLayer）的稱呼，例如「規劃分區」。 */
  planLayer: string;
  /** 實際分類（Category）的稱呼，例如「實際分類」「類別」。 */
  category: string;
  /** 命名區域（Feature）的稱呼，單數，例如「店家」「展位」「座位」「房間」。 */
  feature: string;
  /** 命名區域的集合稱呼，例如「店家清單」。預設為 `feature` + 「清單」。 */
  featureList?: string;
}

export const DEFAULT_VOCABULARY: Vocabulary = {
  planLayer: "底圖分類",
  category: "分類",
  feature: "區域",
};

export function featureListLabel(v: Vocabulary): string {
  return v.featureList ?? v.feature + "清單";
}
