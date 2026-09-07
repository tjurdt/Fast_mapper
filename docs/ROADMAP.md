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

## Phase 10 — 物件選取模式 + 設施 icon ✅

- **工具重整**：`選取`→`網格`、`線條`維持、`筆刷`移除改回`檢視`（原 inspect），
  新增第四個 `選取` 工具（`objselect`，以「物件」為單位）
- **`選取` 模式**（`src/interaction/tools/objselect.ts`）：
  - 點牆 → 選整道牆（連同斜格與格上的內容）；點區域 → 選整個命名區域；拖曳框選
  - 動作列：`↑ ↓ ← → | 位移 | 刪除 | 完成`（方向鍵也能移動）
  - `位移` 對話框一次設定水平 + 垂直位移，可「移動」或「複製」
  - 桌機 **Ctrl+C / Ctrl+X / Ctrl+V**（`clipboardCopy/Paste`，點另一處設貼上錨點）、
    **Delete** 刪除物件
- `src/model/edits.ts`：`moveObjects` / `copyObjects`（牆用新 id、斜格資料跟著複製）/
  `deleteObjects` / `buildClipboard` / `pasteObjects`；`src/core/geometry.ts` `cutsInRect`
- **設施 icon**（`src/facilities.ts`）：`Feature.facility` 欄位 + 14 種內建設施
  （廁所🚻 / 哺乳室🍼 / 停車場🅿️ / 服務台ℹ️ …）。地圖在區域錨點畫 icon（編號縮成
  角標）、圖例多「設施」區、`FeatureSheet` 可設定；PNG / SVG 匯出同步
- **桌機字級 / 按鈕再放大**（`@media (min-width: 960px)` 專屬區塊）
- `tests/` —— 90 個測試（+5）

## Phase 11 — 匯入修復 + 手機動作列／控制塢重整 ✅

- **修好 legacy 單檔 JSON 匯入**：`importProjectJson` 偵測 `{zones,cells}` 且無
  `doc/schemaVersion` → 走 `projectFromLegacyState`；匯入成功後自動關設定對話框
- **手機動作列**：拿掉整條白色襯底，改成貼底單列、可橫向捲動、按鈕各自帶陰影；
  工具列每顆按鈕更矮、字縮到 ~0.72rem
- **`.mobiledock`**：手機右下浮動控制塢（返回／重作／圖例），隨動作列開啟上抬；
  header 的返回／重作在手機隱藏（`.only-desktop`）
- **切線設定列**：`深度` ± 步進 → `加網格` 下拉（0–8）；`刪除切線` → `刪除`；
  畫完線條自動選取新線並開啟設定列（`cut.ts` onDragEnd → `beginEditCut`）
- **「選取」模式複製 → 貼上流程**：`複製` 按鈕存進剪貼簿並切到
  `貼上／取消複製／完成`；點任一格設定貼上位置再按「貼上」（`store.pasteMode`
  signal + `ToolContext.pasteMode`）；方向鍵盤在手機縮小為 ~½
- **手機對話框置中**：移除 mobile 的 bottom-sheet override，所有 `Dialog` 一律置中
- **圖例分頁可新增分類**：`Legend` 內建色票 + 名稱 + `＋`，以及「管理分類」→ 開
  `CategoryModal`；既有分類色票可直接點開改色
- `tests/` —— 91 個測試（+1）

## Phase 12 — 渲染順暢化（對齊 legacy） + 指定分類還原好用功能 ✅

- **渲染模型改回 legacy 作法**：三張 canvas 都畫成整張影像大小、只光柵化一次；
  pan / zoom / 聚焦 **只改 `.stage` 的 CSS transform，完全不重畫**。backing store
  受 4096 單邊上限保護（iOS Safari），必要時自動降解析度。
  → 複雜地圖滑動 / 縮放不再卡頓、聚焦清單項目即時
- **AssignSheet 還原 legacy 好用功能**：
  - 命名區域輸入框改成**下拉搜尋**（依編號 / 名稱即時篩選既有區域，選了自動帶分類）
  - **「沿用重疊區域」chips**：選取重疊到既有區域 / 分類時列出，點一下帶入；
    只重疊一個時自動帶入（`store.selectionOverlapMarks()`）
- **側欄 3 分頁 + icon**：`清單` / `圖例` / `圖例管理`；移除「就地收合」狀態
  （只剩開 / 關）、`完成`→`✕`。`圖例` 與 `圖例管理` 依檢視模式切換：
  實際檢視編實際分類、底圖檢視編底圖分類。`規劃分區` → **`底圖分類`**（vocab 預設）
- **手機動作列**：`網格` / 貼上流程三顆按鈕平均分佈貼底（`.actionbar.simple`）
- **下拉選單高度**加大（`min-height: 2.6rem`）
- 編號演算法確認與 legacy `recompute` 完全一致（未改動）
- `tests/` —— 92 個測試（+1）

