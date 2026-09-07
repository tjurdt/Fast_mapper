/**
 * 檢視工具：點店家 → 右側自動切到「清單」分頁並篩出該店家（手機會順便展開面板）；
 * 點空白處 / 切換工具會把面板收回。
 */
import type { Tool } from "./types";

export const inspectTool: Tool = {
  id: "inspect",
  labelKey: "tool.inspect",
  hintKey: "hint.inspect",

  onTap(ctx, p) {
    const id =
      ctx.geo.regularFeatureAtPoint(p.img.x, p.img.y) ?? ctx.geo.bandFeatureAtPoint(p.img.x, p.img.y);
    ctx.actions.revealInList(id ?? null);
  },

  onLongPress(ctx, p) {
    ctx.actions.openCellDetail(p.cell);
  },

  onDeactivate(ctx) {
    ctx.actions.revealInList(null);
  },
};
