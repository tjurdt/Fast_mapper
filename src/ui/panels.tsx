import { useState } from "preact/hooks";
import { t } from "../i18n";
import { tv } from "./vocab";
import * as store from "../store";
import { uiEvents } from "../store";
import { LegendIcon } from "./widgets";
import { facilityById, FACILITIES } from "../facilities";

type Tab = "list" | "legend" | "manage";

/** 桌機：地圖右側常駐側欄；手機：底部抽屜（只有開／關兩種狀態）。 */
export function SidePanel({ onClosePanel }: { onClosePanel: () => void }) {
  const [tab, setTab] = useState<Tab>("list");
  const p = store.project.value;
  if (!p) return null;

  return (
    <aside class="sidepanel">
      <div class="sp-head">
        <button class={tab === "list" ? "tab on" : "tab"} onClick={() => setTab("list")}>
          <span class="tab-ic">▤</span>
          {tv("list.title")}
        </button>
        <button class={tab === "legend" ? "tab on" : "tab"} onClick={() => setTab("legend")}>
          <LegendIcon size={13} />
          {t("legend.title")}
        </button>
        <button class={tab === "manage" ? "tab on" : "tab"} onClick={() => setTab("manage")}>
          <span class="tab-ic">⚙</span>
          {t("legend.manage")}
        </button>
        <span class="grow" />
        <button class="icon sp-done" aria-label={t("common.close")} onClick={onClosePanel}>
          ✕
        </button>
      </div>
      {tab === "list" ? <FeatureList /> : tab === "legend" ? <Legend /> : <ManageCategories />}
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
  const plan = p.view.view === "plan";
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

  const items = plan
    ? p.doc.planLayers.map((z) => ({ id: z.id, name: z.name, color: z.color, n: planCount[z.id] ?? 0 }))
    : p.doc.categories.map((c) => ({ id: c.id, name: c.name, color: c.color, n: catCount[c.id] ?? 0 }));

  return (
    <div class="sp-body legend">
      <h4>{plan ? tv("legend.plan") : tv("legend.actual")}</h4>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <span class="sw" style={{ background: it.color }} />
            <span class="lg-nm">{it.name}</span>
            <span class="muted">{it.n}</span>
          </li>
        ))}
        {!items.length && <li class="muted">{t("legend.emptyCats")}</li>}
      </ul>
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
    </div>
  );
}

/** 圖例管理：依目前檢視模式編輯「實際分類」或「底圖分類」。 */
function ManageCategories() {
  const p = store.project.value!;
  const plan = p.view.view === "plan";
  const items = plan ? p.doc.planLayers : p.doc.categories;
  const [name, setName] = useState("");
  const [color, setColor] = useState(plan ? "#7bb0e0" : "#4c9aff");

  const upd = (id: string, patch: { name?: string; color?: string }) =>
    plan ? store.updatePlanLayerAction(id, patch) : store.updateCategoryAction(id, patch);
  const del = (id: string, nm: string) => {
    if (!confirm(t("cats.deleteConfirm", { name: nm }))) return;
    if (plan) store.deletePlanLayerAction(id);
    else store.deleteCategoryAction(id);
  };
  const add = () => {
    const nm = name.trim() || t("legend.addCat");
    if (plan) store.addPlanLayerAction(nm, color);
    else store.addCategoryAction(nm, color);
    setName("");
  };

  return (
    <div class="sp-body">
      <p class="sp-hint">{plan ? t("manage.hintPlan") : t("manage.hintActual")}</p>
      <ul class="cat-list">
        {items.map((it) => (
          <li key={it.id}>
            <input
              type="color"
              value={it.color}
              onInput={(e) => upd(it.id, { color: (e.target as HTMLInputElement).value })}
            />
            <input
              class="field"
              value={it.name}
              onInput={(e) => upd(it.id, { name: (e.target as HTMLInputElement).value })}
            />
            <button class="icon danger" aria-label={t("cats.delete")} onClick={() => del(it.id, it.name)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div class="lg-add">
        <input type="color" value={color} onInput={(e) => setColor((e.target as HTMLInputElement).value)} />
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
    </div>
  );
}
