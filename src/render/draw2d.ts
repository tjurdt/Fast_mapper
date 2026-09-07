/** 低階 canvas 繪圖工具。移植自 legacy：hexA / cellPath / fillPoly / fillQuad。 */
import type { CellPoly, HexColor, Point } from "../core/types";

/** `#rgb` / `#rrggbb` + alpha → `rgba(...)`。 */
export function hexA(hex: HexColor, a: number): string {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((x) => x + x)
          .join("")
      : h;
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
}

export function polyPath(
  ctx: CanvasRenderingContext2D,
  r: number,
  c: number,
  poly: CellPoly,
  cw: number,
  ch: number,
): void {
  ctx.beginPath();
  poly.forEach((p, i) => {
    const x = (c + p[0]) * cw;
    const y = (r + p[1]) * ch;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
}

export function fillCellPoly(
  ctx: CanvasRenderingContext2D,
  r: number,
  c: number,
  poly: CellPoly | null,
  cw: number,
  ch: number,
  color: string,
): void {
  if (!poly) {
    ctx.fillStyle = color;
    ctx.fillRect(c * cw, r * ch, cw + 0.6, ch + 0.6);
    return;
  }
  if (poly.length < 3) return;
  ctx.fillStyle = color;
  polyPath(ctx, r, c, poly, cw, ch);
  ctx.fill();
}

export function fillQuad(ctx: CanvasRenderingContext2D, q: Point[] | null, color: string): void {
  if (!q) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  q.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
  ctx.closePath();
  ctx.fill();
}

export function strokeQuad(ctx: CanvasRenderingContext2D, q: Point[] | null): void {
  if (!q) return;
  ctx.beginPath();
  q.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
  ctx.closePath();
  ctx.stroke();
}

/** 用 even-odd 規則把後續繪圖裁切到「這些四邊形之外」（legacy clipOutsideQuads）。 */
export function clipOutsideQuads(
  ctx: CanvasRenderingContext2D,
  quads: Point[][],
  imgW: number,
  imgH: number,
): void {
  for (const q of quads) {
    ctx.beginPath();
    ctx.rect(0, 0, imgW, imgH);
    q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.clip("evenodd");
  }
}
