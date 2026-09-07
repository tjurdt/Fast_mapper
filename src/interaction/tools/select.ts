/** 選取工具（legacy 的 assign 模式預設行為）：點格切換、拖曳框選、長按開單格細節。 */
import type { Tool } from "./types";

export const selectTool: Tool = {
  id: "select",
  labelKey: "tool.select",

  onTap(ctx, p) {
    ctx.actions.toggleCell(p.cell);
  },

  onLongPress(ctx, p) {
    ctx.actions.openCellDetail(p.cell);
  },

  onDrag(ctx, from, to) {
    ctx.transient.setDragRect([
      Math.min(from.img.x, to.img.x),
      Math.min(from.img.y, to.img.y),
      Math.max(from.img.x, to.img.x),
      Math.max(from.img.y, to.img.y),
    ]);
  },

  onDragEnd(ctx, from, to) {
    ctx.transient.setDragRect(null);
    ctx.actions.selectRect(
      [
        Math.min(from.img.x, to.img.x),
        Math.min(from.img.y, to.img.y),
        Math.max(from.img.x, to.img.x),
        Math.max(from.img.y, to.img.y),
      ],
      true,
    );
  },

  onDeactivate(ctx) {
    ctx.transient.setDragRect(null);
  },
};
