import { t } from "../i18n";
import * as store from "../store";

export function Header({ onMenu }: { onMenu: () => void }) {
  const p = store.project.value;
  if (!p) return null;
  const view = p.view.view;
  return (
    <header class="topbar">
      <button
        class="icon ghost"
        aria-label={t("editor.backToHub")}
        onClick={() => (store.project.value = null)}
      >
        ☰
      </button>
      <button
        class="proj-name"
        onClick={() => {
          const name = prompt(t("editor.renamePrompt"), p.name);
          if (name != null) store.renameProject(name);
        }}
      >
        {p.name}
      </button>

      <span class="grow" />

      <div class="seg view-seg">
        <button class={view === "actual" ? "on" : ""} onClick={() => store.setView({ view: "actual" })}>
          {t("view.actual")}
        </button>
        <button class={view === "plan" ? "on" : ""} onClick={() => store.setView({ view: "plan" })}>
          {t("view.plan")}
        </button>
      </div>

      <button
        class="icon ghost"
        disabled={!store.canUndo.value}
        aria-label={t("editor.undo")}
        onClick={store.undo}
      >
        ↶
      </button>
      <button
        class="icon ghost"
        disabled={!store.canRedo.value}
        aria-label={t("editor.redo")}
        onClick={store.redo}
      >
        ↷
      </button>
      <button class="icon ghost" aria-label={t("editor.menu")} onClick={onMenu}>
        ⚙
      </button>
    </header>
  );
}
