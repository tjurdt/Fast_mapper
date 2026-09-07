# Fast mapper

通用的**格線／底圖地圖繪製工具**。畫一張分區地圖、標記實際調查結果、自動編號、
匯出成圖片 / PDF / Excel 對照表。可安裝為 PWA、離線使用。

> 原本是「東港華僑市場店家調查」專用的單檔網頁，已重構成適用於任何畫地圖情境、
> 分層、有型別、有測試的架構。東港市場現在只是內建範本之一。
> 舊版保留於 [`legacy/donggang-market.html`](legacy/donggang-market.html)。

## 功能

- **多專案**：每張地圖獨立命名、存於瀏覽器 IndexedDB
- **範本**：空白網格、底圖描繪、東港華僑市場
- **自訂用語**：同一套 UI，可叫「店家」「展位」「座位」「房間」…
- **底圖圖片**：匯入平面圖 / 照片，在上面描繪
- **規劃分區 + 實際分類**兩層；命名區域自動依動線編號
- **切線 / 牆 / 對齊帶**：處理斜向攤位
- **匯出**：PNG / SVG / PDF（含圖例與對照清單）、Excel 對照表、JSON 備份
- **離線**：Service Worker 預先快取，可安裝到主畫面

## 開發

```bash
npm install
npm run dev        # 開發伺服器（HMR）
npm test           # 單元測試（Vitest，78 個）
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint + Prettier
npm run build      # 產出 dist/（含 PWA service worker）
npm run preview    # 預覽 dist/
```

推到 `main` 由 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 自動部署到
GitHub Pages（typecheck → test → build）。

## 架構

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) —— 分層、資料模型、「怎麼加功能」
  （新工具 / 匯出格式 / schema migration / 範本）
- [`docs/ROADMAP.md`](docs/ROADMAP.md) —— 重構進度與待辦

分層（依賴只能由上往下）：

```
ui/          Preact 元件
interaction/ 手勢 → tools（每個工具一個檔案，這是主要擴充接縫）
render/      canvas 分層渲染 + pan/zoom
store/       @preact/signals 單一狀態源
model/       schema / migrations / edits / undo-redo
persistence/ StorageAdapter（IndexedDB；未來 remote 同一介面）
core/        純網域邏輯：幾何、band、編號 —— 零 DOM、100% 可測
```

## 授權

MIT
