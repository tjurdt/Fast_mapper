import { useEffect, useState } from "preact/hooks";
import * as store from "../store";
import { uiEvents } from "../store";
import { MapStage } from "./MapStage";
import { Header } from "./Header";
import { Toolbar } from "./Toolbar";
import { SelectionBar } from "./SelectionBar";
import { CutBar } from "./CutBar";
import { BottomPanel } from "./BottomPanel";
import {
  AssignSheet,
  CellDetailSheet,
  SettingsSheet,
  CategoryModal,
  BaseImageSheet,
  ExportSheet,
} from "./sheets";

export type SheetId = "assign" | "cell" | "settings" | "cats" | "baseimg" | "export" | null;

export function Editor() {
  const [sheet, setSheet] = useState<SheetId>(null);
  const [cellKey, setCellKey] = useState<string | null>(null);

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
      <Toolbar />
      <MapStage />
      <SelectionBar onAssign={() => setSheet("assign")} />
      {store.editingCutId.value && <CutBar />}
      <BottomPanel />

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
