import type { NewProjectInput } from "../model/schema";

/** 一個內建範本：新專案的起始內容。 */
export interface Template {
  id: string;
  /** 範本清單上顯示的名稱。 */
  title: string;
  /** 一行說明。 */
  description: string;
  /** 套用範本時傳給 createProject 的內容。 */
  build(): NewProjectInput;
}
