import { useState } from "preact/hooks";
import { t } from "../i18n";
import { tv } from "./vocab";
import * as store from "../store";
import { toolById } from "../interaction";
import type { MessageKey } from "../i18n";
import { CycleButton, LegendIcon, MovePad } from "./widgets";

// ---- 地圖右上角縮放堆疊 ----

export function ZoomStack({ onZoom, onFit }: { onZoom: (f: number) => void; onFit: () => void }) {
  return (
    <div class="zoomstack">
      <button type="button" aria-label={t("zoom.in")} onClick={() => onZoom(1.5)}>
        ＋
      </button>
      <button type="button" aria-label={t("zoom.out")} onClick={() => onZoom(1 / 1.5)}>
        −
      </button>
      <button type="button" aria-label={t("zoom.fit")} onClick={onFit}>
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

// ---- 地圖右下角圖例 FAB（懸浮開關）----

export function LegendFab({ onToggle, open }: { onToggle: () => void; open: boolean }) {
  return (
    <button type="button" class={open ? "legendfab on" : "legendfab"} onClick={onToggle} aria-expanded={open}>
      <LegendIcon size={17} />
      {t("legend.title")}
    </button>
  );
}

// ---- 地圖下方懸浮動作列（選取 / 切線 / 筆刷）----

export function ActionBar({ onAssign }: { onAssign: () => void }) {
  const [movePad, setMovePad] = useState(false);
  const p = store.project.value;
  const cut = store.scene.value?.editingCut ?? null;
  const activeFeature = store.activeFeatureId.value
    ? p?.doc.features.find((f) => f.id === store.activeFeatureId.value)
    : null;
  const selCount = store.selection.value.size;

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
        <span class="hint grow">{tv("paint.hint")}</span>
        <button class="go" onClick={() => store.setActiveFeature(null)}>
          {t("common.done")}
        </button>
      </div>
    );
  }

  if (selCount === 0) return null;

  return (
    <div class="actionbar-wrap">
      {movePad && (
        <div class="movepad-float">
          <MovePad
            onMove={(dir) => {
              const r = store.moveSelectionBy(dir);
              if (!r.ok && r.reason) store.uiEvents.emit("toast", r.reason);
            }}
          />
        </div>
      )}
      <div class="actionbar">
        <span class="count">{t("sel.count", { n: selCount })}</span>
        <button class="assign" onClick={onAssign}>
          {tv("sel.assign")}
        </button>
        <button class={movePad ? "move on" : "move"} onClick={() => setMovePad(!movePad)}>
          {t("sel.move")}
        </button>
        <button class="danger" onClick={() => store.eraseSelection()}>
          {t("sel.erase")}
        </button>
        <button class="go" onClick={() => store.clearSelection()}>
          {t("sel.done")}
        </button>
      </div>
    </div>
  );
}
