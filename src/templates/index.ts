import type { Template } from "./types";
import { blankGridTemplate, blankImageTemplate } from "./blank";
import { donggangMarketTemplate } from "./donggangMarket";

export type { Template } from "./types";

export const TEMPLATES: Template[] = [blankGridTemplate, blankImageTemplate, donggangMarketTemplate];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
