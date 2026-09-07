# Fast_mapper 架構

> 這份文件是「怎麼繼續 vibe coding 這個專案而不變成屎山」的規則書。
> 動手加功能前先讀對應章節。

## 一句話

一個**通用的格線／底圖地圖繪製工具**。畫布邏輯是框架無關的純 TypeScript，
DOM 面板用 Preact，狀態集中在一個 signals store，資料層抽象化以便日後接雲端。
東港華僑市場只是一個內建**範本**，不是 app 的一部分。

## 分層與依賴方向

依賴只能由上往下，不能反向或跨層抄捷徑：

```
ui/          Preact 元件（header / sheet / 清單 / 圖例 / modal）
  │  只透過 store 讀狀態、透過 commands 改狀態
interaction/ 手勢 → tools（每個工具一個檔案）
  │
render/      canvas 分層渲染 + pan/zoom + 命中測試排程
  │
store/       @preact/signals 單一狀態源
  │
model/       schema / migrations / commands(undo-redo) / document
  │
persistence/ StorageAdapter 介面 + IndexedDB 實作（+ 未來 remote）
  │
core/        純網域邏輯：幾何、band、編號、taxonomy。零 DOM、零 import 上層
```

**core/ 是地基**：不 import 任何其他層，不碰 `window` / `document`，
每個函式對相同輸入都給相同輸出。所有幾何相關的 bug 修正與新演算法都寫在這裡，
並補 `tests/`。

> 例外：**純型別 import**（`import type`）可以往上指，因為編譯後會被抹掉、
> 沒有執行期耦合。例如 store 用 `import type { Scene }` 取渲染層的型別。

## 資料模型

一個「專案」= 一份 `MapDoc`（見 `src/core/types.ts`）+ 專案 metadata。

| 概念     | 型別        | 舊名 | 說明                                                                     |
| -------- | ----------- | ---- | ------------------------------------------------------------------------ |
| 規劃層   | `PlanLayer` | zone | 原先規劃的底圖分區                                                       |
| 實際分類 | `Category`  | cat  | 實地調查結果的上色分類                                                   |
| 命名區域 | `Feature`   | shop | 由多個格子組成、會被編號的實體                                           |
| 格子     | `Cell`      | cell | `{ plan?, cat?, feature?, poly? }`，鍵為 `"r_c"` 或 `"B<cutId>_<i>_<j>"` |
| 切線／帶 | `Cut`       | cut  | 斜向分割線，可展開成對齊帶                                               |

**程式內部一律用中性名稱**。使用者看到的文字來自：

- `src/i18n/` —— 介面字串（按鈕、提示、sheet 標題）
- `src/vocabulary.ts` —— 每個專案自訂「規劃層 / 分類 / 命名區域」怎麼稱呼
  （市場叫「店家」，展場可能叫「展位」，教室可能叫「座位」）

絕對不要在 `core/` / `render/` / `model/` 裡寫死中文。

## 常見任務怎麼做

### 新增一個工具（例如「橡皮擦」「量距」）

1. 在 `src/interaction/tools/` 新增 `<name>.ts`，實作 `Tool` 介面
   （`src/interaction/tools/types.ts`）。
2. 在 `src/interaction/tools/registry.ts` 註冊。
3. 工具只能透過 `commands` 改文件、透過 `store` 讀 UI 狀態；不要直接改 `MapDoc`。
4. 需要新的幾何運算 → 加到 `core/` 並補測試，不要寫在工具裡。

### 新增一種匯出格式

1. 在 `src/export/` 新增 `<format>.ts`，輸入 `MapDoc` + `MapGeometry` + 選項，
   輸出 bytes / 字串。
2. 不 import `render/`、`store/`、`ui/`。共用的合成邏輯放 `export/composite.ts`。
3. 在匯出 sheet 的選項清單加一項。

### 改資料結構（schema）

1. 把 `SCHEMA_VERSION`（`src/model/schema.ts`）+1。
2. 在 `src/model/migrations/` 新增一支 `{ from, to, migrate(doc) }`，**只往前**，
   寫完就凍結不再改。
3. 補一個測試：舊文件 → migrate → 斷言新文件。
4. `document.ts` 會依序套用所有 migration。

### 新增一個內建範本

在 `src/templates/` 新增 `<name>.ts` 匯出一個 `Template`（含預設 `MapDoc` 與
`vocabulary`），並在 `src/templates/index.ts` 註冊。市場範本 =
`donggang-market.ts`，其巨大的 `cells` 直接沿用 legacy 的 `DEFAULT_PLAN_CELLS`。

## 渲染策略（沿用 legacy 的做法，別重造）

- 兩張 `<canvas>`（base + overlay）疊在一個 `#stage` 容器裡。
- pan/zoom 期間只改容器的 CSS `transform`（便宜），停止操作約 110ms 後才
  重新以正確解析度光柵化。
- 所有重繪透過 `render/scheduler.ts` 的 rAF 批次，元件不直接呼叫 draw。

## 狀態與持久化

- 唯一狀態源：`src/store/`（signals）。元件用 `useSignal` / `computed` 訂閱。
- 改文件一律走 `model/commands.ts`（順帶處理 undo/redo 快照與存檔防抖）。
- 存取媒介：`persistence/adapter.ts` 的 `StorageAdapter`。目前只有
  `indexeddb.ts`（多專案索引 + 文件 + 底圖 blob）。雲端同步日後實作
  `remote.ts`，UI 不需改。
- `localStorage` 僅用於「單一瀏覽器的小便利」（記住上次開的專案、面板收合），
  一律包 try/catch。

## 測試

- `npm test` —— Vitest，只測 `core/`（純函式）與 `model/migrations`。
- 加幾何 / 編號 / 遷移邏輯時**必須**同時加測試。
- render / ui 不寫單元測試；用 `npm run dev` 手動驗證，重要流程日後可補 Playwright。

## 指令

| 指令                              | 作用                     |
| --------------------------------- | ------------------------ |
| `npm run dev`                     | 開發伺服器（HMR）        |
| `npm test` / `npm run test:watch` | 單元測試                 |
| `npm run typecheck`               | `tsc --noEmit`           |
| `npm run lint` / `npm run format` | ESLint + Prettier        |
| `npm run build`                   | typecheck + 產出 `dist/` |
| `npm run preview`                 | 預覽 `dist/`             |

push 到 `main` 會由 `.github/workflows/deploy.yml` 自動部署到 GitHub Pages。

## 現況（重構進度）

見 `docs/ROADMAP.md`。
