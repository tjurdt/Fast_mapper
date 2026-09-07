import { useEffect, useState } from "preact/hooks";
import * as store from "../store";
import { uiEvents } from "../store";
import { t } from "../i18n";
import { MapStage } from "./MapStage";
import { Header } from "./Header";
import { Toolbar } from "./Toolbar";
import { SidePanel } from "./panels";
import { ToastHost, LegendIcon } from "./widgets";
import {
  AssignSheet,
  CellDetailSheet,
  SettingsSheet,
  CategoryModal,
  BaseImageSheet,
  ExportSheet,
  OffsetSheet,
  FeatureSheet,
} from "./sheets";

type SheetId = "assign" | "cell" | "settings" | "cats" | "baseimg" | "export" | "offset" | "feature" | null;

export function Editor() {
  const [sheet, setSheet] = useState<SheetId>(null);
  const [catsReturn, setCatsReturn] = useState<SheetId>("settings");
  const [cellKey, setCellKey] = useState<string | null>(null);
  const [featureId, setFeatureId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const offs = [
      uiEvents.on("assign-sheet", () => setSheet("assign")),
      uiEvents.on("cell-detail", (k) => {
        setCellKey(k);
        setSheet("cell");
      }),
      uiEvents.on("feature-sheet", (id) => {
        setFeatureId(id);
        setSheet("feature");
      }),
      uiEvents.on("offset-sheet", () => setSheet("offset")),
      uiEvents.on("cats-sheet", () => {
        setCatsReturn(null);
        setSheet("cats");
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  const close = () => setSheet(null);
  const barActive =
    store.selection.value.size > 0 ||
    store.selectedCutIds.value.size > 0 ||
    !!store.editingCutId.value ||
    store.pasteMode.value;

  return (
    <div class="appshell">
      <Header onMenu={() => setSheet("settings")} />
      <div class="workspace">
        <div class="workmain">
          <Toolbar />
          <MapStage onAssign={() => setSheet("assign")} onOffset={() => setSheet("offset")} />
        </div>
        <div class={panelOpen ? "sidewrap open" : "sidewrap"}>
          <SidePanel onClosePanel={() => setPanelOpen(false)} />
        </div>
      </div>

      {/* 桌機：右下懸浮圖例鈕（動作列開啟時讓位） */}
      {!barActive && (
        <button
          class="panel-fab"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-label={t("panel.toggle")}
          title={t("panel.toggle")}
        >
          <LegendIcon size={18} />
        </button>
      )}

      {/* 手機：返回／重作／圖例，隨底部工具列上抬 */}
      <div class={barActive ? "mobiledock raised" : "mobiledock"} hidden={panelOpen}>
        <button
          class="mdock-btn"
          disabled={!store.canUndo.value}
          aria-label={t("editor.undo")}
          onClick={store.undo}
        >
          ↶
        </button>
        <button
          class="mdock-btn"
          disabled={!store.canRedo.value}
          aria-label={t("editor.redo")}
          onClick={store.redo}
        >
          ↷
        </button>
        <button class="mdock-btn" onClick={() => setPanelOpen(!panelOpen)} aria-label={t("panel.toggle")}>
          <LegendIcon size={18} />
        </button>
      </div>

      <ToastHost />

      {sheet === "assign" && <AssignSheet onClose={close} />}
      {sheet === "offset" && <OffsetSheet onClose={close} />}
      {sheet === "feature" && featureId && <FeatureSheet id={featureId} onClose={close} />}
      {sheet === "cell" && cellKey && <CellDetailSheet cellKey={cellKey} onClose={close} />}
      {sheet === "settings" && (
        <SettingsSheet
          onClose={close}
          onCats={() => {
            setCatsReturn("settings");
            setSheet("cats");
          }}
          onBaseImage={() => setSheet("baseimg")}
          onExport={() => setSheet("export")}
        />
      )}
      {sheet === "cats" && <CategoryModal onClose={() => setSheet(catsReturn)} />}
      {sheet === "baseimg" && <BaseImageSheet onClose={() => setSheet("settings")} />}
      {sheet === "export" && <ExportSheet onClose={() => setSheet("settings")} />}
    </div>
  );
}
