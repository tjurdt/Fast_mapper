import { describe, expect, it } from "vitest";
import { crc32, buildZip, utf8 } from "../src/export/zip";
import { colName, buildXlsx } from "../src/export/xlsx";
import { buildPdf } from "../src/export/pdf";
import { wrapText, computeLayout } from "../src/export/layout";
import { buildSvg } from "../src/export/svg";
import { buildRows } from "../src/export/rows";
import { normalizeOptions } from "../src/export/types";
import { MapGeometry } from "../src/core/geometry";
import { assignCells } from "../src/model/edits";
import { makeDoc } from "./helpers";

describe("zip", () => {
  it("crc32 已知向量", () => {
    expect(crc32(utf8("123456789"))).toBe(0xcbf43926);
  });
  it("buildZip 以 PK 開頭且含中央目錄簽章", () => {
    const z = buildZip([{ name: "a.txt", data: utf8("hi") }]);
    expect([z[0], z[1]]).toEqual([0x50, 0x4b]);
    // EOCD 簽章 PK\x05\x06 出現在尾端
    expect(z.slice(-22, -18)).toEqual(new Uint8Array([0x50, 0x4b, 0x05, 0x06]));
  });
});

describe("xlsx", () => {
  it("colName", () => {
    expect(colName(0)).toBe("A");
    expect(colName(25)).toBe("Z");
    expect(colName(26)).toBe("AA");
  });
  it("buildXlsx 產出 zip", () => {
    const x = buildXlsx("s", [[{ t: "s", v: "編號" }], [{ t: "n", v: 1 }]]);
    expect([x[0], x[1]]).toEqual([0x50, 0x4b]);
  });
});

describe("pdf", () => {
  it("以 %PDF 開頭、以 %%EOF 結尾", () => {
    const bytes = buildPdf(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 100, 100);
    const s = new TextDecoder().decode(bytes);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/MediaBox [0 0 100 100]");
  });
});

describe("layout", () => {
  it("wrapText 裁行加省略號", () => {
    expect(wrapText("阿明海產店家名稱很長很長超過限制", 5, 2)).toEqual(["阿明海產店", "家名稱很…"]);
  });
  it("computeLayout：無 feature 時仍有合理尺寸", () => {
    const doc = makeDoc();
    const geo = new MapGeometry(doc);
    const layout = computeLayout(doc, geo, {}, normalizeOptions({ mode: "overlay", includeList: true }));
    expect(layout.width).toBeGreaterThan(doc.grid.w * doc.grid.cellPx);
    expect(layout.totalH).toBeGreaterThan(layout.mapH);
  });
});

describe("svg / rows", () => {
  const doc = (() => {
    let d = makeDoc({ categories: [{ id: "c1", name: "熟食", color: "#ED7D31" }] });
    d = assignCells(d, ["0_0", "0_1"], { categoryId: "c1", featureName: "阿明" });
    return d;
  })();
  const geo = new MapGeometry(doc);
  const numbers = { [doc.features[0]!.id]: 1 };

  it("buildSvg 產出合法 svg 且含分類色與編號", () => {
    const layout = computeLayout(doc, geo, numbers, normalizeOptions({ mode: "overlay", includeList: true }));
    const svg = buildSvg(doc, geo, numbers, layout);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("#ED7D31");
    expect(svg).toContain("阿明");
  });

  it("plan 模式不含實際分類清單標籤", () => {
    const layout = computeLayout(doc, geo, numbers, normalizeOptions({ mode: "plan" }));
    expect(layout.opts.includeList).toBe(false);
  });

  it("buildRows：表頭 + 每個 feature 一列", () => {
    const rows = buildRows(doc, geo, numbers, { number: "編號", feature: "店家", category: "分類" });
    expect(rows[0]!.map((c) => c!.v)).toEqual(["編號", "店家", "分類", "格數", "分布區塊數", "首格位置"]);
    expect(rows).toHaveLength(2);
    expect(rows[1]![1]!.v).toBe("阿明");
    expect(rows[1]![3]!.v).toBe(2);
  });
});
