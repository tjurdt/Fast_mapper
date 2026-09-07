import { useState } from "preact/hooks";
import { t } from "../i18n";
import { tv } from "./vocab";
import { Sheet } from "./Sheet";
import * as store from "../store";
import { isBandKey } from "../core/keys";

// ---- 指定分類與命名區域 ----

export function AssignSheet({ onClose }: { onClose: () => void }) {
  const p = store.project.value!;
  const [catId, setCatId] = useState(p.doc.categories[0]?.id ?? "");
  const [name, setName] = useState("");

  return (
    <Sheet
      title={tv("assign.title")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>{t("assign.cancel")}</button>
          <button
            class="primary"
            disabled={!catId}
            onClick={() => {
              store.assignSelection({ categoryId: catId, featureName: name });
              onClose();
            }}
          >
            {t("assign.apply")}
          </button>
        </>
      }
    >
      <label class="fieldrow">
        <span>{tv("assign.category")}</span>
        <select value={catId} onChange={(e) => setCatId((e.target as HTMLSelectElement).value)}>
          {p.doc.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label class="fieldrow">
        <span>{tv("assign.feature")}</span>
        <input
          class="field"
          placeholder={t("assign.featurePlaceholder")}
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      </label>
    </Sheet>
  );
}

// ---- 單格內容 ----

export function CellDetailSheet({ cellKey, onClose }: { cellKey: string; onClose: () => void }) {
  const p = store.project.value!;
  const cell = p.doc.cells[cellKey];
  const band = isBandKey(cellKey);
  const [plan, setPlan] = useState(cell?.plan ?? "");
  const [cat, setCat] = useState(cell?.cat ?? "");

  const save = () => {
    store.editDoc((doc) => {
      const cur = { ...(doc.cells[cellKey] ?? {}) };
      if (!band) {
        if (plan) cur.plan = plan;
        else delete cur.plan;
      }
      if (cat) cur.cat = cat;
      else {
        delete cur.cat;
        delete cur.feature;
      }
      if (cur.plan || cur.cat || cur.feature || cur.poly) doc.cells[cellKey] = cur;
      else delete doc.cells[cellKey];
      return doc;
    });
    onClose();
  };

  return (
    <Sheet
      title={t("cell.title")}
      onClose={onClose}
      footer={
        <>
          <button
            class="danger"
            onClick={() => {
              store.editDoc((doc) => {
                delete doc.cells[cellKey];
                return doc;
              });
              onClose();
            }}
          >
            {t("cell.clear")}
          </button>
          <button class="primary" onClick={save}>
            {t("cell.save")}
          </button>
        </>
      }
    >
      {!band && (
        <label class="fieldrow">
          <span>{tv("cell.plan")}</span>
          <select value={plan} onChange={(e) => setPlan((e.target as HTMLSelectElement).value)}>
            <option value="">{t("cell.none")}</option>
            {p.doc.planLayers.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label class="fieldrow">
        <span>{tv("cell.category")}</span>
        <select value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value)}>
          <option value="">{t("cell.none")}</option>
          {p.doc.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </Sheet>
  );
}

// ---- 設定 ----

export function SettingsSheet({
  onClose,
  onCats,
  onBaseImage,
}: {
  onClose: () => void;
  onCats: () => void;
  onBaseImage: () => void;
}) {
  const p = store.project.value!;
  const v = p.view;
  return (
    <Sheet title={t("settings.title")} onClose={onClose}>
      <label class="check">
        <input
          type="checkbox"
          checked={v.showGrid}
          onChange={(e) => store.setView({ showGrid: (e.target as HTMLInputElement).checked })}
        />
        {t("settings.showGrid")}
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={v.showLabels}
          onChange={(e) => store.setView({ showLabels: (e.target as HTMLInputElement).checked })}
        />
        {t("settings.showLabels")}
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={v.showNames}
          onChange={(e) => store.setView({ showNames: (e.target as HTMLInputElement).checked })}
        />
        {t("settings.showNames")}
      </label>
      <label class="fieldrow">
        <span>{t("settings.fillA")}</span>
        <input
          type="range"
          min="20"
          max="95"
          value={v.fillA}
          onInput={(e) => store.setView({ fillA: Number((e.target as HTMLInputElement).value) })}
        />
      </label>
      <label class="fieldrow">
        <span>{t("settings.gridW")}</span>
        <input
          type="number"
          class="field"
          value={p.doc.grid.w}
          onChange={(e) =>
            store.setGridSizeAction(Number((e.target as HTMLInputElement).value), p.doc.grid.h)
          }
        />
      </label>
      <label class="fieldrow">
        <span>{t("settings.gridH")}</span>
        <input
          type="number"
          class="field"
          value={p.doc.grid.h}
          onChange={(e) =>
            store.setGridSizeAction(p.doc.grid.w, Number((e.target as HTMLInputElement).value))
          }
        />
      </label>
      <div class="btnrow">
        <button onClick={onCats}>{t("settings.cats")}</button>
        <button onClick={onBaseImage}>{t("baseimg.title")}</button>
      </div>
      <div class="btnrow">
        <button onClick={() => downloadJson(store.exportProjectJson(), p.name)}>
          {t("settings.exportJson")}
        </button>
        <button onClick={pickJson}>{t("settings.importJson")}</button>
      </div>
    </Sheet>
  );
}

// ---- 管理分區 / 分類 ----

export function CategoryModal({ onClose }: { onClose: () => void }) {
  const p = store.project.value!;
  const [tab, setTab] = useState<"plan" | "cat">("cat");
  const items = tab === "plan" ? p.doc.planLayers : p.doc.categories;

  const upd = (id: string, patch: { name?: string; color?: string }) =>
    tab === "plan" ? store.updatePlanLayerAction(id, patch) : store.updateCategoryAction(id, patch);
  const del = (id: string, name: string) => {
    if (!confirm(t("cats.deleteConfirm", { name }))) return;
    if (tab === "plan") store.deletePlanLayerAction(id);
    else store.deleteCategoryAction(id);
  };
  const add = () => {
    const color =
      "#" +
      Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0");
    if (tab === "plan") store.addPlanLayerAction("", color);
    else store.addCategoryAction("", color);
  };

  return (
    <Sheet
      title={tv("cats.title")}
      onClose={onClose}
      footer={
        <button class="primary" onClick={onClose}>
          {t("cats.done")}
        </button>
      }
    >
      <div class="seg">
        <button class={tab === "cat" ? "on" : ""} onClick={() => setTab("cat")}>
          {tv("cats.catTab")}
        </button>
        <button class={tab === "plan" ? "on" : ""} onClick={() => setTab("plan")}>
          {tv("cats.planTab")}
        </button>
      </div>
      <ul class="cat-list">
        {items.map((it) => (
          <li key={it.id}>
            <input
              type="color"
              value={it.color}
              onChange={(e) => upd(it.id, { color: (e.target as HTMLInputElement).value })}
            />
            <input
              class="field"
              value={it.name}
              onChange={(e) => upd(it.id, { name: (e.target as HTMLInputElement).value })}
            />
            <button class="icon danger" onClick={() => del(it.id, it.name)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button onClick={add}>{t("cats.add")}</button>
    </Sheet>
  );
}

// ---- 底圖圖片 ----

export function BaseImageSheet({ onClose }: { onClose: () => void }) {
  const p = store.project.value!;
  const img = p.doc.baseImage;
  return (
    <Sheet title={t("baseimg.title")} onClose={onClose}>
      <label class="btnrow">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) void store.importBaseImage(f);
          }}
        />
      </label>
      {img && (
        <>
          <label class="fieldrow">
            <span>{t("baseimg.opacity")}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={img.opacity}
              onInput={(e) => store.setBaseImageOpacity(Number((e.target as HTMLInputElement).value))}
            />
          </label>
          <label class="fieldrow">
            <span>{t("baseimg.scale")}</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={img.transform.scale}
              onInput={(e) =>
                store.setBaseImageTransform({ scale: Number((e.target as HTMLInputElement).value) })
              }
            />
          </label>
          <button class="danger" onClick={() => void store.removeBaseImage()}>
            {t("baseimg.remove")}
          </button>
        </>
      )}
    </Sheet>
  );
}

// ---- helpers ----

function downloadJson(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "map"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickJson() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    const ok = await store.importProjectJson(await f.text());
    if (!ok) alert("匯入失敗");
  };
  input.click();
}
