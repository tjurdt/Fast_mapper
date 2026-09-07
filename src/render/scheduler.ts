/**
 * rAF 批次重繪。元件 / store 只呼叫 request*()，實際 draw 在下一個動畫影格
 * 合併執行一次。
 */
export type Layer = "base" | "overlay";

export class RenderScheduler {
  private raf = 0;
  private pending = new Set<Layer>();

  constructor(private readonly flush: (layers: ReadonlySet<Layer>) => void) {}

  request(...layers: Layer[]): void {
    for (const l of layers) this.pending.add(l);
    if (this.raf) return;
    const run = () => {
      this.raf = 0;
      const batch = this.pending;
      this.pending = new Set();
      if (batch.size) this.flush(batch);
    };
    this.raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(run)
        : (setTimeout(run, 16) as unknown as number);
  }

  requestAll(): void {
    this.request("base", "overlay");
  }

  /** 立即同步重繪（例如視窗 resize、匯出前）。 */
  flushNow(layers: Layer[] = ["base", "overlay"]): void {
    if (this.raf) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.raf);
      else clearTimeout(this.raf);
      this.raf = 0;
    }
    this.pending.clear();
    this.flush(new Set(layers));
  }

  dispose(): void {
    if (this.raf) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.raf);
      else clearTimeout(this.raf);
      this.raf = 0;
    }
    this.pending.clear();
  }
}
