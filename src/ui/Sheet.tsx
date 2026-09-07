import type { ComponentChildren } from "preact";
import { t } from "../i18n";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
}

export function Sheet({ title, onClose, children, footer }: SheetProps) {
  return (
    <div class="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label={title}>
        <header class="sheet-head">
          <b>{title}</b>
          <button class="icon" aria-label={t("common.close")} onClick={onClose}>
            ✕
          </button>
        </header>
        <div class="sheet-body">{children}</div>
        {footer && <footer class="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}
