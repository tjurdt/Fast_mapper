/** 網格工具（預設）：選格子、拖曳框選、長按開單格細節，接著在動作列指定分類。 */
import type { ImgRect, Tool } from "./types";

const rectOf = (from: { img: { x: number; y: number } }, to: { img: { x: number; y: number } }): ImgRect => [
  Math.min(from.img.x, to.img.x),
  Math.min(from.img.y, to.img.y),
  Math.max(from.img.x, to.img.x),
  Math.max(from.img.y, to.img.y),
];

export const gridTool: Tool = {
  id: "grid",
  labelKey: "tool.grid",
  hintKey: "hint.grid",

  onTap(ctx, p) {
    ctx.actions.toggleCell(p.cell);
  },

  onLongPress(ctx, p) {
    ctx.actions.openCellDetail(p.cell);
  },

  onDrag(ctx, from, to) {
    ctx.transient.setDragRect(rectOf(from, to));
  },

  onDragEnd(ctx, from, to) {
    ctx.transient.setDragRect(null);
    ctx.actions.selectRect(rectOf(from, to), true);
  },

  onDeactivate(ctx) {
    ctx.transient.setDragRect(null);
  },
};
