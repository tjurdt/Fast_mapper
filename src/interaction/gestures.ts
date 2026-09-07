/**
 * 把原始 pointer 事件轉成語意手勢。不碰 store、不碰 render —— 只回呼。
 * 移植自 legacy stagewrap 的 pointerdown/move/up 邏輯。
 */
const MOVE_THRESHOLD = 6;
const LONG_PRESS_MS = 500;

export interface GesturePoint {
  /** 舞台容器相對座標（CSS 像素）。 */
  x: number;
  y: number;
}

export interface PinchState {
  /** 兩指距離。 */
  d: number;
  /** 兩指中點（舞台相對）。 */
  cx: number;
  cy: number;
}

export interface GestureHandlers {
  onTap?(p: GesturePoint): void;
  onLongPress?(p: GesturePoint): void;
  onDragStart?(p: GesturePoint): void;
  onDrag?(from: GesturePoint, to: GesturePoint): void;
  onDragEnd?(from: GesturePoint, to: GesturePoint): void;
  /** 單指拖曳但作用中工具沒有 onDrag 時 → 當作平移。 */
  onPan?(dx: number, dy: number): void;
  onPinch?(prev: PinchState, cur: PinchState): void;
  onWheelZoom?(p: GesturePoint, factor: number): void;
  /** 每次手勢結束（給 renderer 重新光柵化用）。 */
  onGestureEnd?(): void;
}

interface Ptr {
  x: number;
  y: number;
}

export function attachGestures(target: HTMLElement, handlers: GestureHandlers): () => void {
  const pts = new Map<number, Ptr>();
  const rel = (e: PointerEvent | { clientX: number; clientY: number }): GesturePoint => {
    const r = target.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  let start: GesturePoint | null = null;
  let last: GesturePoint | null = null;
  let moved = false;
  let dragging = false;
  let longPressFired = false;
  let pinchPrev: PinchState | null = null;
  let lpTimer: ReturnType<typeof setTimeout> | null = null;

  const clearLp = () => {
    if (lpTimer) clearTimeout(lpTimer);
    lpTimer = null;
  };
  const pinchOf = (): PinchState => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), cx: (a!.x + b!.x) / 2, cy: (a!.y + b!.y) / 2 };
  };

  const onDown = (e: PointerEvent) => {
    target.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, rel(e));
    if (pts.size === 2) {
      clearLp();
      dragging = false;
      start = null;
      pinchPrev = pinchOf();
      return;
    }
    if (pts.size > 2) return;
    start = rel(e);
    last = start;
    moved = false;
    dragging = false;
    longPressFired = false;
    clearLp();
    lpTimer = setTimeout(() => {
      lpTimer = null;
      longPressFired = true;
      if (start) handlers.onLongPress?.(start);
    }, LONG_PRESS_MS);
  };

  const onMove = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, rel(e));

    if (pts.size >= 2) {
      if (!pinchPrev) pinchPrev = pinchOf();
      const cur = pinchOf();
      handlers.onPinch?.(pinchPrev, cur);
      pinchPrev = cur;
      return;
    }
    if (!start || !last) return;
    const p = rel(e);
    if (!moved && Math.hypot(p.x - start.x, p.y - start.y) > MOVE_THRESHOLD) {
      moved = true;
      clearLp();
      if (handlers.onDrag) {
        dragging = true;
        handlers.onDragStart?.(start);
      }
    }
    if (dragging) {
      handlers.onDrag?.(start, p);
    } else if (moved && handlers.onPan) {
      handlers.onPan(p.x - last.x, p.y - last.y);
    }
    last = p;
  };

  const onUp = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    const p = rel(e);
    pts.delete(e.pointerId);
    clearLp();
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (pinchPrev && pts.size < 2) {
      pinchPrev = null;
      handlers.onGestureEnd?.();
      start = null;
      return;
    }
    if (!start) return;
    if (dragging) handlers.onDragEnd?.(start, p);
    else if (!moved && !longPressFired) handlers.onTap?.(start);
    dragging = false;
    start = null;
    last = null;
    handlers.onGestureEnd?.();
  };

  const onWheel = (e: WheelEvent) => {
    if (!handlers.onWheelZoom) return;
    e.preventDefault();
    handlers.onWheelZoom(rel(e), Math.exp(-e.deltaY * 0.0015));
  };

  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onUp);
  target.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    clearLp();
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onUp);
    target.removeEventListener("pointercancel", onUp);
    target.removeEventListener("wheel", onWheel);
  };
}
