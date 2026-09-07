/** 檢視工具：點格看它屬於哪個命名區域（清單也會標記）；拖曳 = 平移。 */
import type { Tool } from "./types";

export const inspectTool: Tool = {
  id: "inspect",
  labelKey: "tool.inspect",
  hintKey: "hint.inspect",

  onTap(ctx, p) {
    const id =
      ctx.geo.regularFeatureAtPoint(p.img.x, p.img.y) ?? ctx.geo.bandFeatureAtPoint(p.img.x, p.img.y);
    ctx.actions.inspectFeature(id ?? null);
    if (id) ctx.actions.focusFeature(id);
  },

  onLongPress(ctx, p) {
    ctx.actions.openCellDetail(p.cell);
  },

  onDeactivate(ctx) {
    ctx.actions.inspectFeature(null);
  },
};
