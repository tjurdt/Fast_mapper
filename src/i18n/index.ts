/**
 * 極簡 i18n。`t(key, params)` 取字串並代入 `{name}` 佔位。
 * vocabulary 佔位（{feature} / {category} / {planLayer}）由呼叫端在 params 帶入，
 * 通常透過 ui/useVocab.ts 的 helper。
 */
import { zhHant, type MessageKey } from "./zh-Hant";

const catalogs = { "zh-Hant": zhHant } as const;
export type LocaleId = keyof typeof catalogs;

let locale: LocaleId = "zh-Hant";

export function setLocale(id: LocaleId): void {
  locale = id;
}

export type TParams = Record<string, string | number>;

export function t(key: MessageKey, params?: TParams): string {
  const raw: string = catalogs[locale][key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

export type { MessageKey };
