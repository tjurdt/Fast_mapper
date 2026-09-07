import { useState } from "preact/hooks";
import { t } from "../i18n";
import { tv } from "./vocab";
import * as store from "../store";
import { LegendIcon } from "./widgets";

type Tab = "list" | "legend";

/** 桌機：地圖右側常駐側欄；手機：底部可收合面板。由 CSS 切換。 */
export function SidePanel() {
  const [tab, setTab] = useState<Tab>("list");
  const [open, setOpen] = useState(true);
  const p = store.project.value;
  if (!p) return null;

  return (
    <aside class={open ? "sidepanel open" : "sidepanel"}>
      <div class="sp-head">
        <button class={tab === "list" ? "tab on" : "tab"} onClick={() => setTab("list")}>
          {tv("list.title")}
        </button>
        <button class={tab === "legend" ? "tab on" : "tab"} onClick={() => setTab("legend")}>
          <LegendIcon size={14} />
          {t("legend.title")}
        </button>
        <span class="grow" />
        <button class="icon sp-collapse" aria-label={t("panel.toggle")} onClick={() => setOpen(!open)}>
          {open ? "⟩" : "⟨"}
        </button>
      </div>
      {open && (tab === "list" ? <FeatureList /> : <Legend />)}
    </aside>
  );
}

function FeatureList() {
  const p = store.project.value!;
  const [q, setQ] = useState("");
  const numbers = store.numbers.value;
  const catColor = new Map(p.doc.categories.map((c) => [c.id, c.color]));
  const rows = p.doc.features
    .map((f) => ({ f, n: numbers[f.id] }))
    .filter(({ f, n }) => !q || f.name.includes(q) || String(n ?? "") === q)
    .sort((a, b) => (a.n ?? 1e9) - (b.n ?? 1e9));

  if (!p.doc.features.length) return <p class="sp-empty">{tv("list.empty")}</p>;

  return (
    <div class="sp-body">
      <input
        class="field"
        type="search"
        placeholder={t("list.search")}
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
      />
      <ul class="feat-list">
        {rows.map(({ f, n }) => {
          const active = store.inspectedFeature.value === f.id || store.activeFeatureId.value === f.id;
          return (
            <li
              key={f.id}
              class={active ? "on" : ""}
              onClick={() => store.inspectFeature(store.inspectedFeature.value === f.id ? null : f.id)}
            >
              <span class="numbadge">{n ?? "–"}</span>
              <span class="dot" style={{ background: catColor.get(f.category) ?? "#ccc" }} />
              <span class="nm">{f.name}</span>
              <button
                class="icon"
                aria-label={t("list.brush")}
                title={t("list.brush")}
                onClick={(e) => {
                  e.stopPropagation();
                  store.setActiveFeature(f.id);
                }}
              >
                🖌
              </button>
              <button
                class="icon"
                aria-label={t("list.edit")}
                onClick={(e) => {
                  e.stopPropagation();
                  editFeature(f.id);
                }}
              >
                ✎
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function editFeature(id: string) {
  const f = store.project.value!.doc.features.find((x) => x.id === id);
  if (!f) return;
  const name = prompt(tv("list.rename"), f.name);
  if (name == null) return;
  if (name.trim() === "") {
    if (confirm(tv("list.delete") + "？")) store.deleteFeatureAction(id);
    return;
  }
  store.renameFeatureAction(id, name);
}

function Legend() {
  const p = store.project.value!;
  const catCount: Record<string, number> = {};
  const planCount: Record<string, number> = {};
  for (const k in p.doc.cells) {
    const d = p.doc.cells[k]!;
    if (d.cat) catCount[d.cat] = (catCount[d.cat] ?? 0) + 1;
    if (d.plan) planCount[d.plan] = (planCount[d.plan] ?? 0) + 1;
  }
  return (
    <div class="sp-body legend">
      <h4>{tv("legend.plan")}</h4>
      <ul>
        {p.doc.planLayers.map((z) => (
          <li key={z.id}>
            <span class="sw" style={{ background: z.color }} />
            {z.name} <span class="muted">{planCount[z.id] ?? 0}</span>
          </li>
        ))}
      </ul>
      <h4>{tv("legend.actual")}</h4>
      <ul>
        {p.doc.categories.map((c) => (
          <li key={c.id}>
            <span class="sw" style={{ background: c.color }} />
            {c.name} <span class="muted">{catCount[c.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