## Phase 13 — 對話框放大 + 物件框選 group + 檢視聯動清單 + 暖色主題 ✅

- **對話框加寬**（`min(38rem…)`）＋ AssignSheet 搜尋結果改成**行內展開**（不再被
  對話框下界切掉）；`.dialog-body` 加 `min-height`
- **手機動作列再壓縮**：按鈕左右內距縮小；`↑↓←→` 併成**一個圓角框**、箭頭間以
  細線分隔（`.actionbar .dpad` segmented），線條 / 選取模式一列放得下
- **檢視工具聯動清單**：點店家 → 右側自動切到「清單」分頁並只顯示該店家
  （手機順便展開面板）；點空白 / 切換工具 → 清除並收回（`store.listReveal`
  - `panel-open`/`panel-close` 事件）
- **「選取」模式框選以物件為單位**：矩形只要碰到店家任一格或牆線段，整個物件
  （連同 group）就被選。**牆＋斜格＋斜格上的店家視為一 group**，一起選 / 移動 /
  複製 / 刪除（`store.expandObjectGroup` 定點展開；`geo.cutsInRect` 改線段相交、
  新增 `geo.featuresInRect` / `geo.featuresOnCut`；`poly.ts` 匯出 `segCrossesRect`）
- **暖色系典雅主題**：`:root` 全面改暖色（奶油 / 赤陶 / 濃咖啡）；新增
  `--on-ink` / `--emph` token，修掉寫死的亮色（頁首、maphint、toast、cyclebtn、
  targetbar、legendicon）；暗色模式一併改暖色深棕、文字轉亮。地圖底色 / 格線
  也改暖灰
- `tests/` —— 95 個測試（+3）

## Phase 14 — 複雜地圖徹底提速 + 動作列置中 + 匯出地圖名 ✅

- **`DocHistory`**：不再每次編輯都 `JSON.stringify` 整份 doc —— 堆疊直接存
  `MapDoc` 參照（`editDoc` 產出的 doc 之後不再被改），大地圖每次編輯省 ~30–40ms
- **`editDoc` 契約**：fn 回傳 `null` = no-op（不更新、不進歷史）—— 失敗的移動 /
  複製不再產生假的歷史紀錄
- **`bands.ts`**：`cutGeom` + `computeBandCover` **依切線參數逐條記憶化**。
  非切線編輯直接命中；移動一道牆只 miss 一條、其餘 39 條沿用
- **`MapGeometry`**：`featureKeyIndex` / `featureComponents` / `featureLabelAnchors`
  實例內記憶化（`computeNumbers` 與 `drawContentLayer` 不再重算）；
  `drawFeatureBorders` 跳過「四周同區域」的內部格；`bandFeatureAtPoint` 加 bbox
  快速剔除、邊界過濾只對「靠近帶」的格做
- **`drawActualFill`**：一般方格依顏色批次成單一 path（取代每格一次 `fillRect`）
- **渲染分層**：`interaction`（選取框 / 端點把手）改成**螢幕大小、在 `.stage` 外**、
  ctx 直接套視角變換 —— 拖曳端點 / 框選時每幀只清一塊螢幕大小畫布（原本清整張
  影像大小）。base/content backing 上限降到 1.5×
- **拖曳切線端點**：改成 transient 即時預覽（`store.cutDragPreview`），放手才
  commit 一次 —— 不再每個 pointermove 都跑一次 editDoc（大地圖上原本會凍結）
- store 的移動 / 複製 / 指定 / 擦除 action 用 `batch()` 包起來 → 一次重繪
- 手勢：`MOVE_THRESHOLD` 9、`TAP_SLOP` 12 —— 觸控抖動仍算「點一下」，
  修掉檢視模式「點物件後點空白，偶爾亂 zoom / 高亮不相關物件」
- **動作列**：手機所有模式（網格 / 線條 / 選取）一律 `space-between`，
  左右邊距對稱且與網格模式相同（10px）
- **匯出**：可勾選「在圖上加地圖名稱」（預設開、預設帶專案名）；
  匯出解析度上限拉低（9M px / 1.6×）→ 大地圖匯出更快
- `MAX_DPR` 相關 + `engine.resize()` 尺寸沒變就略過
- `tests/` —— 96 個測試（+1）
- 實測（4× CPU throttle 模擬中階手機、5148 格 / 143 店家 / 40 切線）：
  物件移動 ~325ms（原 ~950ms）、端點拖曳 ~32fps（原 ~3fps）、載入 ~800ms

## Phase 15 — JSON 內嵌底圖 + 斜格選取標註 + 貼上位置標記 + 端點犧牲方向 ✅

