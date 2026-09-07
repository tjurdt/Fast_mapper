/**
 * MapRenderer —— 綁定 DOM canvas、Viewport、Scheduler 與 Scene。
 *
 * 沿用 legacy 的效能策略：
 *  - 兩張 canvas（base + overlay）疊在一個 stage 容器裡
 *  - pan/zoom 期間只改 stage 的 CSS transform（便宜），停手 ~110ms 後才以正確
 *    解析度重新光柵化
 */
import { Viewport } from "./viewport";
import { RenderScheduler, type Layer } from "./scheduler";
import { BaseImageLayer } from "./baseImage";
import { drawBaseLayer, drawOverlayLayer } from "./layers";
import { sceneDims, type Scene } from "./scene";

const RERASTER_DELAY = 110;
const MAX_DPR = 3;

export interface MapRendererOptions {
  /** 取得底圖 blob（persistence 層）。 */
  loadBlob?: (blobId: string) => Promise<Blob | null>;
}

export class MapRenderer {
  readonly viewport = new Viewport(1, 1);
  private readonly scheduler: RenderScheduler;
  private readonly baseImage = new BaseImageLayer();

  private bctx: CanvasRenderingContext2D;
  private octx: CanvasRenderingContext2D;
  private dpr = 1;
  private scene: Scene | null = null;
  private rendered = { tx: 0, ty: 0, s: 1 };
  private reraster = 0;
  private ro: ResizeObserver | null = null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly base: HTMLCanvasElement,
    private readonly overlay: HTMLCanvasElement,
    private readonly opts: MapRendererOptions = {},
  ) {
    this.bctx = must(base.getContext("2d"));
    this.octx = must(overlay.getContext("2d"));
    this.scheduler = new RenderScheduler((layers) => this.paint(layers));

    this.stage.style.transformOrigin = "0 0";
    if (typeof ResizeObserver === "function") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.stageParent());
    }
  }

  private stageParent(): HTMLElement {
    return (this.stage.parentElement as HTMLElement | null) ?? this.stage;
  }

  private stageSize(): { w: number; h: number } {
    const el = this.stageParent();
    return { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) };
  }

  async setScene(scene: Scene | null): Promise<void> {
    const prev = this.scene;
    this.scene = scene;
    if (scene) {
      const d = sceneDims(scene.geo);
      this.viewport.setImageSize(d.imgW, d.imgH);
      if (!prev || prev.doc.grid !== scene.doc.grid) this.fit();
      if (scene.doc.baseImage && this.opts.loadBlob) {
        await this.baseImage.load(await this.opts.loadBlob(scene.doc.baseImage.blobId));
      } else {
        await this.baseImage.load(null);
      }
    }
    this.scheduler.requestAll();
  }

  resize(): void {
    const { w, h } = this.stageSize();
    this.dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, MAX_DPR);
    for (const cv of [this.base, this.overlay]) {
      const cw = Math.round(w * this.dpr);
      const chh = Math.round(h * this.dpr);
      if (cv.width !== cw || cv.height !== chh) {
        cv.width = cw;
        cv.height = chh;
      }
      cv.style.width = w + "px";
      cv.style.height = h + "px";
    }
    this.viewport.fitBase(w);
    this.viewport.clampT(w, h);
    this.scheduler.flushNow();
  }

  fit(): void {
    const { w, h } = this.stageSize();
    this.dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, MAX_DPR);
    this.syncCanvasPixels(w, h);
    this.viewport.fit(w, h);
    this.scheduler.flushNow();
  }

  private syncCanvasPixels(w: number, h: number): void {
    for (const cv of [this.base, this.overlay]) {
      cv.width = Math.round(w * this.dpr);
      cv.height = Math.round(h * this.dpr);
      cv.style.width = w + "px";
      cv.style.height = h + "px";
    }
  }

  /** 手勢期間呼叫：只更新便宜的 CSS transform，並排程稍後重新光柵化。 */
  applyLiveTransform(): void {
    const { tx, ty, s } = this.viewport;
    const ratio = s / (this.rendered.s || 1);
    this.stage.style.transform = `translate(${tx - this.rendered.tx * ratio}px,${ty - this.rendered.ty * ratio}px) scale(${ratio})`;
    if (this.reraster) clearTimeout(this.reraster);
    this.reraster = window.setTimeout(() => {
      this.reraster = 0;
      this.scheduler.flushNow();
    }, RERASTER_DELAY);
  }

  private paint(layers: ReadonlySet<Layer>): void {
    if (this.reraster) {
      clearTimeout(this.reraster);
      this.reraster = 0;
    }
    if (!this.scene) {
      this.clear(this.bctx, this.base);
      this.clear(this.octx, this.overlay);
      this.stage.style.transform = "none";
      return;
    }
    const dims = sceneDims(this.scene.geo);
    if (layers.has("base")) {
      this.begin(this.bctx, this.base);
      drawBaseLayer(this.bctx, this.scene, dims);
      if (this.scene.doc.baseImage && this.baseImage.ready) {
        this.baseImage.draw(this.bctx, this.scene.doc.baseImage);
      }
    }
    if (layers.has("overlay")) {
      this.begin(this.octx, this.overlay);
      drawOverlayLayer(this.octx, this.scene, dims);
    }
    this.rendered = { ...this.viewport.transform };
    this.stage.style.transform = "none";
  }

  private begin(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement): void {
    const k = this.viewport.viewK() * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, this.viewport.tx * this.dpr, this.viewport.ty * this.dpr);
  }

  private clear(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
  }

  /** 排程一次重繪（scene 內容變了）。 */
  invalidate(...layers: Layer[]): void {
    if (layers.length) this.scheduler.request(...layers);
    else this.scheduler.requestAll();
  }

  dispose(): void {
    this.scheduler.dispose();
    this.baseImage.dispose();
    this.ro?.disconnect();
    if (this.reraster) clearTimeout(this.reraster);
  }
}

function must<T>(v: T | null): T {
  if (v === null) throw new Error("2D context unavailable");
  return v;
}
