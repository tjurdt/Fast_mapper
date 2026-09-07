/**
 * 進入點。Phase 5：Preact UI。
 * bootstrap 載入資料（含首次的 legacy 匯入）→ 沒有專案時顯示 ProjectHub，否則 Editor。
 */
import { render } from "preact";
import "./styles.css";
import { App } from "./ui/App";
import * as store from "./store";

render(<App />, document.getElementById("app")!);
void store.bootstrap();

if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof store }).__store = store;
}
