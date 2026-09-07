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

## Phase 6 — export/ ✅

- `src/render/primitives.ts` —— 抽出地圖繪圖基元（plan/actual fill、格線、band、
  邊界、牆、標籤），螢幕 `layers.ts` 與匯出 `composite.ts` 共用 → 匯出與畫面一致
- `src/export/` —— `layout`（版面計算、feature 排序、換行）、`composite`（canvas
  合成：地圖 + 圖例 + 對照清單）、`svg`（向量，含 band 遮罩）、`zip`（crc32 +
  store ZIP）、`xlsx`（inline-string 工作表）、`pdf`（單頁 JPEG）、`rows`、
  `index`（`exportImage` / `exportXlsx` / `downloadFile`）
- `src/core/geometry.ts` —— `featureAnchor`（對照表首格位置）
- `src/store` —— `exportMap(format, opts)`；`src/ui/sheets.tsx` —— `ExportSheet`
- 瀏覽器實測：PNG / SVG / PDF / Excel 四種格式皆正確下載，圖例 + 對照清單齊全，無 error
- `tests/` —— 共 78 個測試（+10：crc32 向量、zip/xlsx/pdf 簽章、layout、svg、rows）

## Phase 7 — 收尾 ✅

- PWA：`vite-plugin-pwa` + manifest + 圖示（`public/icon-*.png`）+ service worker
  precache + 離線 SPA 回退；`index.html` theme-color / apple-touch-icon
- `src/persistence/remote.ts` —— 雲端同步 adapter 骨架（實作同一 `StorageAdapter` 介面）
- **code-split**：donggang 2768 格底圖 JSON（cells + canonical）改動態 import，
  主 bundle ~210KB → ~108KB；只在建立該範本 / 匯入 <v4 舊存檔時載入
- README 補完；`legacy/README.md` 說明保留原因（不參與建置，僅作對照）

## Phase 8 — Phase 4 補完 + UI 重新設計（桌機優先，模仿原版）✅

- **封閉區洪水框選**：`src/core/enclosed.ts`（移植 `selectEnclosedAt`）；`cut` 工具
  點封閉空白處 → 選整塊、邊界格自動斜切；`assignCells` 套用 `shapes` → `cell.poly`
- **切線端點拖曳把手**：`geo.cutHandleNear` + `cut` 工具 `onDragStart` 判定；
  編輯中畫端點圓點
- **筆刷模式**：`paint` 工具 + `activeFeatureId`；點區域設目標，點/拖曳格子加入/移出
- **UI 重新設計**（`src/ui/` 大改）：
  - 桌機格狀版面：深色 header（含 實際/底圖 seg + undo/redo）→ toolbar → 地圖 + **右側常駐側欄**（清單/圖例）
  - 地圖上**懸浮控制項**：`ZoomStack`（右上）、`MapHint`（左上 pill，隨工具變）、
    `ActionBar`（下方懸浮，選取→指定/移動/清除/完成；切線→循環鈕 + 深度 stepper；
    筆刷→ targetbar），色彩標記（橘=指定、深紅=刪除、青=完成）
  - `CycleButton`（點一下循環，取代小下拉）、conic-gradient `LegendIcon`
  - sheets → `Dialog`（置中懸浮，非下方捲上來）
  - 手機：側欄變底部抽屜，右下 FAB 開合
  - `gestures.ts` 忽略落在懸浮控制項上的指標事件
- **移除東港華僑市場範本**：`TEMPLATES` 只留空白網格 / 底圖描繪；`donggangMarket.ts`
  僅保留給 legacy 匯入。空白範本改附 3 個起始分類 + 2 個規劃層
- `tests/` —— 共 82 個測試（+6：enclosed、shapes）
- 瀏覽器實測（桌機 + 手機 + 深色）：四項功能 + 新版面皆正常，無 error

## Phase 9 — 效能 + UX 徹底盤點 ✅

- **效能**：render 從 2 canvas 拆成 **3 層**（base / content / interaction）。
  `setScene` 比對前後 scene，選取／拖曳框只重畫最上層便宜的 interaction；文件
  編輯才重畫 content。`MAX_DPR` 降 2 → 手機複雜地圖不再卡頓
- **修掉亂 zoom**：舊 `setScene` 以 `doc.grid` **物件識別**判斷是否 refit，但
  `editDoc` 每次 clone 讓 grid 換新物件 → 每次編輯都跳全覽。改成比對**尺寸值**；
  視窗 resize 改 `renderer.resize()`（保留視角）。**只有**全覽鈕與「點清單項目」
  （`frameRegion` 聚焦該區域）會改縮放
- **動作列重做（無外框）**：選取 →『編輯 / 移動 / 清除 / 完成』四鈕，各帶陰影 +
  色彩標記；桌機加大、手機整條貼底水平等分。切線編輯用循環鈕；選取時 FAB 讓位
- **移動模式**：選取列點「移動」→『↑ ↓ ← → | 複製… | 返回』。方向鍵也能移動選取。
  `複製…` 開對話框（方向 + 距離），複製選取內容到某方向第 n 格（`copySelection`）
- **合併 檢視 + 筆刷**（`inspect` 工具移除）；工具「切線／牆」改名「線條」
- 字級 / RWD 全面盤點：桌機改 flex shell 修水平溢位、字放大；手機 header 縮排、
  工具列可捲
- `tests/` —— 85 個測試（+3）

## 驗證清單

- [ ] 舊 `grid-market-v4` localStorage 內容 → 自動匯入為「東港華僑市場」專案，
      與 legacy 並排比對一致
- [ ] blank 範本建新專案、改 vocabulary、匯入底圖描繪 —— 無市場專屬字串
- [ ] 新舊版匯出 PNG/SVG/PDF/XLSX 對拍一致
- [ ] `npm run build && npm run preview` 正常
- [ ] GitHub Actions 部署成功
