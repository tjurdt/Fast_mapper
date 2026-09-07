/**
 * 雲端同步 adapter 的骨架 —— 尚未實作。
 *
 * 之後接後端時：實作這個 class 的每個方法（打 REST / 你的後端），
 * 在 persistence/index.ts 的 createStorageAdapter() 依登入狀態選用它，
 * store 與 UI 完全不需改（都只依賴 StorageAdapter 介面）。
 *
 * 建議設計：
 *  - 本機 IndexedDbAdapter 當離線快取 + 樂觀更新
 *  - RemoteAdapter 包住它，背景 push/pull，用 updatedAt 或版本號解衝突
 *  - saveProject 先寫本機、標記 dirty、再非同步同步
 */
import type { Project } from "../model/schema";
import type { ProjectSummary, StorageAdapter } from "./adapter";

export interface RemoteConfig {
  baseUrl: string;
  getToken: () => string | null;
}

export class RemoteAdapter implements StorageAdapter {
  constructor(private readonly config: RemoteConfig) {
    void this.config;
  }

  private notImplemented(): never {
    throw new Error("RemoteAdapter 尚未實作 —— 見 src/persistence/remote.ts");
  }

  listProjects(): Promise<ProjectSummary[]> {
    return this.notImplemented();
  }
  loadProject(_id: string): Promise<Project | null> {
    return this.notImplemented();
  }
  saveProject(_project: Project): Promise<void> {
    return this.notImplemented();
  }
  deleteProject(_id: string): Promise<void> {
    return this.notImplemented();
  }
  putBlob(_id: string, _blob: Blob): Promise<void> {
    return this.notImplemented();
  }
  getBlob(_id: string): Promise<Blob | null> {
    return this.notImplemented();
  }
  deleteBlob(_id: string): Promise<void> {
    return this.notImplemented();
  }
  getMeta<T = unknown>(_key: string): Promise<T | undefined> {
    return this.notImplemented();
  }
  setMeta(_key: string, _value: unknown): Promise<void> {
    return this.notImplemented();
  }
}
