import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { t } from "../i18n";

/**
 * 懸浮對話框（置中，不是從下方捲上來的 sheet）。
 * 桌機：置中卡片；手機：靠下、幾乎滿寬。
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div class="dialog-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={wide ? "dialog wide" : "dialog"} role="dialog" aria-label={title}>
        <header class="dialog-head">
          <b>{title}</b>
          <button class="icon" aria-label={t("common.close")} onClick={onClose}>
            ✕
          </button>
        </header>
        <div class="dialog-body">{children}</div>
        {footer && <footer class="dialog-foot">{footer}</footer>}
      </div>
    </div>
  );
}
