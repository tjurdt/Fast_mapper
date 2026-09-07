/**
 * 進入點。重構進行中 —— Phase 3：canvas 渲染引擎上線（可看見地圖、拖曳平移、
 * 滾輪縮放）。編輯工具與正式 UI 在 Phase 4 / 5。詳見 docs/ARCHITECTURE.md。
 */
import { effect } from "@preact/signals";
import "./styles.css";
import { bootstrap, scene, project, loadBlob, createFromTemplate } from "./store";
import { MapRenderer, attachBasicNavigation } from "./render";

const app = document.getElementById("app");

async function main(): Promise<void> {
  if (!app) return;

  app.innerHTML = `
    <div class="appshell">
      <header class="topbar">
        <strong id="projName">Fast mapper</strong>
        <span id="projMeta" class="meta"></span>
      </header>
      <div class="stagewrap" id="stagewrap">
        <div class="stage" id="stage">
          <canvas id="base"></canvas>
          <canvas id="overlay"></canvas>
        </div>
      </div>
    </div>
  `;

  const stageWrap = document.getElementById("stagewrap")!;
  const stage = document.getElementById("stage")!;
  const base = document.getElementById("base") as HTMLCanvasElement;
  const overlay = document.getElementById("overlay") as HTMLCanvasElement;

  const renderer = new MapRenderer(stage, base, overlay, { loadBlob });
  attachBasicNavigation(renderer, stageWrap);

  await bootstrap();
  // Phase 5 之前的過渡：沒有任何專案時，先用範本開一個以便檢視渲染。
  if (!project.value) await createFromTemplate("donggang-market");

  effect(() => {
    void renderer.setScene(scene.value);
  });

  effect(() => {
    const p = project.value;
    document.getElementById("projName")!.textContent = p?.name ?? "Fast mapper";
    document.getElementById("projMeta")!.textContent = p
      ? `${p.doc.grid.w}×${p.doc.grid.h} 格 · ${p.doc.features.length} 個${p.vocabulary.feature}`
      : "";
  });

  window.addEventListener("resize", () => renderer.fit());
}

void main();
