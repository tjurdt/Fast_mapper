/**
 * 東港華僑市場範本 —— legacy app 寫死的預設，現在只是眾多範本之一。
 * 分區 / 分類 = legacy DEFAULT_ZONES / DEFAULT_CATS；
 * 底圖格 = legacy defaultPlanCells()（DEFAULT_PLAN_CELLS 去掉牆壁 zw/zf/zs）。
 */
import type { Cell, Category, PlanLayer } from "../core/types";
import type { Template } from "./types";

export const DONGGANG_PLAN_LAYERS: PlanLayer[] = [
  { id: "z1", name: "熟食區", color: "#ED7D31" },
  { id: "z2", name: "蔬果肉品區", color: "#70AD47" },
  { id: "z3", name: "魚特產與冷飲區", color: "#2E75B6" },
  { id: "z4", name: "拖網魚類現撈區", color: "#FFD966" },
  { id: "z5", name: "蝦拖網魚類現撈區", color: "#FF66FF" },
  { id: "z6", name: "魚類分切零售區", color: "#9966FF" },
  { id: "z7", name: "生食區", color: "#BF9000" },
  { id: "z8", name: "東港區漁會展售門市部", color: "#00CC99" },
  { id: "z9", name: "其他", color: "#D9DEE0" },
];

export const DONGGANG_CATEGORIES: Category[] = DONGGANG_PLAN_LAYERS.map((z, i) => ({
  id: "c" + (i + 1),
  name: z.name,
  color: z.color,
}));

/** legacy 分類別名 → 正規分類 id（用於匯入舊 localStorage 存檔）。 */
export const LEGACY_CATEGORY_ALIASES: string[][] = [
  ["熟食", "熟食區"],
  ["蔬果肉品", "蔬果肉品區"],
  ["漁特產冷飲", "魚特產冷飲", "魚特產與冷飲區"],
  ["黃區", "拖網魚類現撈區"],
  ["粉區", "蝦拖網魚類現撈區"],
  ["上方紫帶", "魚類分切零售區"],
  ["下方棕攤", "生食區"],
  ["青綠區", "東港區漁會展售門市部"],
  ["設施", "走道/結構", "其他"],
  ["牆/外框", "牆壁"],
];

/** 底圖格資料（~34KB）獨立 code-split，只在建立此範本時才載入。 */
export async function donggangPlanCells(): Promise<Record<string, Cell>> {
  const raw = (await import("./donggang-market.cells.json")).default as Record<string, { plan: string }>;
  const out: Record<string, Cell> = {};
  for (const k in raw) out[k] = { plan: raw[k]!.plan };
  return out;
}

export const donggangMarketTemplate: Template = {
  id: "donggang-market",
  title: "東港華僑市場",
  description: "原始範本：9 個規劃分區、既有攤位底圖，網格 156 × 54。",
  build: async () => ({
    name: "東港華僑市場",
    vocabulary: { planLayer: "底圖分類", category: "實際分類", feature: "店家" },
    doc: {
      grid: { w: 156, h: 54, cellPx: 14 },
      planLayers: DONGGANG_PLAN_LAYERS.map((z) => ({ ...z })),
      categories: DONGGANG_CATEGORIES.map((c) => ({ ...c })),
      cells: await donggangPlanCells(),
    },
  }),
};
