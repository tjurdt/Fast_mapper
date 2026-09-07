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

## Phase 4 — interaction/ + tools/ ✅

- `src/interaction/gestures.ts` —— pointer → tap / long-press / drag / pinch / wheel（移植 legacy stagewrap 邏輯）
- `src/interaction/tools/` —— `Tool` 介面 + registry；`select`（框選 / 點格 / 長按單格）、
  `cut`（拖曳畫牆、點選既有切線）、`inspect`（點格看命名區域、拖曳平移）
- `src/interaction/controller.ts` —— 手勢 ↔ 作用中工具 ↔ renderer 的交會點；
  pinch / wheel → viewport
- `src/model/edits.ts` —— 純編輯操作：`assignCells` / `eraseCells` / `moveSelection` /
  `toggleFeatureCell` / `ensureFeatureRegions`（移植 ensureNamedRegions 洪水填充）/
  cut 深度·側·牆·刪除 / feature CRUD / `setCellShape`
- `src/store` —— 選取與編輯 actions（selectRect / assignSelection / eraseSelection /
  moveSelectionBy / addWallSegment / updateCut / feature CRUD）、暫時渲染狀態
  （dragRect / ghostCut）、`uiEvents` 匯流排
- `src/render/layers.ts` —— 畫拖曳框與幽靈切線
- `src/main.ts` —— 過渡用純 DOM 工具列（Phase 5 用 Preact 重建）
- 瀏覽器實測：框選 256 格 → 指定分類建立店家 → undo/redo → 切換工具畫牆，無 error
- `tests/` —— 共 68 個測試（+10：edits）

**Phase 4 尚未移植（之後補）**：封閉區洪水框選（legacy `selectEnclosedAt`）、
斜切格外形編輯、切線端點拖曳把手、「目標區域筆刷」模式（`toggleFeatureCell` 已有純函式、未接工具）。

## Phase 5 — ui/ + i18n + 專案/範本切換 ✅

- `src/i18n/` —— `t(key, params)` + `zh-Hant.ts` 字串目錄；`src/ui/vocab.ts` 的
  `tv()` 自動代入專案 vocabulary（{feature} / {category} / {planLayer}）
- `src/ui/` —— Preact 元件：
  - `App` → `ProjectHub`（多專案清單 + 刪除）/ `TemplatePicker`（三個範本）/ `Editor`
  - `Editor` = `Header` + `Toolbar`（工具 + 實際/底圖 + undo/redo + ⚙）+ `MapStage`
    （掛 MapRenderer + InteractionController）+ `SelectionBar` + `CutBar` + `BottomPanel`
    （清單 / 圖例 分頁）+ sheets
  - sheets：`AssignSheet` / `CellDetailSheet` / `SettingsSheet` /
    `CategoryModal`（分類·分區 CRUD + 顏色）/ `BaseImageSheet`（**底圖圖片匯入 + 透明度/縮放**）
- `src/model/edits.ts` —— 分類/規劃層 CRUD、`setGridSize`
- `src/store` —— 底圖 blob、JSON 匯入/匯出、分類/網格 actions
- `src/main.tsx` —— `render(<App/>)`；舊的純 DOM `main.ts` 移除
- 瀏覽器實測：Hub → 選範本建立東港地圖 → 框選指定分類建「101 阿珠海產」→
  清單顯示編號、地圖畫出區域 → 開設定 / 分類管理，全程 vocabulary 生效，無 error
- 68 個測試（UI 不寫單元測試）

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
