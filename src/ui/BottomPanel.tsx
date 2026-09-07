import { useState } from "preact/hooks";
import { t } from "../i18n";
import { tv } from "./vocab";
import * as store from "../store";

type Tab = "list" | "legend";

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>("list");
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const p = store.project.value;
  if (!p) return null;

  return (
    <div class={open ? "bottompanel open" : "bottompanel"}>
      <div class="bp-head">
        <button class={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>
          {tv("list.title")}
        </button>
        <button class={tab === "legend" ? "on" : ""} onClick={() => setTab("legend")}>
          {t("legend.title")}
        </button>
        <span class="grow" />
        <button class="icon" onClick={() => setOpen(!open)}>
          {open ? "▾" : "▴"}
        </button>
      </div>
      {open && tab === "list" && <FeatureList q={q} setQ={setQ} />}
      {open && tab === "legend" && <Legend />}
    </div>
  );
}

function FeatureList({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const p = store.project.value!;
  const numbers = store.numbers.value;
  const catColor = new Map(p.doc.categories.map((c) => [c.id, c.color]));
  const rows = p.doc.features
    .map((f) => ({ f, n: numbers[f.id] }))
    .filter(({ f, n }) => !q || f.name.includes(q) || String(n ?? "") === q)
    .sort((a, b) => (a.n ?? 1e9) - (b.n ?? 1e9));

  if (!p.doc.features.length) return <p class="muted pad">{tv("list.empty")}</p>;

  return (
    <div class="bp-body">
      <input
        class="field"
        placeholder={t("list.search")}
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
      />
      <ul class="feat-list">
        {rows.map(({ f, n }) => (
          <li
            key={f.id}
            class={store.inspectedFeature.value === f.id ? "on" : ""}
            onClick={() => store.inspectFeature(store.inspectedFeature.value === f.id ? null : f.id)}
          >
            <span class="numbadge">{n ?? "–"}</span>
            <span class="dot" style={{ background: catColor.get(f.category) ?? "#ccc" }} />
            <span class="nm">{f.name}</span>
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
        ))}
      </ul>
    </div>
  );
}

function editFeature(id: string) {
  const p = store.project.value!;
  const f = p.doc.features.find((x) => x.id === id);
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
  const counts: Record<string, number> = {};
  for (const k in p.doc.cells) {
    const c = p.doc.cells[k]!.cat;
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }
  const planCounts: Record<string, number> = {};
  for (const k in p.doc.cells) {
    const z = p.doc.cells[k]!.plan;
    if (z) planCounts[z] = (planCounts[z] ?? 0) + 1;
  }
  return (
    <div class="bp-body legend">
      <h4>{tv("legend.plan")}</h4>
      <ul>
        {p.doc.planLayers.map((z) => (
          <li key={z.id}>
            <span class="sw" style={{ background: z.color }} />
            {z.name} <span class="muted">{planCounts[z.id] ?? 0}</span>
          </li>
        ))}
      </ul>
      <h4>{tv("legend.actual")}</h4>
      <ul>
        {p.doc.categories.map((c) => (
          <li key={c.id}>
            <span class="sw" style={{ background: c.color }} />
            {c.name} <span class="muted">{counts[c.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
