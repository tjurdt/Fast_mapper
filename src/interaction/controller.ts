/**
 * InteractionController —— 把手勢層接到「作用中工具」與 render engine。
 * 這裡是 render / store / tools 的交會點。
 */
import type { MapRenderer } from "../render/engine";
import type { MapGeometry } from "../core/geometry";
import { attachGestures, type GesturePoint } from "./gestures";
import { toolById } from "./tools/registry";
import type { ResolvedPoint, Tool, ToolContext } from "./tools/types";
import * as store from "../store";

export class InteractionController {
  private detach: () => void;
  private current: Tool;

  constructor(
    private readonly renderer: MapRenderer,
    private readonly stageParent: HTMLElement,
  ) {
    this.current = toolById(store.activeToolId.value);
    this.detach = attachGestures(stageParent, {
      onTap: (p) => this.withCtx((ctx) => this.tool().onTap?.(ctx, this.resolve(p, ctx))),
      onLongPress: (p) => this.withCtx((ctx) => this.tool().onLongPress?.(ctx, this.resolve(p, ctx))),
      onDragStart: (p) => this.withCtx((ctx) => this.tool().onDragStart?.(ctx, this.resolve(p, ctx))),
      onDrag: (from, to) =>
        this.withCtx((ctx) => this.tool().onDrag?.(ctx, this.resolve(from, ctx), this.resolve(to, ctx))),
      onDragEnd: (from, to) =>
        this.withCtx((ctx) => this.tool().onDragEnd?.(ctx, this.resolve(from, ctx), this.resolve(to, ctx))),
      onPan: (dx, dy) => {
        const { w, h } = this.size();
        this.renderer.viewport.panBy(dx, dy, w, h);
        this.renderer.applyLiveTransform();
      },
      onPinch: (prev, cur) => {
        const { w, h } = this.size();
        this.renderer.viewport.pinch(
          { d: prev.d, mx: prev.cx, my: prev.cy },
          { d: cur.d, mx: cur.cx, my: cur.cy },
          w,
          h,
        );
        this.renderer.applyLiveTransform();
      },
      onWheelZoom: (p, factor) => {
        const { w, h } = this.size();
        this.renderer.viewport.scaleBy(factor, p.x, p.y, w, h);
        this.renderer.applyLiveTransform();
      },
      onGestureEnd: () => {
        /* applyLiveTransform 已排程重新光柵化；scene 變更由 main effect 觸發 */
      },
    });
  }

  private size(): { w: number; h: number } {
    return { w: this.stageParent.clientWidth, h: this.stageParent.clientHeight };
  }

  private tool(): Tool {
    const want = toolById(store.activeToolId.value);
    if (want !== this.current) {
      this.withCtx((ctx) => this.current.onDeactivate?.(ctx));
      this.current = want;
      this.withCtx((ctx) => this.current.onActivate?.(ctx));
    }
    return this.current;
  }

  private withCtx(fn: (ctx: ToolContext) => void): void {
    const geo = store.geometry.value;
    const p = store.project.value;
    if (!geo || !p) return;
    fn({
      geo,
      view: p.view,
      selection: store.selection.value,
      editingCutId: store.editingCutId.value,
      activeFeatureId: store.activeFeatureId.value,
      pasteMode: store.pasteMode.value,
      resolve: (gp) => this.resolveRaw(gp, geo, p.view.view),
      hitTolerance: () => {
        const k = this.renderer.viewport.viewK() || 1;
        return Math.max(Math.max(geo.cw, geo.ch) * 0.6, 26 / k);
      },
      actions: this.actions,
      transient: this.transient,
    });
  }

  private resolve(gp: GesturePoint, ctx: ToolContext): ResolvedPoint {
    return this.resolveRaw(gp, ctx.geo, ctx.view.view);
  }

  private resolveRaw(gp: GesturePoint, geo: MapGeometry, view: "actual" | "plan"): ResolvedPoint {
    const img = this.renderer.viewport.toImage(gp.x, gp.y);
    return {
      stage: gp,
      img,
      cell: geo.cellAtPoint(img.x, img.y, view),
      vertex: this.renderer.viewport.toGridVertex(gp.x, gp.y, geo.cw, geo.ch, geo.gridW, geo.gridH),
    };
  }

  private readonly actions: ToolContext["actions"] = {
    toggleCell: (k) => store.toggleCell(k),
    setSelection: (keys) => store.setSelection(keys),
    selectRect: (rect, add) => store.selectRect(rect, add),
    clearSelection: () => store.clearSelection(),
    eraseSelection: () => store.eraseSelection(),
    inspectFeature: (id) => store.inspectFeature(id),
    revealInList: (id) => store.revealFeatureInList(id),
    addWall: (seg) => store.addWallSegment(seg),
    beginEditCut: (id) => store.beginEditCut(id),
    moveCutEndpoint: (id, end, x, y) => store.moveCutEndpointTo(id, end, x, y),
    selectEnclosed: (x, y) => store.selectEnclosed(x, y),
    focusFeature: (id) => store.uiEvents.emit("focus-feature", id),
    toggleCutSelected: (id) => store.toggleCutSelected(id),
    selectWholeFeature: (id, add) => store.selectWholeFeature(id, add),
    pickObjectGroup: (seed, add, toggle) => store.pickObjectGroup(seed, add, toggle),
    objSelectRect: (rect, add) => store.objSelectRect(rect, add),
    setPasteAnchor: (cell) => {
      if (cell.charCodeAt(0) === 66) return; // band 格不當貼上錨點
      const i = cell.indexOf("_");
      store.setPasteAnchor([parseInt(cell.slice(0, i), 10), parseInt(cell.slice(i + 1), 10)]);
    },
    toast: (msg) => store.uiEvents.emit("toast", msg),
    openAssignSheet: () => store.uiEvents.emit("assign-sheet"),
    openCellDetail: (k) => store.uiEvents.emit("cell-detail", k),
  };

  private readonly transient: ToolContext["transient"] = {
    setDragRect: (r) => (store.dragRect.value = r),
    setGhostCut: (s) => (store.ghostCut.value = s),
  };

  dispose(): void {
    this.detach();
  }
}
