/**
 * 底圖圖片層 —— 匯入的平面圖 / 照片，畫在最底層供描繪。
 * blob 由 persistence 層管理；這裡只負責解碼與依 transform 繪製。
 */
import type { BaseImageSpec } from "../core/types";

export class BaseImageLayer {
  private bitmap: ImageBitmap | HTMLImageElement | null = null;
  private objectUrl: string | null = null;
  private loadedBlob: Blob | null = null;

  get ready(): boolean {
    return !!this.bitmap;
  }

  /** 載入（或清除）底圖。相同 blob 不重覆解碼。 */
  async load(blob: Blob | null): Promise<void> {
    if (blob === this.loadedBlob) return;
    this.dispose();
    this.loadedBlob = blob;
    if (!blob) return;

    if (typeof createImageBitmap === "function") {
      this.bitmap = await createImageBitmap(blob);
      return;
    }
    // 後備：HTMLImageElement
    const url = URL.createObjectURL(blob);
    this.objectUrl = url;
    this.bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /** 在影像單位空間繪製（ctx 變換已設好）。 */
  draw(ctx: CanvasRenderingContext2D, spec: BaseImageSpec): void {
    const bmp = this.bitmap;
    if (!bmp) return;
    const w = "width" in bmp ? bmp.width : 0;
    const h = "height" in bmp ? bmp.height : 0;
    if (!w || !h) return;

    const { x, y, scale, rotation } = spec.transform;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, spec.opacity));
    ctx.translate(x + (w * scale) / 2, y + (h * scale) / 2);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bmp, (-w * scale) / 2, (-h * scale) / 2, w * scale, h * scale);
    ctx.restore();
  }

  dispose(): void {
    if (this.bitmap && "close" in this.bitmap) this.bitmap.close();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.bitmap = null;
    this.objectUrl = null;
    this.loadedBlob = null;
  }
}
