import type { Template } from "./types";
import { blankGridTemplate, blankImageTemplate } from "./blank";

export type { Template } from "./types";

/**
 * 新專案可選的範本。東港華僑市場**不在此清單**——它是特定場域，不適合當通用起點；
 * 其資料模組（`donggangMarket.ts`）只保留給 legacy localStorage 匯入用。
 */
export const TEMPLATES: Template[] = [blankGridTemplate, blankImageTemplate];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
