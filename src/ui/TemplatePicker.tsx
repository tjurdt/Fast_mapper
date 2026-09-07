import { useState } from "preact/hooks";
import { t } from "../i18n";
import { TEMPLATES } from "../templates";
import * as store from "../store";

export function TemplatePicker({ onDone }: { onDone: () => void }) {
  const [sel, setSel] = useState(TEMPLATES[0]!.id);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div class="hub">
      <header class="hub-head">
        <h1>{t("template.pick")}</h1>
        <button onClick={onDone}>{t("template.back")}</button>
      </header>
      <ul class="tpl-list">
        {TEMPLATES.map((tpl) => (
          <li key={tpl.id}>
            <label class={sel === tpl.id ? "tpl on" : "tpl"}>
              <input type="radio" name="tpl" checked={sel === tpl.id} onChange={() => setSel(tpl.id)} />
              <div>
                <b>{tpl.title}</b>
                <span class="muted">{tpl.description}</span>
              </div>
            </label>
          </li>
        ))}
      </ul>
      <input
        class="field"
        placeholder={t("editor.renamePrompt")}
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />
      <button
        class="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await store.createFromTemplate(sel, name.trim() || undefined);
          onDone();
        }}
      >
        {t("template.create")}
      </button>
    </div>
  );
}