- **匯出 JSON 內嵌底圖圖片**：`exportProjectJson()` 改 async，把底圖 blob 轉 data URI
  放進 `assets`；`importProjectJson` 讀 `assets` 還原成 blob（同一 `blobId`）。
  沒帶圖的參照會被清掉，不會卡在載入
- **「選取」模式選牆時，牆的斜格也塗上選取色**（`drawSelectedCuts` 加 band 格填色）
  —— 跟一般格一樣被標註
- **複製 → 貼上流程**：進入時清掉舊錨點；必須先在地圖點一個位置（畫面出現橘色
  十字準心標記 `scene.pasteMarker`），「貼上」在標記前是 disabled（顯示「先點位置」）；
  貼上位置＝標記格的左上角
- **檢視模式收合不再閃**：`revealFeatureInList(null)` 先發 `panel-close` 讓抽屜開始關，
  手機延遲 260ms（動畫時間）才清 filter；桌機即時
- **切線端點拖曳縮短時**：斜格內容依「世界座標」重新定位到新的帶格 —— 落在被拉近
  的那個端點附近、超出新帶範圍的內容才被犧牲（原本一律犧牲 b 端附近）
- `tests/` —— 98 個測試（+2）

## Phase 16 — 複製獨立化 + 貼上不再失敗 + Ctrl+Z + 端點搬移規則 ✅

- **複製 / 貼上會給內容全新的 feature id**（`makeFeatureRemapper`）—— 複本命名
  `原名（複本）`、與來源完全獨立，不會被連動選取（解決「拉到別處的雙胞胎連鎖」）
- **貼上不再默默失敗**：`pasteObjects` 依內容包圍盒把貼上位置**夾進網格**（靠邊點
  也貼得下）；`clipboardPaste` 真的沒貼到才回 false，動作列跳「貼不下」提示；
  失敗不再寫進歷史
- 複製 / 貼上後 `pruneOrphanFeatures` 清掉沒有格子的殘留 feature
- **Ctrl+Z 復原、Ctrl+Shift+Z / Ctrl+Y 重作**（`MapStage` 全域鍵盤）
- **切線端點搬移規則重寫**（Phase 15 的世界座標法在旋轉時會誤刪，改回段索引法）：
  斜格以「沿切線第 i 段」索引。移動 b 端 → i 不變（內容釘在 a 端），只有 i ≥ 新段數
  的被犧牲；移動 a 端 → i 全部平移（新段數 − 舊段數），內容釘在 b 端；**長度不變 →
  完全不變；拉一圈回原位（commit 只在放手）→ 完全不變**；拉長 → 多出的段沒內容
- `tests/` —— 100 個測試（+2）

## Phase 17 — 連通分量選取 + 端點犧牲可回復 + 斜格沿用重疊 + 新 ICON ✅

- **選取以「連通分量」為單位**（取代 Phase 16 的「複製給新 feature id」）：
  `MapGeometry.componentContaining(k)` 回傳含該格的那一塊；`expandObjectGroup` 從
  格鍵（而非 feature id）種子出發 —— 點某店家分開的其中一塊，只選到那一塊，
  分開的雙胞胎不連動。`pickObjectGroup({ cutId?, cellKey? }, …)`；`objselect` 工具
  傳入被點到的格鍵（斜格經 `geo.bandCellAt`）。`copyObjects` / `pasteObjects`
  **還原成共用同一個 feature id**（移除 `makeFeatureRemapper` 與 `pruneOrphanFeatures`）
- **端點縮短犧牲的斜格可回復**：`moveCutEndpoint` 加選用 `stash` 參數，store 用
  `cutStash`（{ cutId, cells }）記住「編輯這條線」期間被犧牲的內容 —— 只要在切到
  別條線之前把線拉回去，內容自動復原；`beginEditCut` 換線、`setCutDepth` / `updateCut`
  / undo / 換專案時清空 = 犧牲定案
- **斜格也能「沿用重疊區域」**：`selectionOverlapMarks` 現在把斜格自己的
  `cat` / `feature` 一併計入（先前只展開到底下的一般格）
- **全新網站 ICON**（`public/favicon.svg` + `favicon-maskable.svg`）：暖色摺疊地圖
  ＋定位針，`theme-color` / manifest 改暖色（`#3d322a` / `#f3ece0`），
  重新輸出 `icon-192/512`、`apple-touch-icon`、`icon-maskable`、`favicon-32`
- `tests/` —— 105 個測試（+5）

## 驗證清單

- [ ] 舊 `grid-market-v4` localStorage 內容 → 自動匯入為「東港華僑市場」專案，
      與 legacy 並排比對一致
- [ ] blank 範本建新專案、改 vocabulary、匯入底圖描繪 —— 無市場專屬字串
- [ ] 新舊版匯出 PNG/SVG/PDF/XLSX 對拍一致
- [ ] `npm run build && npm run preview` 正常
- [ ] GitHub Actions 部署成功
