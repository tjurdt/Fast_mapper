import { t } from "../i18n";
import { TOOLS } from "../interaction";
import type { MessageKey } from "../i18n";
import * as store from "../store";

export function Toolbar() {
  const active = store.activeToolId.value;
  const view = store.project.value?.view.view ?? "actual";
  return (
    <div class="toolbar">
      {TOOLS.map((tool) => (
        <button key={tool.id} class={active === tool.id ? "on" : ""} onClick={() => store.setTool(tool.id)}>
          {t(tool.labelKey as MessageKey)}
        </button>
      ))}
      <span class="grow" />
      <div class="seg">
        <button class={view === "actual" ? "on" : ""} onClick={() => store.setView({ view: "actual" })}>
          {t("view.actual")}
        </button>
        <button class={view === "plan" ? "on" : ""} onClick={() => store.setView({ view: "plan" })}>
          {t("view.plan")}
        </button>
      </div>
    </div>
  );
}
