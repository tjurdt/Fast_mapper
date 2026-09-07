/**
 * 切線 / 牆工具：
 *  - 拖曳空白處 → 畫一道牆
 *  - 點既有切線 → 進入編輯（顯示端點把手，下方跳出設定列）
 *  - 編輯中拖曳端點把手 → 即時預覽，放手才 commit（大地圖上不卡）
 *  - 點被牆圍住的空白 → 洪水框選整塊封閉區（邊界格自動斜切）
 */
import type { Tool } from "./types";

let dragMode: "wall" | "handle-a" | "handle-b" | null = null;
/** 端點拖曳期間固定的另一端（格為單位）。 */
let anchor: { x: number; y: number } | null = null;

export const cutTool: Tool = {
  id: "cut",
  labelKey: "tool.cut",
  hintKey: "hint.cut",

  onTap(ctx, p) {
    const near = ctx.geo.cutNear(p.img.x, p.img.y, ctx.hitTolerance());
    if (near) {
      ctx.actions.beginEditCut(near);
      return;
    }
    if (ctx.editingCutId) {
      ctx.actions.beginEditCut(null);
      return;
    }
    const r = ctx.actions.selectEnclosed(p.img.x, p.img.y);
    if (!r.ok && r.reason) ctx.actions.toast(r.reason);
  },

  onDragStart(ctx, from) {
    dragMode = "wall";
    anchor = null;
    if (ctx.editingCutId) {
      const end = ctx.geo.cutHandleNear(ctx.editingCutId, from.img.x, from.img.y, ctx.hitTolerance() * 1.4);
      const g = ctx.geo.cutGeom(ctx.editingCutId);
      if (end && g) {
        dragMode = end === "a" ? "handle-a" : "handle-b";
        anchor =
          end === "a"
            ? { x: g.bx / ctx.geo.cw, y: g.by / ctx.geo.ch }
            : { x: g.ax / ctx.geo.cw, y: g.ay / ctx.geo.ch };
      }
    }
  },

  onDrag(ctx, from, to) {
    if ((dragMode === "handle-a" || dragMode === "handle-b") && anchor) {
      // 只更新即時預覽線，不動文件
      ctx.transient.setCutDragPreview(
        dragMode === "handle-a"
          ? [to.vertex.x, to.vertex.y, anchor.x, anchor.y]
          : [anchor.x, anchor.y, to.vertex.x, to.vertex.y],
      );
      return;
    }
    ctx.transient.setGhostCut([from.vertex.x, from.vertex.y, to.vertex.x, to.vertex.y]);
  },

  onDragEnd(ctx, from, to) {
    const mode = dragMode;
    dragMode = null;
    anchor = null;
    ctx.transient.setGhostCut(null);
    ctx.transient.setCutDragPreview(null);

    if ((mode === "handle-a" || mode === "handle-b") && ctx.editingCutId) {
      if (to.vertex.x !== from.vertex.x || to.vertex.y !== from.vertex.y) {
        ctx.actions.moveCutEndpoint(
          ctx.editingCutId,
          mode === "handle-a" ? "a" : "b",
          to.vertex.x,
          to.vertex.y,
        );
      }
      return;
    }

    if (mode !== "wall") return;
    if (from.vertex.x === to.vertex.x && from.vertex.y === to.vertex.y) return;
    const id = ctx.actions.addWall({
      ax: from.vertex.x,
      ay: from.vertex.y,
      bx: to.vertex.x,
      by: to.vertex.y,
    });
    if (id) ctx.actions.beginEditCut(id); // 畫完自動選取新線條、開啟設定列
  },

  onDeactivate(ctx) {
    dragMode = null;
    anchor = null;
    ctx.transient.setGhostCut(null);
    ctx.transient.setCutDragPreview(null);
    ctx.actions.beginEditCut(null);
  },
};
