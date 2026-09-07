/**
 * 文件層級的 undo/redo。堆疊直接存 `MapDoc` 參照 —— `editDoc` 每次都會產生一份
 * 全新（且之後不再被改動）的 doc，所以存參照是安全的，不必序列化或再深拷貝。
 * View 設定 / 專案名稱 / vocabulary 不進歷史。
 */
import type { MapDoc } from "../core/types";

export class DocHistory {
  private undoStack: MapDoc[] = [];
  private redoStack: MapDoc[] = [];
  private current: MapDoc | null = null;

  constructor(private readonly limit = 60) {}

  /** 設定基準點，清空堆疊。載入新專案時呼叫。 */
  reset(doc: MapDoc): void {
    this.current = doc;
    this.undoStack = [];
    this.redoStack = [];
  }

  /** 記錄一次變更。與目前基準是同一個物件則忽略。 */
  record(doc: MapDoc): void {
    if (doc === this.current) return;
    if (this.current !== null) {
      this.undoStack.push(this.current);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.current = doc;
    this.redoStack = [];
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** 回上一步，回傳要套用的 MapDoc；無法復原則 null。 */
  undo(): MapDoc | null {
    const prev = this.undoStack.pop();
    if (prev === undefined) return null;
    if (this.current !== null) this.redoStack.push(this.current);
    this.current = prev;
    return prev;
  }

  /** 重做，回傳要套用的 MapDoc；無法重做則 null。 */
  redo(): MapDoc | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    if (this.current !== null) {
      this.undoStack.push(this.current);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.current = next;
    return next;
  }
}
