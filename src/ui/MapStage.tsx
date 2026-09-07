import { useEffect, useRef } from "preact/hooks";
import { effect } from "@preact/signals";
import { MapRenderer } from "../render";
import { InteractionController } from "../interaction";
import * as store from "../store";
import { ZoomStack, MapHint, ActionBar } from "./overlays";

/** 承載兩張 canvas + 地圖上的懸浮控制項。 */
export function MapStage({ onAssign }: { onAssign: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);

  useEffect(() => {
    if (!wrapRef.current || !stageRef.current || !baseRef.current || !overlayRef.current) return;
    const renderer = new MapRenderer(stageRef.current, baseRef.current, overlayRef.current, {
      loadBlob: store.loadBlob,
    });
    rendererRef.current = renderer;
    const controller = new InteractionController(renderer, wrapRef.current);
    const stopScene = effect(() => {
      void renderer.setScene(store.scene.value);
    });
    const onResize = () => renderer.fit();
    window.addEventListener("resize", onResize);
    return () => {
      stopScene();
      window.removeEventListener("resize", onResize);
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
        <canvas id="base" ref={baseRef} />
        <canvas id="overlay" ref={overlayRef} />
      </div>
      <MapHint />
      <ZoomStack onZoom={zoom} onFit={() => rendererRef.current?.fit()} />
      <ActionBar onAssign={onAssign} />
    </div>
  );
}
