/**
 * 選取工具：以「物件」為單位選取 —— 牆（連同斜格與格上的內容）、命名區域、
 * 框選範圍內所有東西。接著在動作列做整體移動 / 複製 / 刪除，桌機支援 Ctrl+C/X/V。
 */
import type { ImgRect, Tool } from "./types";

const rectOf = (from: { img: { x: number; y: number } }, to: { img: { x: number; y: number } }): ImgRect => [
  Math.min(from.img.x, to.img.x),
  Math.min(from.img.y, to.img.y),
  Math.max(from.img.x, to.img.x),
  Math.max(from.img.y, to.img.y),
];

export const objSelectTool: Tool = {
  id: "objselect",
  labelKey: "tool.objselect",
  hintKey: "hint.objselect",

  onTap(ctx, p) {
    ctx.actions.setPasteAnchor(p.cell);
    if (ctx.pasteMode) return; // 貼上流程：只記錨點，不動選取
    const nearCut = ctx.geo.cutNear(p.img.x, p.img.y, ctx.hitTolerance());
    if (nearCut) {
      ctx.actions.toggleCutSelected(nearCut);
      return;
    }
    const feat =
      ctx.geo.regularFeatureAtPoint(p.img.x, p.img.y) ?? ctx.geo.bandFeatureAtPoint(p.img.x, p.img.y);
    if (feat) {
      ctx.actions.selectWholeFeature(feat, true);
      return;
    }
    ctx.actions.clearSelection();
  },

  onDrag(ctx, from, to) {
    if (ctx.pasteMode) return;
    ctx.transient.setDragRect(rectOf(from, to));
  },

  onDragEnd(ctx, from, to) {
    if (ctx.pasteMode) return;
    ctx.transient.setDragRect(null);
    ctx.actions.objSelectRect(rectOf(from, to), true);
  },

  onDeactivate(ctx) {
    ctx.transient.setDragRect(null);
    ctx.actions.clearSelection();
  },
};
