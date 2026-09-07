import { useEffect, useState } from "preact/hooks";
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
} from "./sheets";

type SheetId = "assign" | "cell" | "settings" | "cats" | "baseimg" | "export" | null;

export function Editor() {
  const [sheet, setSheet] = useState<SheetId>(null);
  const [cellKey, setCellKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const offAssign = uiEvents.on("assign-sheet", () => setSheet("assign"));
    const offCell = uiEvents.on("cell-detail", (k) => {
      setCellKey(k);
      setSheet("cell");
    });
    return () => {
      offAssign();
      offCell();
    };
  }, []);

  const close = () => setSheet(null);

  return (
    <div class="appshell">
      <Header onMenu={() => setSheet("settings")} />
      <div class="workspace">
        <div class="workmain">
          <Toolbar />
          <MapStage onAssign={() => setSheet("assign")} />
        </div>
        <div class={panelOpen ? "sidewrap open" : "sidewrap"}>
          <SidePanel />
        </div>
      </div>

      <button class="panel-fab" onClick={() => setPanelOpen(!panelOpen)} aria-label={t("panel.toggle")}>
        <LegendIcon size={18} />
      </button>

      <ToastHost />

      {sheet === "assign" && <AssignSheet onClose={close} />}
      {sheet === "cell" && cellKey && <CellDetailSheet cellKey={cellKey} onClose={close} />}
      {sheet === "settings" && (
        <SettingsSheet
          onClose={close}
          onCats={() => setSheet("cats")}
          onBaseImage={() => setSheet("baseimg")}
          onExport={() => setSheet("export")}
        />
      )}
      {sheet === "cats" && <CategoryModal onClose={() => setSheet("settings")} />}
      {sheet === "baseimg" && <BaseImageSheet onClose={() => setSheet("settings")} />}
      {sheet === "export" && <ExportSheet onClose={() => setSheet("settings")} />}
    </div>
  );
}
