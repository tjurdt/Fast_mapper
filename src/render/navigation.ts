/**
 * 過渡期的基本導覽（拖曳平移 + 滾輪縮放）。
 * Phase 4 的手勢 / tools 系統會取代這裡，屆時刪除。
 */
import type { MapRenderer } from "./engine";

export function attachBasicNavigation(renderer: MapRenderer, target: HTMLElement): () => void {
  const rect = () => target.getBoundingClientRect();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const size = () => ({ w: target.clientWidth, h: target.clientHeight });

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    target.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const { w, h } = size();
    renderer.viewport.panBy(e.clientX - lastX, e.clientY - lastY, w, h);
    lastX = e.clientX;
    lastY = e.clientY;
    renderer.applyLiveTransform();
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    try {
      target.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = rect();
    const { w, h } = size();
    const factor = Math.exp(-e.deltaY * 0.0015);
    renderer.viewport.scaleBy(factor, e.clientX - r.left, e.clientY - r.top, w, h);
    renderer.applyLiveTransform();
  };

  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  target.addEventListener("pointercancel", onUp);
  target.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onUp);
    target.removeEventListener("pointercancel", onUp);
    target.removeEventListener("wheel", onWheel);
  };
}
