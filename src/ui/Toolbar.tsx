import { t } from "../i18n";
import { TOOLS } from "../interaction";
import type { MessageKey } from "../i18n";
import * as store from "../store";

const ICON: Record<string, string> = {
  grid: "▦",
  cut: "／",
  inspect: "◎",
  objselect: "❖",
};

export function Toolbar() {
  const active = store.activeToolId.value;
  return (
    <div class="toolbar" role="tablist">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          role="tab"
          aria-selected={active === tool.id}
          class={active === tool.id ? "tool on" : "tool"}
          onClick={() => store.setTool(tool.id)}
        >
          <span class="tool-ic" aria-hidden="true">
            {ICON[tool.id] ?? "•"}
          </span>
          {t(tool.labelKey as MessageKey)}
        </button>
      ))}
    </div>
  );
}
