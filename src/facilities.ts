/**
 * 公共設施類型 —— 命名區域可標記為某設施，地圖與圖例顯示對應 icon。
 * 加新設施：在 FACILITIES 加一項（icon 用單一 emoji，canvas 匯出也吃得到）。
 */
export interface Facility {
  id: string;
  /** 顯示名稱（之後可移到 i18n）。 */
  label: string;
  /** 單一 emoji。 */
  icon: string;
}

export const FACILITIES: Facility[] = [
  { id: "toilet", label: "廁所", icon: "🚻" },
  { id: "toilet-accessible", label: "無障礙廁所", icon: "♿" },
  { id: "nursing", label: "哺乳室", icon: "🍼" },
  { id: "parking", label: "停車場", icon: "🅿️" },
  { id: "info", label: "服務台", icon: "ℹ️" },
  { id: "elevator", label: "電梯", icon: "🛗" },
  { id: "stairs", label: "樓梯", icon: "🪜" },
  { id: "exit", label: "出口", icon: "🚪" },
  { id: "water", label: "飲水機", icon: "🚰" },
  { id: "atm", label: "提款機", icon: "🏧" },
  { id: "firstaid", label: "醫護站", icon: "➕" },
  { id: "trash", label: "垃圾／回收", icon: "🗑️" },
  { id: "phone", label: "服務電話", icon: "📞" },
  { id: "wifi", label: "無線網路", icon: "📶" },
];

const BY_ID = new Map(FACILITIES.map((f) => [f.id, f]));

export function facilityById(id: string | undefined): Facility | undefined {
  return id ? BY_ID.get(id) : undefined;
}
