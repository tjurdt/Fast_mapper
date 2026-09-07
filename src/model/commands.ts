/**
 * 文件層級的 undo/redo。沿用 legacy 的 snapshot 策略：把整份 MapDoc 序列化成
 * 字串堆疊；比對用字串相等。View 設定 / 專案名稱 / vocabulary 不進歷史
 * （對應 legacy 的 HISTORY_KEYS 不含這些）。
 *
 * 具體的編輯操作（指定分類、擦除、移動…）會隨 Phase 4 的 tools 一起加入，
 * 每個都是 `(doc, args) => MapDoc` 的純函式，再由 store 包上 history.record()。
 */
import type { MapDoc } from "../core/types";

export class DocHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private current: string | null = null;

  constructor(private readonly limit = 60) {}

  private snap(doc: MapDoc): string {
    return JSON.stringify(doc);
  }

  /** 設定基準點，清空堆疊。載入新專案時呼叫。 */
  reset(doc: MapDoc): void {
    this.current = this.snap(doc);
    this.undoStack = [];
    this.redoStack = [];
  }

  /** 記錄一次變更。與目前基準相同則忽略。 */
  record(doc: MapDoc): void {
    const next = this.snap(doc);
    if (next === this.current) return;
    if (this.current !== null) {
      this.undoStack.push(this.current);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.current = next;
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
    return JSON.parse(prev) as MapDoc;
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
    return JSON.parse(next) as MapDoc;
  }
}
