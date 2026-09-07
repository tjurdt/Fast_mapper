/**
 * 我方 schema 的前向遷移。每支只往前一版，寫完凍結。
 * 目前 schema v1，所以清單為空 —— 之後每次 SCHEMA_VERSION +1 就在這裡加一支。
 *
 * 範例：
 *   { from: 1, to: 2, migrate(raw) { ...回傳 v2 形狀... } }
 */
export interface Migration {
  from: number;
  to: number;
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
}

export const MIGRATIONS: Migration[] = [];

/** 依 schemaVersion 依序套用所有 migration，回傳最新形狀（仍是 raw 物件，交由 document.ts 驗證）。 */
export function applyMigrations(raw: Record<string, unknown>): Record<string, unknown> {
  let cur = raw;
  let version = typeof cur.schemaVersion === "number" ? cur.schemaVersion : 0;
  // 允許亂序定義；每輪找一支 from === version 的
  for (;;) {
    const m = MIGRATIONS.find((x) => x.from === version);
    if (!m) break;
    cur = m.migrate(cur);
    version = m.to;
    cur.schemaVersion = version;
  }
  return cur;
}
