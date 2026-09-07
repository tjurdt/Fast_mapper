import type { StorageAdapter } from "./adapter";
import { IndexedDbAdapter } from "./indexeddb";
import { MemoryAdapter } from "./memory";

export type { StorageAdapter, ProjectSummary } from "./adapter";
export { IndexedDbAdapter } from "./indexeddb";
export { MemoryAdapter } from "./memory";

/** 選一個當前環境可用的儲存媒介。 */
export function createStorageAdapter(): StorageAdapter {
  const hasIDB = typeof indexedDB !== "undefined";
  return hasIDB ? new IndexedDbAdapter() : new MemoryAdapter();
}

/** meta 鍵。 */
export const META_LAST_PROJECT = "lastProjectId";
export const META_LEGACY_IMPORTED = "legacyImported";
