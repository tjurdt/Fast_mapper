import { useState } from "preact/hooks";
import { t } from "../i18n";
import { tv } from "./vocab";
import * as store from "../store";
import { uiEvents } from "../store";
import { LegendIcon } from "./widgets";
import { facilityById, FACILITIES } from "../facilities";

type Tab = "list" | "legend";

/** 桌機：地圖右側常駐側欄；手機：底部抽屜。由 CSS 切換。 */
export function SidePanel({ onClosePanel }: { onClosePanel: () => void }) {
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
        <button
          class="icon sp-collapse"
          aria-label={t("panel.toggle")}
          title={t("panel.toggle")}
          onClick={() => setOpen(!open)}
        >
          {open ? "⟩" : "⟨"}
        </button>
        <button class="sp-done" onClick={onClosePanel}>
          {t("common.done")}
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

  const focus = (id: string) => {
    const same = store.inspectedFeature.value === id;
    store.inspectFeature(same ? null : id);
    if (!same) uiEvents.emit("focus-feature", id); // 只有這裡會 zoom
  };

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
          const fac = facilityById(f.facility);
          return (
            <li
              key={f.id}
              class={store.inspectedFeature.value === f.id ? "on" : ""}
              onClick={() => focus(f.id)}
            >
              <span class="numbadge">{n ?? "–"}</span>
              <span class="dot" style={{ background: catColor.get(f.category) ?? "#ccc" }} />
              <span class="nm">
                {fac ? fac.icon + " " : ""}
                {f.name}
              </span>
              <button
                class="icon"
                aria-label={t("list.edit")}
                onClick={(e) => {
                  e.stopPropagation();
                  uiEvents.emit("feature-sheet", f.id);
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

function Legend() {
  const p = store.project.value!;
  const catCount: Record<string, number> = {};
  const planCount: Record<string, number> = {};
  for (const k in p.doc.cells) {
    const d = p.doc.cells[k]!;
    if (d.cat) catCount[d.cat] = (catCount[d.cat] ?? 0) + 1;
    if (d.plan) planCount[d.plan] = (planCount[d.plan] ?? 0) + 1;
  }
  const facCount: Record<string, number> = {};
  for (const f of p.doc.features) if (f.facility) facCount[f.facility] = (facCount[f.facility] ?? 0) + 1;
  const facs = FACILITIES.filter((fa) => facCount[fa.id]);

  return (
    <div class="sp-body legend">
      <h4>{tv("legend.plan")}</h4>
      <ul>
        {p.doc.planLayers.map((z) => (
          <li key={z.id}>
            <span class="sw" style={{ background: z.color }} />
            <span class="lg-nm">{z.name}</span>
            <span class="muted">{planCount[z.id] ?? 0}</span>
          </li>
        ))}
      </ul>
      <h4>{tv("legend.actual")}</h4>
      <ul>
        {p.doc.categories.map((c) => (
          <li key={c.id}>
            <input
              class="sw"
              type="color"
              value={c.color}
              aria-label={c.name}
              onChange={(e) =>
                store.updateCategoryAction(c.id, { color: (e.target as HTMLInputElement).value })
              }
            />
            <span class="lg-nm">{c.name}</span>
            <span class="muted">{catCount[c.id] ?? 0}</span>
          </li>
        ))}
      </ul>
      <AddCategoryRow />
      {facs.length > 0 && (
        <>
          <h4>{t("legend.facility")}</h4>
          <ul>
            {facs.map((fa) => (
              <li key={fa.id}>
                <span class="fac-ic">{fa.icon}</span>
                <span class="lg-nm">{fa.label}</span>
                <span class="muted">{facCount[fa.id]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <button class="lg-manage" onClick={() => uiEvents.emit("cats-sheet")}>
        {t("legend.manage")}
      </button>
    </div>
  );
}

function AddCategoryRow() {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#4c9aff");
  const add = () => {
    store.addCategoryAction(name.trim() || t("legend.addCat"), color);
    setName("");
  };
  return (
    <div class="lg-add">
      <input
        class="sw"
        type="color"
        value={color}
        aria-label={t("legend.addCat")}
        onInput={(e) => setColor((e.target as HTMLInputElement).value)}
      />
      <input
        class="field"
        placeholder={t("legend.addCat")}
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
      />
      <button class="icon" aria-label={t("legend.addCat")} onClick={add}>
        ＋
      </button>
    </div>
  );
}
