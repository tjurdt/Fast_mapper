/**
 * Pan / zoom 變換。純數學，不碰 DOM —— 呼叫端傳入舞台像素尺寸與舞台相對座標。
 * 移植自 legacy：viewK / fitBase / clampT / fit / zoomAt。
 */
import { clamp } from "../core/poly";

const MIN_SCALE = 0.4;
const MAX_SCALE = 16;
const PAD = 60;

export interface ViewTransform {
  tx: number;
  ty: number;
  s: number;
}

export class Viewport {
  imgW: number;
  imgH: number;
  baseW = 0;
  baseH = 0;
  tx = 0;
  ty = 0;
  s = 1;

  constructor(imgW: number, imgH: number) {
    this.imgW = Math.max(1, imgW);
    this.imgH = Math.max(1, imgH);
  }

  setImageSize(w: number, h: number): void {
    this.imgW = Math.max(1, w);
    this.imgH = Math.max(1, h);
  }

  /** 影像單位 → CSS 像素的比例。 */
  viewK(): number {
    return (this.baseW * this.s) / this.imgW;
  }

  get transform(): ViewTransform {
    return { tx: this.tx, ty: this.ty, s: this.s };
  }

  /** 依舞台寬度決定 base 尺寸（維持影像長寬比）。 */
  fitBase(stageW: number): void {
    this.baseW = Math.max(1, stageW);
    this.baseH = (this.baseW * this.imgH) / this.imgW;
  }

  clampT(stageW: number, stageH: number): void {
    const cwd = this.baseW * this.s;
    const chd = this.baseH * this.s;
    this.tx =
      cwd <= stageW ? clamp(this.tx, -PAD, stageW - cwd + PAD) : clamp(this.tx, stageW - cwd - PAD, PAD);
    this.ty =
      chd <= stageH ? clamp(this.ty, -PAD, stageH - chd + PAD) : clamp(this.ty, stageH - chd - PAD, PAD);
  }

  /** 重設為「置中、1x」。 */
  fit(stageW: number, stageH: number): void {
    this.fitBase(stageW);
    this.s = 1;
    this.tx = 0;
    this.ty = (stageH - this.baseH) / 2;
    this.clampT(stageW, stageH);
  }

  /** 以舞台相對座標 (px,py) 為錨點縮放到 ns。 */
  zoomAt(px: number, py: number, ns: number, stageW: number, stageH: number): void {
    const next = clamp(ns, MIN_SCALE, MAX_SCALE);
    const contentX = (px - this.tx) / this.s;
    const contentY = (py - this.ty) / this.s;
    this.s = next;
    this.tx = px - contentX * this.s;
    this.ty = py - contentY * this.s;
    this.clampT(stageW, stageH);
  }

  scaleBy(factor: number, px: number, py: number, stageW: number, stageH: number): void {
    this.zoomAt(px, py, this.s * factor, stageW, stageH);
  }

  panBy(dx: number, dy: number, stageW: number, stageH: number): void {
    this.tx += dx;
    this.ty += dy;
    this.clampT(stageW, stageH);
  }

  /** 雙指縮放：d/mid 為當前值，prev 為上一幀。 */
  pinch(
    prev: { d: number; mx: number; my: number },
    cur: { d: number; mx: number; my: number },
    stageW: number,
    stageH: number,
  ): void {
    const contentX = (prev.mx - this.tx) / this.s;
    const contentY = (prev.my - this.ty) / this.s;
    this.s = clamp(this.s * (cur.d / (prev.d || 1)), MIN_SCALE, MAX_SCALE);
    this.tx = cur.mx - contentX * this.s;
    this.ty = cur.my - contentY * this.s;
    this.clampT(stageW, stageH);
  }

  /** 舞台相對座標 → 影像單位座標。 */
  toImage(px: number, py: number): { x: number; y: number } {
    const k = this.viewK() || 1;
    return { x: (px - this.tx) / k, y: (py - this.ty) / k };
  }

  /** 舞台相對座標 → 最近的格線交點（格為單位）。 */
  toGridVertex(
    px: number,
    py: number,
    cw: number,
    ch: number,
    gridW: number,
    gridH: number,
  ): { x: number; y: number } {
    const p = this.toImage(px, py);
    return {
      x: clamp(Math.round(p.x / cw), 0, gridW),
      y: clamp(Math.round(p.y / ch), 0, gridH),
    };
  }
}
