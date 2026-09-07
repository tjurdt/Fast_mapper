/**
 * 筆刷工具：先點一個命名區域選為「目標」，之後點 / 拖曳格子即加入或移出該區域。
 * 對應 legacy 的 activeShop + targetbar。
 */
import type { Tool } from "./types";

export const paintTool: Tool = {
  id: "paint",
  labelKey: "tool.paint",
  hintKey: "hint.paint",

  onTap(ctx, p) {
    if (!ctx.activeFeatureId) {
      const id =
        ctx.geo.regularFeatureAtPoint(p.img.x, p.img.y) ?? ctx.geo.bandFeatureAtPoint(p.img.x, p.img.y);
      if (id) ctx.actions.setActiveFeature(id);
      else ctx.actions.toast("先點一個既有區域設為筆刷");
      return;
    }
    ctx.actions.paintCell(p.cell);
  },

  onDrag(ctx, from, to) {
    if (!ctx.activeFeatureId) return;
    ctx.transient.setDragRect([
      Math.min(from.img.x, to.img.x),
      Math.min(from.img.y, to.img.y),
      Math.max(from.img.x, to.img.x),
      Math.max(from.img.y, to.img.y),
    ]);
  },

  onDragEnd(ctx, from, to) {
    ctx.transient.setDragRect(null);
    if (!ctx.activeFeatureId) return;
    // 起點格已屬於目標 → 這趟是「移出」，否則「加入」
    const startCell = ctx.geo.cell(from.cell);
    const erase = startCell?.feature === ctx.activeFeatureId;
    ctx.actions.paintRect(
      [
        Math.min(from.img.x, to.img.x),
        Math.min(from.img.y, to.img.y),
        Math.max(from.img.x, to.img.x),
        Math.max(from.img.y, to.img.y),
      ],
      erase,
    );
  },

  onDeactivate(ctx) {
    ctx.transient.setDragRect(null);
    ctx.actions.setActiveFeature(null);
  },
};
