/** 極簡事件匯流排：讓 interaction 層要求 UI 做事（開 sheet 等），不反向 import UI。 */
export type UiEventMap = {
  "assign-sheet": undefined;
  "cell-detail": string;
  "edit-cut": string;
};

type Handler<K extends keyof UiEventMap> = (payload: UiEventMap[K]) => void;

class UiEvents {
  private handlers = new Map<keyof UiEventMap, Set<(payload: never) => void>>();

  on<K extends keyof UiEventMap>(type: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as (payload: never) => void);
    return () => this.handlers.get(type)?.delete(fn as (payload: never) => void);
  }

  emit<K extends keyof UiEventMap>(
    type: K,
    ...args: UiEventMap[K] extends undefined ? [] : [UiEventMap[K]]
  ): void {
    const payload = args[0];
    this.handlers.get(type)?.forEach((fn) => (fn as (p: unknown) => void)(payload));
  }
}

export const uiEvents = new UiEvents();
