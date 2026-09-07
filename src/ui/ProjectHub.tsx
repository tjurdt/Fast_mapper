import { useState } from "preact/hooks";
import { t } from "../i18n";
import { formatDate } from "./vocab";
import * as store from "../store";
import { TemplatePicker } from "./TemplatePicker";

export function ProjectHub() {
  const [picking, setPicking] = useState(false);
  const list = store.projectList.value;

  if (picking) return <TemplatePicker onDone={() => setPicking(false)} />;

  return (
    <div class="hub">
      <header class="hub-head">
        <h1>{t("hub.title")}</h1>
        <button class="primary" onClick={() => setPicking(true)}>
          {t("hub.new")}
        </button>
      </header>
      {list.length === 0 ? (
        <p class="muted">{t("hub.empty")}</p>
      ) : (
        <ul class="hub-list">
          {list.map((p) => (
            <li key={p.id}>
              <button class="hub-open" onClick={() => void store.openProject(p.id)}>
                <b>{p.name}</b>
                <span class="muted">{t("hub.updatedAt", { date: formatDate(p.updatedAt) })}</span>
              </button>
              <button
                class="icon danger"
                aria-label={t("hub.delete")}
                onClick={() => {
                  if (confirm(t("hub.deleteConfirm", { name: p.name }))) void store.deleteProject(p.id);
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
