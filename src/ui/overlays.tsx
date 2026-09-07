import { useState } from "preact/hooks";
import { t } from "../i18n";
import { tv } from "./vocab";
import * as store from "../store";
import { toolById } from "../interaction";
import type { MessageKey } from "../i18n";
import { CycleButton } from "./widgets";

// ---- 地圖右上角縮放堆疊 ----

export function ZoomStack({ onZoom, onFit }: { onZoom: (f: number) => void; onFit: () => void }) {
  return (
    <div class="zoomstack">
      <button type="button" aria-label={t("zoom.in")} onClick={() => onZoom(1.6)}>
        ＋
      </button>
      <button type="button" aria-label={t("zoom.out")} onClick={() => onZoom(1 / 1.6)}>
        −
      </button>
      <button type="button" aria-label={t("zoom.fit")} title={t("zoom.fit")} onClick={onFit}>
        ⤢
      </button>
    </div>
  );
}

// ---- 地圖左上角提示 pill ----

export function MapHint() {
  const tool = toolById(store.activeToolId.value);
  if (!tool.hintKey) return null;
  return <div class="maphint">{t(tool.hintKey as MessageKey)}</div>;
}

// ---- 地圖下方懸浮動作列 ----

const MOVE_DIRS = [
  { dir: "up", label: "↑" },
  { dir: "down", label: "↓" },
  { dir: "left", label: "←" },
  { dir: "right", label: "→" },
] as const;

export function ActionBar({ onAssign, onCopy }: { onAssign: () => void; onCopy: () => void }) {
  const [moveMode, setMoveMode] = useState(false);
  const p = store.project.value;
  const cut = store.scene.value?.editingCut ?? null;
  const activeFeature = store.activeFeatureId.value
    ? p?.doc.features.find((f) => f.id === store.activeFeatureId.value)
    : null;
  const selCount = store.selection.value.size;

  const move = (dir: "up" | "down" | "left" | "right") => {
    const r = store.moveSelectionBy(dir);
    if (!r.ok && r.reason) store.uiEvents.emit("toast", r.reason);
  };

  if (cut) {
    return (
      <div class="actionbar">
        <CycleButton
          value={cut.wall ? "wall" : "open"}
          options={["wall", "open"] as const}
          labels={{ wall: t("cut.wall"), open: t("cut.open") }}
          className={cut.wall ? "solid" : ""}
          onChange={() => store.updateCut(cut.id, "wall")}
        />
        <CycleButton
          value={String(cut.side)}
          options={["-1", "1", "0"]}
          labels={{ "-1": t("cut.side.-1"), "1": t("cut.side.1"), "0": t("cut.side.0") }}
          onChange={() => store.updateCut(cut.id, "side")}
        />
        <span class="depthctl">
          <button
            type="button"
            aria-label={t("cut.depthDown")}
            onClick={() => store.updateCut(cut.id, "depth-")}
          >
            −
          </button>
          <span>
            {t("cut.depth")} {cut.depth}
          </span>
          <button
            type="button"
            aria-label={t("cut.depthUp")}
            onClick={() => store.updateCut(cut.id, "depth+")}
          >
            ＋
          </button>
        </span>
        <button class="danger" onClick={() => store.updateCut(cut.id, "delete")}>
          {t("cut.delete")}
        </button>
        <button class="go" onClick={() => store.beginEditCut(null)}>
          {t("cut.done")}
        </button>
      </div>
    );
  }

  if (activeFeature) {
    return (
      <div class="actionbar targetbar">
        <span class="dot" />
        <b>{activeFeature.name}</b>
        <span class="hint">{tv("paint.hint")}</span>
        <button class="go" onClick={() => store.setActiveFeature(null)}>
          {t("common.done")}
        </button>
      </div>
    );
  }

  if (selCount === 0) return null;

  if (moveMode) {
    return (
      <div class="actionbar">
        {MOVE_DIRS.map((m) => (
          <button key={m.dir} class="dirbtn" aria-label={m.dir} onClick={() => move(m.dir)}>
            {m.label}
          </button>
        ))}
        <button class="assign" onClick={onCopy}>
          {t("sel.copy")}
        </button>
        <button class="go" onClick={() => setMoveMode(false)}>
          {t("common.back")}
        </button>
      </div>
    );
  }

  return (
    <div class="actionbar">
      <button class="assign" onClick={onAssign}>
        {t("sel.edit")}
      </button>
      <button class="neutral" onClick={() => setMoveMode(true)}>
        {t("sel.move")}
      </button>
      <button class="danger" onClick={() => store.eraseSelection()}>
        {t("sel.erase")}
      </button>
      <button class="go" onClick={() => store.clearSelection()}>
        {t("sel.done")}
      </button>
    </div>
  );
}
