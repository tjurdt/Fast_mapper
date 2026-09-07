import { t } from "../i18n";
import { TOOLS } from "../interaction";
import type { MessageKey } from "../i18n";
import * as store from "../store";

const ICON: Record<string, string> = {
  select: "▦",
  paint: "🖌",
  cut: "／",
  inspect: "◎",
};

export function Toolbar() {
  const active = store.activeToolId.value;
  return (
    <div class="toolbar">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          class={active === tool.id ? "tool on" : "tool"}
          onClick={() => store.setTool(tool.id)}
          title={t(tool.labelKey as MessageKey)}
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
