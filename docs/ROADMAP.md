# 重構進度

目標：把 legacy 單檔 app（`legacy/donggang-market.html`）重寫成分層、有型別、
有測試的通用地圖工具。詳見 `docs/ARCHITECTURE.md`。

## Phase 0 — 骨架 ✅

- Vite + TypeScript + Preact + Vitest + ESLint/Prettier
- `.github/workflows/deploy.yml`（typecheck → test → build → GitHub Pages）
- `docs/ARCHITECTURE.md`
- 佔位進入點（`src/main.ts`）

## Phase 1 — core/（純邏輯 + 測試）✅

- `src/core/types.ts` —— 中性命名的網域型別
- `src/core/poly.ts` —— polyArea / clipPolyToRect / pointInPoly / subtractIntervals
- `src/core/cells.ts` —— cellShape / cellHidden / cellSideIntervals
- `src/core/bands.ts` —— cutGeom / bandQuad / bandOuter / bandLocate / computeBandCover
- `src/core/geometry.ts` —— `MapGeometry`：keyQuad / cellVisible / gridKeysUnderQuad /
  featureKeyIndex / featureComponents / 命中測試 / border segments
- `src/core/numbering.ts` —— featureSortMetrics / computeNumbers
- `tests/` —— 37 個 Vitest 測試

## Phase 2 — schema / model / persistence / store ✅

- `src/model/schema.ts` —— `SCHEMA_VERSION`、`Project`、`createProject`
- `src/model/migrations/` —— 前向遷移登錄表（目前 v1，清單空）
- `src/model/legacy.ts` —— 凍結 legacy `normalizeTaxonomy` 市場別名；
  `grid-market-v4` localStorage → `Project`
- `src/model/normalize.ts` —— MapDoc 結構整理（懸空參照、型別強制）
- `src/model/document.ts` —— `loadProject` / `serializeProject`（含遷移 + 容錯）
- `src/model/commands.ts` —— `DocHistory`（snapshot undo/redo）
- `src/vocabulary.ts` —— 每專案自訂用語
- `src/persistence/` —— `StorageAdapter` 介面 + `IndexedDbAdapter` + `MemoryAdapter`
- `src/store/` —— signals：`project` / `geometry`(computed) / `numbers`(computed) /
  `selection`；actions：`bootstrap` / `openProject` / `createFromTemplate` /
  `editDoc` / `undo` / `redo`；防抖存檔
- `src/templates/` —— `blank-grid` / `blank-image` / `donggang-market`（含 2768 格底圖 JSON）
- `tests/` —— 共 51 個測試（+14）

## Phase 3 — render/ ✅

- `src/render/viewport.ts` —— pan/zoom 純數學（`Viewport`）
- `src/render/scheduler.ts` —— rAF 批次重繪（`RenderScheduler`）
- `src/render/draw2d.ts` —— canvas 低階工具（hexA / fillQuad / clipOutsideQuads）
- `src/render/layers.ts` —— drawBaseLayer / drawOverlayLayer（分區、實際分類、
  band、格線、邊界、標籤、切線、選取、高亮）
- `src/render/baseImage.ts` —— 底圖圖片層（blob → ImageBitmap，依 transform 繪製）
- `src/render/engine.ts` —— `MapRenderer`：雙 canvas + CSS transform 即時預覽 +
  110ms 後重新光柵化，`ResizeObserver` 自適應
- `src/render/navigation.ts` —— 過渡期基本導覽（拖曳平移、滾輪縮放）；Phase 4 取代
- `src/store` 新增 `scene`(computed)；`src/main.ts` 掛上渲染
- 瀏覽器實測：東港華僑市場底圖正確繪出，平移 / 縮放 / 重新光柵化正常，無 console error
- `tests/` —— 共 58 個測試（+7：viewport、scheduler）

## Phase 4 — interaction/ + tools/ ⬜

- 手勢層；Tool registry；assign / cut / move / inspect / cell-detail 各一檔

## Phase 5 — ui/ + i18n + 專案/範本切換 ⬜

- Preact 重建 header / topbar / sheet / 清單 / 圖例 / modal
- `i18n/` + `vocabulary.ts`：移除所有寫死字串
- ProjectPicker（多專案）、TemplatePicker（含 donggang-market 範本）
- 底圖圖片匯入 UI

## Phase 6 — export/ ⬜

- 移植 zip / xlsx / pdf / svg / png / composite

## Phase 7 — 收尾 ⬜

- PWA（離線）、`remote.ts` 介面定稿、README、ARCHITECTURE how-to 補完
- 移除 `legacy/`（或永久保留作對照）

## 驗證清單

- [ ] 舊 `grid-market-v4` localStorage 內容 → 自動匯入為「東港華僑市場」專案，
      與 legacy 並排比對一致
- [ ] blank 範本建新專案、改 vocabulary、匯入底圖描繪 —— 無市場專屬字串
- [ ] 新舊版匯出 PNG/SVG/PDF/XLSX 對拍一致
- [ ] `npm run build && npm run preview` 正常
- [ ] GitHub Actions 部署成功
