/** 切線 / 牆工具：拖曳畫牆，點擊靠近既有切線則編輯它。 */
import type { Tool } from "./types";

export const cutTool: Tool = {
  id: "cut",
  labelKey: "tool.cut",

  onTap(ctx, p) {
    const near = ctx.geo.cutNear(p.img.x, p.img.y, ctx.hitTolerance());
    if (near) ctx.actions.beginEditCut(near);
    else ctx.actions.beginEditCut(null);
  },

  onDrag(ctx, from, to) {
    ctx.transient.setGhostCut([from.vertex.x, from.vertex.y, to.vertex.x, to.vertex.y]);
  },

  onDragEnd(ctx, from, to) {
    ctx.transient.setGhostCut(null);
    if (from.vertex.x === to.vertex.x && from.vertex.y === to.vertex.y) return;
    ctx.actions.addWall({ ax: from.vertex.x, ay: from.vertex.y, bx: to.vertex.x, by: to.vertex.y });
  },

  onDeactivate(ctx) {
    ctx.transient.setGhostCut(null);
    ctx.actions.beginEditCut(null);
  },
};
