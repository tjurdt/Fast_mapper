import { describe, expect, it } from "vitest";
import { Viewport } from "../src/render/viewport";

describe("Viewport", () => {
  it("fit 置中且 scale=1", () => {
    const vp = new Viewport(1400, 700); // 2:1
    vp.fit(700, 700);
    expect(vp.s).toBe(1);
    expect(vp.baseW).toBe(700);
    expect(vp.baseH).toBe(350);
    expect(vp.ty).toBeCloseTo(175); // (700-350)/2
  });

  it("viewK 為影像單位→CSS 像素比", () => {
    const vp = new Viewport(1400, 700);
    vp.fit(700, 700);
    expect(vp.viewK()).toBeCloseTo(0.5); // 700 baseW / 1400 imgW
  });

  it("zoomAt 錨點內容座標不變", () => {
    const vp = new Viewport(1000, 1000);
    vp.fit(500, 500);
    const before = vp.toImage(120, 300);
    vp.zoomAt(120, 300, 3, 500, 500);
    const after = vp.toImage(120, 300);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it("scale 夾在 [0.4, 16]", () => {
    const vp = new Viewport(1000, 1000);
    vp.fit(500, 500);
    vp.zoomAt(250, 250, 999, 500, 500);
    expect(vp.s).toBe(16);
    vp.zoomAt(250, 250, 0.001, 500, 500);
    expect(vp.s).toBe(0.4);
  });

  it("toGridVertex 吸附到最近格線交點", () => {
    const vp = new Viewport(140, 140); // 10 格 × 14px
    vp.fit(140, 140); // viewK = 1
    expect(vp.toGridVertex(41, 41, 14, 14, 10, 10)).toEqual({ x: 3, y: 3 });
    expect(vp.toGridVertex(6, 6, 14, 14, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});
