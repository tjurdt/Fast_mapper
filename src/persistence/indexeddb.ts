import { openDB, type IDBPDatabase } from "idb";
import type { Project } from "../model/schema";
import { loadProject, serializeProject } from "../model/document";
import type { ProjectSummary, StorageAdapter } from "./adapter";

const DB_NAME = "fast-mapper";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_BLOBS = "blobs";
const STORE_META = "meta";

interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: Record<string, unknown>;
}

function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE_PROJECTS))
        d.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      if (!d.objectStoreNames.contains(STORE_BLOBS)) d.createObjectStore(STORE_BLOBS);
      if (!d.objectStoreNames.contains(STORE_META)) d.createObjectStore(STORE_META);
    },
  });
}

export class IndexedDbAdapter implements StorageAdapter {
  async listProjects(): Promise<ProjectSummary[]> {
    const all = (await (await db()).getAll(STORE_PROJECTS)) as StoredProject[];
    return all
      .map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async loadProject(id: string): Promise<Project | null> {
    const row = (await (await db()).get(STORE_PROJECTS, id)) as StoredProject | undefined;
    return row ? loadProject(row.data) : null;
  }

  async saveProject(project: Project): Promise<void> {
    const row: StoredProject = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      data: serializeProject(project),
    };
    await (await db()).put(STORE_PROJECTS, row);
  }

  async deleteProject(id: string): Promise<void> {
    await (await db()).delete(STORE_PROJECTS, id);
  }

  async putBlob(id: string, blob: Blob): Promise<void> {
    await (await db()).put(STORE_BLOBS, blob, id);
  }
  async getBlob(id: string): Promise<Blob | null> {
    return ((await (await db()).get(STORE_BLOBS, id)) as Blob | undefined) ?? null;
  }
  async deleteBlob(id: string): Promise<void> {
    await (await db()).delete(STORE_BLOBS, id);
  }

  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    return (await (await db()).get(STORE_META, key)) as T | undefined;
  }
  async setMeta(key: string, value: unknown): Promise<void> {
    await (await db()).put(STORE_META, value, key);
  }
}
