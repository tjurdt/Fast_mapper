/**
 * MapRenderer —— 綁定三張 DOM canvas、Viewport、Scheduler 與 Scene。
 *
 * 效能策略：
 *  - 三張 canvas（base / content / interaction）疊在一個 stage 容器裡
 *  - setScene 比對前後 scene，只重畫真正變動的圖層。互動（選取 / 拖曳框）只重畫
 *    最上層便宜的 interaction；文件編輯才重畫 content；規劃分區改了才重畫 base
 *  - pan/zoom 期間只改 stage 的 CSS transform，停手 ~110ms 後才重新光柵化
 *  - **只有 fit() / frameRegion() 會改變縮放**；resize 保留目前視角
 */
import { Viewport } from "./viewport";
import { RenderScheduler, ALL_LAYERS, type Layer } from "./scheduler";
import { BaseImageLayer } from "./baseImage";
import { drawBaseLayer, drawContentLayer, drawInteractionLayer } from "./layers";
import { sceneDims, type Scene } from "./scene";

const RERASTER_DELAY = 110;
const MAX_DPR = 2;

export interface MapRendererOptions {
  loadBlob?: (blobId: string) => Promise<Blob | null>;
}

export class MapRenderer {
  readonly viewport = new Viewport(1, 1);
  private readonly scheduler: RenderScheduler;
  private readonly baseImage = new BaseImageLayer();
  private readonly ctx: Record<Layer, CanvasRenderingContext2D>;
  private readonly canvas: Record<Layer, HTMLCanvasElement>;

  private dpr = 1;
  private scene: Scene | null = null;
  private prevBlobId: string | null = null;
  private rendered = { tx: 0, ty: 0, s: 1 };
  private reraster = 0;
  private ro: ResizeObserver | null = null;

  constructor(
    private readonly stage: HTMLElement,
    base: HTMLCanvasElement,
    content: HTMLCanvasElement,
    interaction: HTMLCanvasElement,
    private readonly opts: MapRendererOptions = {},
  ) {
    this.canvas = { base, content, interaction };
    this.ctx = {
      base: must(base.getContext("2d")),
      content: must(content.getContext("2d")),
      interaction: must(interaction.getContext("2d")),
    };
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
    if (!scene) {
      this.scheduler.requestAll();
      return;
    }

    const d = sceneDims(scene.geo);
    this.viewport.setImageSize(d.imgW, d.imgH);

    const gridChanged =
      !prev ||
      prev.doc.grid.w !== scene.doc.grid.w ||
      prev.doc.grid.h !== scene.doc.grid.h ||
      prev.doc.grid.cellPx !== scene.doc.grid.cellPx;
    const docChanged = !prev || prev.doc !== scene.doc;
    const viewChanged = !prev || prev.view !== scene.view;

    // 底圖圖片
    const blobId = scene.doc.baseImage?.blobId ?? null;
    let imageChanged = false;
    if (blobId !== this.prevBlobId) {
      this.prevBlobId = blobId;
      imageChanged = true;
      if (blobId && this.opts.loadBlob) await this.baseImage.load(await this.opts.loadBlob(blobId));
      else await this.baseImage.load(null);
    }

    if (gridChanged) {
      this.fit(); // 只有這裡（首次 / 網格尺寸改變）會自動改縮放
      return;
    }

    const dirty: Layer[] = ["interaction"];
    if (docChanged || imageChanged) dirty.push("base");
    if (docChanged || viewChanged) dirty.push("content");
    this.scheduler.request(...dirty);
  }

  /** 視窗 / 容器尺寸改變：重設 canvas 像素，**保留目前視角**。 */
  resize(): void {
    const { w, h } = this.stageSize();
    this.dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, MAX_DPR);
    this.syncCanvasPixels(w, h);
    this.viewport.fitBase(w);
    this.viewport.clampT(w, h);
    this.scheduler.flushNow();
  }

  /** 重設為「置中、全覽」。只由縮放堆疊的全覽鈕 / 首次載入呼叫。 */
  fit(): void {
    const { w, h } = this.stageSize();
    this.dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, MAX_DPR);
    this.syncCanvasPixels(w, h);
    this.viewport.fit(w, h);
    this.scheduler.flushNow();
  }

  /** 把影像座標矩形框進視野（點清單項目 → 聚焦某個命名區域）。 */
  frameRegion(x0: number, y0: number, x1: number, y1: number, padImg = 0): void {
    const { w, h } = this.stageSize();
    this.dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, MAX_DPR);
    this.syncCanvasPixels(w, h);
    const vp = this.viewport;
    vp.fitBase(w); // baseW = w
    const rw = Math.max(vp.imgW / 40, x1 - x0 + padImg * 2);
    const rh = Math.max(vp.imgH / 40, y1 - y0 + padImg * 2);
    // viewK = baseW*s/imgW，baseW=w → 目標 viewK 讓 rw 影像單位 ≈ 0.85 螢幕
    const targetK = Math.min((w * 0.85) / rw, (h * 0.8) / rh);
    vp.s = Math.max(0.4, Math.min(16, (targetK * vp.imgW) / w));
    const vk = vp.viewK();
    vp.tx = w / 2 - ((x0 + x1) / 2) * vk;
    vp.ty = h / 2 - ((y0 + y1) / 2) * vk;
    vp.clampT(w, h);
    this.scheduler.flushNow();
  }

  private syncCanvasPixels(w: number, h: number): void {
    for (const l of ALL_LAYERS) {
      const cv = this.canvas[l];
      const pw = Math.round(w * this.dpr);
      const ph = Math.round(h * this.dpr);
      if (cv.width !== pw || cv.height !== ph) {
        cv.width = pw;
        cv.height = ph;
      }
      cv.style.width = w + "px";
      cv.style.height = h + "px";
    }
  }

  /** 手勢期間：只更新 CSS transform，排程稍後重新光柵化。 */
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
      for (const l of ALL_LAYERS) this.clear(l);
      this.stage.style.transform = "none";
      return;
    }
    const dims = sceneDims(this.scene.geo);
    if (layers.has("base")) {
      this.begin("base");
      drawBaseLayer(this.ctx.base, this.scene, dims);
      if (this.scene.doc.baseImage && this.baseImage.ready) {
        this.baseImage.draw(this.ctx.base, this.scene.doc.baseImage);
      }
    }
    if (layers.has("content")) {
      this.begin("content");
      drawContentLayer(this.ctx.content, this.scene, dims);
    }
    if (layers.has("interaction")) {
      this.begin("interaction");
      drawInteractionLayer(this.ctx.interaction, this.scene, dims);
    }
    this.rendered = { ...this.viewport.transform };
    this.stage.style.transform = "none";
    const { s, tx, ty } = this.viewport;
    this.stage.dataset.vp = `${s.toFixed(3)},${Math.round(tx)},${Math.round(ty)}`;
  }

  private begin(l: Layer): void {
    const ctx = this.ctx[l];
    const cv = this.canvas[l];
    const k = this.viewport.viewK() * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, this.viewport.tx * this.dpr, this.viewport.ty * this.dpr);
  }

  private clear(l: Layer): void {
    const ctx = this.ctx[l];
    const cv = this.canvas[l];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
  }

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
