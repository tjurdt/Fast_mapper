/** 檢視工具（legacy 的 view 模式）：點格看它屬於哪個命名區域；拖曳 = 平移。 */
import type { Tool } from "./types";

export const inspectTool: Tool = {
  id: "inspect",
  labelKey: "tool.inspect",

  onTap(ctx, p) {
    const id =
      ctx.geo.regularFeatureAtPoint(p.img.x, p.img.y) ?? ctx.geo.bandFeatureAtPoint(p.img.x, p.img.y);
    ctx.actions.inspectFeature(id ?? null);
  },

  onLongPress(ctx, p) {
    ctx.actions.openCellDetail(p.cell);
  },

  onDeactivate(ctx) {
    ctx.actions.inspectFeature(null);
  },
};
