import { t } from "../i18n";
import * as store from "../store";

export function Header({ onMenu }: { onMenu: () => void }) {
  const p = store.project.value;
  if (!p) return null;
  return (
    <header class="topbar">
      <button class="icon" aria-label={t("editor.backToHub")} onClick={() => (store.project.value = null)}>
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
      <span class="meta">
        {p.doc.grid.w}×{p.doc.grid.h} · {p.doc.features.length} {p.vocabulary.feature}
      </span>
      <span class="grow" />
      <button class="icon" disabled={!store.canUndo.value} aria-label={t("editor.undo")} onClick={store.undo}>
        ↶
      </button>
      <button class="icon" disabled={!store.canRedo.value} aria-label={t("editor.redo")} onClick={store.redo}>
        ↷
      </button>
      <button class="icon" aria-label={t("editor.menu")} onClick={onMenu}>
        ⚙
      </button>
    </header>
  );
}
