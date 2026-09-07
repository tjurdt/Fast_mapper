import { t } from "../i18n";
import * as store from "../store";

export function CutBar() {
  const id = store.editingCutId.value;
  const cut = store.project.value?.doc.cuts.find((c) => c.id === id);
  if (!cut) return null;
  return (
    <div class="selbar cutbar">
      <span>{t("cut.title")}</span>
      <div class="depthctl">
        <button onClick={() => store.updateCut(cut.id, "depth-")}>−</button>
        <span>
          {t("cut.depth")} {cut.depth}
        </span>
        <button onClick={() => store.updateCut(cut.id, "depth+")}>＋</button>
      </div>
      <button onClick={() => store.updateCut(cut.id, "side")}>
        {t(`cut.side.${cut.side}` as "cut.side.0")}
      </button>
      <button class={cut.wall ? "on" : ""} onClick={() => store.updateCut(cut.id, "wall")}>
        {t("cut.wall")}
      </button>
      <button class="danger" onClick={() => store.updateCut(cut.id, "delete")}>
        {t("cut.delete")}
      </button>
      <button class="primary" onClick={() => store.beginEditCut(null)}>
        {t("cut.done")}
      </button>
    </div>
  );
}
