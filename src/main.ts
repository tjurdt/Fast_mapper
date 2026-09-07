/**
 * 進入點。重構進行中 —— Phase 4：手勢 + tools 框架上線。
 * 這裡的工具列 / 選取列是**過渡用的純 DOM**，Phase 5 會用 Preact + i18n 重建。
 * 詳見 docs/ARCHITECTURE.md。
 */
import { effect } from "@preact/signals";
import "./styles.css";
import * as store from "./store";
import { MapRenderer } from "./render";
import { InteractionController } from "./interaction";
import { TOOLS } from "./interaction";

const app = document.getElementById("app");

async function main(): Promise<void> {
  if (!app) return;

  app.innerHTML = `
    <div class="appshell">
      <header class="topbar">
        <strong id="projName">Fast mapper</strong>
        <span id="projMeta" class="meta"></span>
        <span class="grow"></span>
        <button data-act="undo" title="復原">↶</button>
        <button data-act="redo" title="重做">↷</button>
      </header>
      <div class="toolbar" id="toolbar">
        ${TOOLS.map((t) => `<button data-tool="${t.id}">${toolLabel(t.id)}</button>`).join("")}
        <span class="grow"></span>
        <span id="selInfo" class="meta"></span>
        <button data-act="assign" hidden>指定分類…</button>
        <button data-act="erase" hidden>清除</button>
        <span class="movepad" id="movepad" hidden>
          <button data-move="up">↑</button><button data-move="left">←</button
          ><button data-move="right">→</button><button data-move="down">↓</button>
        </span>
      </div>
      <div class="stagewrap" id="stagewrap">
        <div class="stage" id="stage">
          <canvas id="base"></canvas>
          <canvas id="overlay"></canvas>
        </div>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => app.querySelector(sel) as T;
  const stageWrap = $("#stagewrap");
  const renderer = new MapRenderer($("#stage"), $("#base"), $("#overlay"), { loadBlob: store.loadBlob });
  new InteractionController(renderer, stageWrap);

  await store.bootstrap();
  if (!store.project.value) await store.createFromTemplate("donggang-market");

  effect(() => {
    void renderer.setScene(store.scene.value);
  });

  effect(() => {
    const p = store.project.value;
    $("#projName").textContent = p?.name ?? "Fast mapper";
    $("#projMeta").textContent = p
      ? `${p.doc.grid.w}×${p.doc.grid.h} · ${p.doc.features.length} 個${p.vocabulary.feature}`
      : "";
  });

  effect(() => {
    const n = store.selection.value.size;
    $("#selInfo").textContent = n ? `已選 ${n} 格` : "";
    for (const sel of ["[data-act='assign']", "[data-act='erase']", "#movepad"]) {
      ($(sel) as HTMLElement).hidden = n === 0;
    }
  });

  effect(() => {
    const id = store.activeToolId.value;
    app.querySelectorAll("[data-tool]").forEach((b) => {
      b.classList.toggle("on", (b as HTMLElement).dataset.tool === id);
    });
  });

  effect(() => {
    ($("[data-act='undo']") as HTMLButtonElement).disabled = !store.canUndo.value;
    ($("[data-act='redo']") as HTMLButtonElement).disabled = !store.canRedo.value;
  });

  app.querySelector("#toolbar")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.dataset.tool) store.setTool(b.dataset.tool);
    else if (b.dataset.act === "erase") store.eraseSelection();
    else if (b.dataset.act === "assign") promptAssign();
    else if (b.dataset.move) {
      const r = store.moveSelectionBy(b.dataset.move as "up" | "down" | "left" | "right");
      if (!r.ok && r.reason) console.warn(r.reason);
    }
  });

  app.querySelector(".topbar")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b?.dataset.act === "undo") store.undo();
    if (b?.dataset.act === "redo") store.redo();
  });

  function promptAssign(): void {
    const p = store.project.value;
    if (!p || !p.doc.categories.length) return;
    const list = p.doc.categories.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
    const pick = window.prompt(`選分類編號：\n${list}`);
    const idx = Number(pick) - 1;
    const cat = p.doc.categories[idx];
    if (!cat) return;
    const name = window.prompt(`${p.vocabulary.feature}名稱（留空自動命名）`) ?? "";
    store.assignSelection({ categoryId: cat.id, featureName: name });
  }

  window.addEventListener("resize", () => renderer.fit());
}

function toolLabel(id: string): string {
  return { select: "選取", cut: "切線／牆", inspect: "檢視" }[id] ?? id;
}

void main();
