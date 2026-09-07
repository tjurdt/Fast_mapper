import { t } from "../i18n";
import { tv } from "./vocab";
import * as store from "../store";

export function SelectionBar({ onAssign }: { onAssign: () => void }) {
  const n = store.selection.value.size;
  if (n === 0 || store.editingCutId.value) return null;
  const move = (dir: "up" | "down" | "left" | "right") => {
    const r = store.moveSelectionBy(dir);
    if (!r.ok && r.reason) alert(r.reason);
  };
  return (
    <div class="selbar">
      <span>{t("sel.count", { n })}</span>
      <button class="primary" onClick={onAssign}>
        {tv("sel.assign")}
      </button>
      <button onClick={() => store.eraseSelection()}>{t("sel.erase")}</button>
      <div class="movepad">
        <button onClick={() => move("up")}>↑</button>
        <button onClick={() => move("left")}>←</button>
        <button onClick={() => move("right")}>→</button>
        <button onClick={() => move("down")}>↓</button>
      </div>
      <button class="icon" aria-label={t("sel.clear")} onClick={() => store.clearSelection()}>
        ✕
      </button>
    </div>
  );
}
