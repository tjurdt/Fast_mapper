import { useEffect, useRef } from "preact/hooks";
import { effect } from "@preact/signals";
import { MapRenderer } from "../render";
import { InteractionController } from "../interaction";
import * as store from "../store";
import { uiEvents } from "../store";
import { ZoomStack, MapHint, ActionBar } from "./overlays";

/** 承載三張 canvas + 地圖上的懸浮控制項。 */
export function MapStage({ onAssign, onOffset }: { onAssign: () => void; onOffset: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLCanvasElement>(null);
  const interRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);

  useEffect(() => {
    if (!wrapRef.current || !stageRef.current || !baseRef.current || !contentRef.current || !interRef.current)
      return;
    const renderer = new MapRenderer(
      stageRef.current,
      baseRef.current,
      contentRef.current,
      interRef.current,
      { loadBlob: store.loadBlob },
    );
    rendererRef.current = renderer;
    const controller = new InteractionController(renderer, wrapRef.current);
    const stopScene = effect(() => {
      void renderer.setScene(store.scene.value);
    });

    const onResize = () => renderer.resize();
    window.addEventListener("resize", onResize);

    const offFocus = uiEvents.on("focus-feature", (id) => {
      const geo = store.geometry.value;
      if (!geo) return;
      const b = geo.featureBounds(id);
      if (b) renderer.frameRegion(b[0], b[1], b[2], b[3], geo.cw * 2);
    });

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const tool = store.activeToolId.value;
      const hasSel = store.selection.value.size > 0 || store.selectedCutIds.value.size > 0;

      const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key] as
        "up" | "down" | "left" | "right" | undefined;
      if (dir && hasSel) {
        e.preventDefault();
        const r =
          tool === "objselect"
            ? store.moveObjectsBy(
                ...({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] as [number, number]),
              )
            : store.moveSelectionBy(dir);
        if (!r.ok && r.reason) uiEvents.emit("toast", r.reason);
        return;
      }

      if (tool !== "objselect") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (store.clipboardCopy(false)) uiEvents.emit("toast", "已複製");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        if (store.clipboardCopy(true)) uiEvents.emit("toast", "已剪下");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (store.clipboardPaste()) uiEvents.emit("toast", "已貼上");
      } else if ((e.key === "Delete" || e.key === "Backspace") && hasSel) {
        e.preventDefault();
        store.deleteObjectsAction();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      stopScene();
      offFocus();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      controller.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  const zoom = (factor: number) => {
    const r = rendererRef.current;
    const el = wrapRef.current;
    if (!r || !el) return;
    r.viewport.scaleBy(factor, el.clientWidth / 2, el.clientHeight / 2, el.clientWidth, el.clientHeight);
    r.applyLiveTransform();
  };

  return (
    <div class="stagewrap" ref={wrapRef}>
      <div class="stage" ref={stageRef}>
        <canvas class="lyr" ref={baseRef} />
        <canvas class="lyr" ref={contentRef} />
        <canvas class="lyr" ref={interRef} />
      </div>
      <MapHint />
      <ZoomStack onZoom={zoom} onFit={() => rendererRef.current?.fit()} />
      <ActionBar onAssign={onAssign} onOffset={onOffset} />
    </div>
  );
}
