import { useEffect, useRef } from "preact/hooks";
import { effect } from "@preact/signals";
import { MapRenderer } from "../render";
import { InteractionController } from "../interaction";
import * as store from "../store";

/** 承載兩張 canvas，掛上 MapRenderer + InteractionController，並把 store.scene 同步進去。 */
export function MapStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!wrapRef.current || !stageRef.current || !baseRef.current || !overlayRef.current) return;
    const renderer = new MapRenderer(stageRef.current, baseRef.current, overlayRef.current, {
      loadBlob: store.loadBlob,
    });
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
    };
  }, []);

  return (
    <div class="stagewrap" ref={wrapRef}>
      <div class="stage" ref={stageRef}>
        <canvas id="base" ref={baseRef} />
        <canvas id="overlay" ref={overlayRef} />
      </div>
    </div>
  );
}
