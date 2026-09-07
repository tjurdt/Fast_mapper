/**
 * 儲存媒介抽象。目前只有 IndexedDB 實作；雲端同步日後新增 `remote.ts`
 * 實作同一介面，上層（store / UI）不需改動。
 */
import type { Project } from "../model/schema";

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface StorageAdapter {
  listProjects(): Promise<ProjectSummary[]>;
  loadProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  /** 底圖圖片等二進位資產。 */
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | null>;
  deleteBlob(id: string): Promise<void>;

  /** 小型鍵值：上次開啟的專案 id、legacy 匯入旗標等。 */
  getMeta<T = unknown>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}
