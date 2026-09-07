/** 綁定目前專案 vocabulary 的 t() 包裝。 */
import { t, type MessageKey, type TParams } from "../i18n";
import { project } from "../store";
import { DEFAULT_VOCABULARY } from "../vocabulary";

export function vocabParams(): TParams {
  const v = project.value?.vocabulary ?? DEFAULT_VOCABULARY;
  return { feature: v.feature, category: v.category, planLayer: v.planLayer };
}

/** t() + 自動帶入 vocabulary 佔位。 */
export function tv(key: MessageKey, extra?: TParams): string {
  return t(key, { ...vocabParams(), ...extra });
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("zh-Hant", { dateStyle: "medium", timeStyle: "short" });
}
