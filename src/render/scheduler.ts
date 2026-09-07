/**
 * rAF 批次重繪。呼叫端只 request 需要重畫的圖層，實際 draw 在下一個動畫影格
 * 合併執行一次。
 *
 * 三層：
 *  - base        規劃分區底色 + 底圖圖片（很少變）
 *  - content     格線 / 實際分類 / band / 邊界 / 標籤 / 牆（文件編輯時變）
 *  - interaction 選取 / 拖曳框 / 幽靈切線 / 端點把手 / 高亮（互動時每幀變，但便宜）
 */
export type Layer = "base" | "content" | "interaction";
export const ALL_LAYERS: Layer[] = ["base", "content", "interaction"];

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
    this.request(...ALL_LAYERS);
  }

  /** 立即同步重繪（視窗 resize、匯出前、pan/zoom 結束）。 */
  flushNow(layers: Layer[] = ALL_LAYERS): void {
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
