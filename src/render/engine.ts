/**
 * MapRenderer —— 綁定三張 DOM canvas、Viewport、Scheduler 與 Scene。
 *
 * 效能策略（對齊 legacy 單檔版的順暢感）：
 *  - 三張 canvas 都畫成「整張影像大小」，疊在 `.stage` 容器裡，只光柵化一次
 *  - pan / zoom / 聚焦：**只改 `.stage` 的 CSS transform**，完全不重新光柵化
 *  - 只有文件內容改變才重畫 base / content；互動層（選取框等）便宜、每次互動重畫
 *  - backing store 尺寸受 4096 上限保護（iOS Safari），必要時降解析度
 */
import { Viewport } from "./viewport";
import { RenderScheduler, ALL_LAYERS, type Layer } from "./scheduler";
import { BaseImageLayer } from "./baseImage";
import { drawBaseLayer, drawContentLayer, drawInteractionLayer } from "./layers";
import { sceneDims, type Scene } from "./scene";

const MAX_DPR = 2;
const MAX_BACKING = 4096; // 單邊像素上限（iOS Safari 安全值）

export interface MapRendererOptions {
  loadBlob?: (blobId: string) => Promise<Blob | null>;
}

export class MapRenderer {
  readonly viewport = new Viewport(1, 1);
  private readonly scheduler: RenderScheduler;
  private readonly baseImage = new BaseImageLayer();
  private readonly ctx: Record<Layer, CanvasRenderingContext2D>;
  private readonly canvas: Record<Layer, HTMLCanvasElement>;

  /** backing store 相對影像單位的縮放（HiDPI，受上限保護）。 */
  private q = 1;
  private imgW = 1;
  private imgH = 1;
  private scene: Scene | null = null;
  private prevBlobId: string | null = null;
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
    const imgSizeChanged = d.imgW !== this.imgW || d.imgH !== this.imgH;
    if (imgSizeChanged) this.syncCanvasPixels(d.imgW, d.imgH);

    const first = !prev;
    const docChanged = first || prev.doc !== scene.doc;
    const viewChanged = first || prev.view !== scene.view;

    // 底圖圖片
    const blobId = scene.doc.baseImage?.blobId ?? null;
    let imageChanged = false;
    if (blobId !== this.prevBlobId) {
      this.prevBlobId = blobId;
      imageChanged = true;
      if (blobId && this.opts.loadBlob) await this.baseImage.load(await this.opts.loadBlob(blobId));
      else await this.baseImage.load(null);
    }

    if (first || imgSizeChanged) {
      this.viewport.fit(this.stageSize().w, this.stageSize().h);
      this.applyViewTransform();
      this.scheduler.request(...ALL_LAYERS); // 首次 / 影像尺寸改變 → 全部重畫
      return;
    }

    const dirty: Layer[] = ["interaction"];
    if (docChanged || imageChanged) dirty.push("base");
    if (docChanged || viewChanged) dirty.push("content");
    this.scheduler.request(...dirty);
    this.applyViewTransform();
  }

  /** 視窗 / 容器尺寸改變：只更新視角變換，canvas 不動、不重新光柵化。 */
  resize(): void {
    const { w, h } = this.stageSize();
    this.viewport.fitBase(w);
    this.viewport.clampT(w, h);
    this.applyViewTransform();
  }

  /** 重設為「置中、全覽」。內容解析度與視角無關，只需移動 `.stage`。 */
  fit(): void {
    const { w, h } = this.stageSize();
    this.viewport.fit(w, h);
    this.applyViewTransform();
  }

  /** 把影像座標矩形框進視野（點清單項目 → 聚焦某個命名區域）。只移動 `.stage`。 */
  frameRegion(x0: number, y0: number, x1: number, y1: number, padImg = 0): void {
    const { w, h } = this.stageSize();
    const vp = this.viewport;
    vp.fitBase(w);
    const rw = Math.max(vp.imgW / 40, x1 - x0 + padImg * 2);
    const rh = Math.max(vp.imgH / 40, y1 - y0 + padImg * 2);
    const targetK = Math.min((w * 0.85) / rw, (h * 0.8) / rh);
    vp.s = Math.max(0.4, Math.min(16, (targetK * vp.imgW) / w));
    const vk = vp.viewK();
    vp.tx = w / 2 - ((x0 + x1) / 2) * vk;
    vp.ty = h / 2 - ((y0 + y1) / 2) * vk;
    vp.clampT(w, h);
    this.applyViewTransform();
  }

  private syncCanvasPixels(imgW: number, imgH: number): void {
    this.imgW = imgW;
    this.imgH = imgH;
    const dpr = Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, MAX_DPR);
    this.q = Math.min(dpr, MAX_BACKING / Math.max(imgW, imgH));
    const pw = Math.round(imgW * this.q);
    const ph = Math.round(imgH * this.q);
    for (const l of ALL_LAYERS) {
      const cv = this.canvas[l];
      if (cv.width !== pw || cv.height !== ph) {
        cv.width = pw;
        cv.height = ph;
      }
      cv.style.width = imgW + "px";
      cv.style.height = imgH + "px";
    }
  }

  /** `.stage` 的 CSS transform：影像座標 → 螢幕座標。pan/zoom 期間唯一要做的事。 */
  applyViewTransform(): void {
    const { tx, ty } = this.viewport;
    const k = this.viewport.viewK();
    this.stage.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
    this.stage.dataset.vp = `${this.viewport.s.toFixed(3)},${Math.round(tx)},${Math.round(ty)}`;
  }

  /** 舊名沿用：手勢期間呼叫，只更新變換。 */
  applyLiveTransform(): void {
    this.applyViewTransform();
  }

  private paint(layers: ReadonlySet<Layer>): void {
    if (!this.scene) {
      for (const l of ALL_LAYERS) this.clear(l);
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
    this.applyViewTransform();
  }

  private begin(l: Layer): void {
    const ctx = this.ctx[l];
    const cv = this.canvas[l];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(this.q, 0, 0, this.q, 0, 0);
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
  }
}

function must<T>(v: T | null): T {
  if (v === null) throw new Error("2D context unavailable");
  return v;
}
