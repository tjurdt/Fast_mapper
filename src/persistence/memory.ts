import type { Project } from "../model/schema";
import { loadProject, serializeProject } from "../model/document";
import type { ProjectSummary, StorageAdapter } from "./adapter";

/** 純記憶體實作 —— 測試與 SSR / 無 IndexedDB 環境的後備。 */
export class MemoryAdapter implements StorageAdapter {
  private projects = new Map<string, Record<string, unknown>>();
  private blobs = new Map<string, Blob>();
  private meta = new Map<string, unknown>();

  async listProjects(): Promise<ProjectSummary[]> {
    return [...this.projects.values()]
      .map((d) => ({
        id: d.id as string,
        name: d.name as string,
        createdAt: d.createdAt as number,
        updatedAt: d.updatedAt as number,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async loadProject(id: string): Promise<Project | null> {
    const d = this.projects.get(id);
    return d ? loadProject(d) : null;
  }
  async saveProject(project: Project): Promise<void> {
    this.projects.set(project.id, serializeProject(project));
  }
  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }
  async putBlob(id: string, blob: Blob): Promise<void> {
    this.blobs.set(id, blob);
  }
  async getBlob(id: string): Promise<Blob | null> {
    return this.blobs.get(id) ?? null;
  }
  async deleteBlob(id: string): Promise<void> {
    this.blobs.delete(id);
  }
  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta(key: string, value: unknown): Promise<void> {
    this.meta.set(key, value);
  }
}
