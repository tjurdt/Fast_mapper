/** 向量匯出。移植自 legacy buildSVG + svgCell / svgQuad / svgBandMasks / svgBands / svgCuts。 */
import { cellParts } from "../core/cells";
import { cutGeom } from "../core/bands";
import { keyRC, isBandKey } from "../core/keys";
import type { CellPoly, MapDoc, Point } from "../core/types";
import type { MapGeometry } from "../core/geometry";
import { xesc } from "./xlsx";
import { facilityById, FACILITIES } from "../facilities";
import { EXPORT_COLS, wrapText, type ExportLayout } from "./layout";
import { WALL_STROKE } from "../render/primitives";

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

function svgCell(r: number, c: number, poly: CellPoly | null, cw: number, ch: number, attrs: string): string {
  if (!poly)
    return `<rect x="${f1(c * cw)}" y="${f1(r * ch)}" width="${f1(cw)}" height="${f1(ch)}" ${attrs}/>`;
  if (poly.length < 3) return "";
  return `<polygon points="${poly.map((p) => `${f2((c + p[0]) * cw)},${f2((r + p[1]) * ch)}`).join(" ")}" ${attrs}/>`;
}

function svgQuad(q: Point[], attrs: string): string {
  return `<polygon points="${q.map((p) => `${f2(p[0])},${f2(p[1])}`).join(" ")}" ${attrs}/>`;
}

export function buildSvg(
  doc: MapDoc,
  geo: MapGeometry,
  numbers: Record<string, number>,
  layout: ExportLayout,
): string {
  const { opts } = layout;
  const cw = geo.cw;
  const ch = geo.ch;
  const imgW = layout.imgW;
  const imgH = layout.imgH;
  const planColor = new Map(doc.planLayers.map((z) => [z.id, z.color]));
  const catColor = new Map(doc.categories.map((c) => [c.id, c.color]));
  const catName = new Map(doc.categories.map((c) => [c.id, c.name]));
  const a = opts.actualOpacity;

  const mask = (id: string, quads: Point[][]) =>
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${imgW}" height="${imgH}">` +
    `<rect width="${imgW}" height="${imgH}" fill="white"/>${quads.map((q) => svgQuad(q, 'fill="black"')).join("")}</mask>`;

  let r =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.totalH}" ` +
    `viewBox="0 0 ${layout.width} ${layout.totalH}" font-family="'Noto Sans TC',sans-serif">` +
    `<defs>${mask("actualMask", geo.bandActualQuads())}${mask("gridMask", geo.bandFootprintQuads())}</defs>` +
    `<rect width="${layout.width}" height="${layout.totalH}" fill="#fff"/>` +
    (opts.title
      ? `<text x="${layout.width / 2}" y="${layout.titleH / 2}" fill="#0e3b43" font-size="44" font-weight="700" text-anchor="middle" dominant-baseline="central">${xesc(opts.title)}</text>`
      : "") +
    `<g transform="translate(${layout.padX} ${layout.titleH + layout.padY})">`;

  if (opts.mode === "plan" || opts.mode === "overlay") {
    for (const k in doc.cells) {
      const plan = doc.cells[k]!.plan;
      const col = plan && planColor.get(plan);
      if (!col) continue;
      const [rr, c] = keyRC(k);
      r += svgCell(rr, c, null, cw, ch, `fill="${col}" fill-opacity="${opts.baseOpacity / 100}"`);
    }
  }

  if (opts.mode !== "plan") {
    r += `<g mask="url(#actualMask)">`;
    for (const k in doc.cells) {
      const d = doc.cells[k]!;
      if (!d.cat || isBandKey(k) || geo.cellCovered(k)) continue;
      const [rr, c] = keyRC(k);
      for (const p of cellParts(d)) {
        const col = catColor.get(p.cat);
        if (col) r += svgCell(rr, c, p.poly, cw, ch, `fill="${col}" fill-opacity="${a}"`);
      }
    }
    r += `</g>`;
  }

  if (opts.showGrid) {
    const m = opts.mode !== "plan" ? ' mask="url(#gridMask)"' : "";
    r += `<g${m} stroke="#143237" stroke-opacity=".13" stroke-width="0.5">`;
    for (let c = 0; c <= geo.gridW; c++)
      r += `<line x1="${f1(c * cw)}" y1="0" x2="${f1(c * cw)}" y2="${imgH}"/>`;
    for (let rr = 0; rr <= geo.gridH; rr++)
      r += `<line x1="0" y1="${f1(rr * ch)}" x2="${imgW}" y2="${f1(rr * ch)}"/>`;
    r += `</g>`;
  }

  if (opts.mode !== "plan") {
    geo.forEachBandCell((_k, d, q) => {
      const col = d.cat && catColor.get(d.cat);
      if (col) r += svgQuad(q, `fill="${col}" fill-opacity="${a}"`);
    });
    for (const k in doc.cells) {
      const d = doc.cells[k]!;
      if (!d.feature) continue;
      for (const g of geo.allBorderSegments(k, d)) {
        r +=
          `<line x1="${f2(g[0])}" y1="${f2(g[1])}" x2="${f2(g[2])}" y2="${f2(g[3])}" ` +
          `stroke="#142d32" stroke-opacity=".55" stroke-width="${f1(cw * 0.12)}" stroke-linecap="round"/>`;
      }
    }
  }

  for (const cut of doc.cuts) {
    if (!cut.wall) continue;
    const g = cutGeom(cut, cw, ch);
    r +=
      `<line x1="${f2(g.ax)}" y1="${f2(g.ay)}" x2="${f2(g.bx)}" y2="${f2(g.by)}" ` +
      `stroke="${WALL_STROKE}" stroke-width="${f1(Math.max(1.1, cw * 0.42))}" stroke-linecap="round"/>`;
  }

  if (opts.mode !== "plan" && !opts.omitLabels) {
    for (const feat of layout.features) {
      const num = numbers[feat.id];
      const icon = facilityById(feat.facility)?.icon;
      if (!num && !icon) continue;
      for (const [cx, cy] of geo.featureLabelAnchors(feat.id)) {
        if (icon) {
          r +=
            `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(ch * 0.86)}" fill="#fff" stroke="#0e3b43" stroke-opacity=".35" stroke-width="${f1(ch * 0.08)}"/>` +
            `<text x="${f1(cx)}" y="${f1(cy)}" font-size="${f1(ch * 1.2)}" text-anchor="middle" dominant-baseline="central">${icon}</text>`;
        } else {
          r +=
            `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(ch * 0.75)}" fill="#0e3b43"/>` +
            `<text x="${f1(cx)}" y="${f1(cy)}" fill="#fff" font-size="${f1(ch * 0.9)}" font-weight="700" ` +
            `text-anchor="middle" dominant-baseline="central">${num}</text>`;
        }
      }
    }
  }
  r += `</g>`;

  // 圖例
  const ly = layout.mapH;
  const colW = (layout.width - 72) / EXPORT_COLS;
  r +=
    `<rect x="0" y="${ly}" width="${layout.width}" height="${layout.legendH}" fill="#fff"/>` +
    `<line x1="0" y1="${ly}" x2="${layout.width}" y2="${ly}" stroke="#cad4d5"/>` +
    `<text x="36" y="${ly + 40}" fill="#0e3b43" font-size="27" font-weight="700">` +
    `顏色圖例（${opts.mode === "plan" ? "規劃" : "實際"}）</text>`;
  layout.legendItems.forEach((item, i) => {
    const x = 36 + (i % EXPORT_COLS) * colW;
    const y = ly + 83 + Math.floor(i / EXPORT_COLS) * 48;
    r +=
      `<rect x="${f1(x)}" y="${f1(y - 21)}" width="29" height="29" rx="4" fill="${item.color}" stroke="#000" stroke-opacity=".22"/>` +
      `<text x="${f1(x + 41)}" y="${f1(y + 2)}" fill="#203236" font-size="21" font-weight="600">${xesc(item.name)}</text>`;
  });
  const svgFacs = FACILITIES.filter((fa) => doc.features.some((f) => f.facility === fa.id));
  if (svgFacs.length) {
    const rows = Math.ceil(layout.legendItems.length / EXPORT_COLS);
    let fy = ly + 83 + rows * 48 + 8;
    r += `<text x="36" y="${fy}" fill="#0e3b43" font-size="22" font-weight="700">設施</text>`;
    fy += 30;
    svgFacs.forEach((fa, i) => {
      const x = 36 + (i % EXPORT_COLS) * colW;
      const y = fy + Math.floor(i / EXPORT_COLS) * 40;
      r +=
        `<text x="${f1(x)}" y="${f1(y + 4)}" font-size="26">${fa.icon}</text>` +
        `<text x="${f1(x + 38)}" y="${f1(y)}" fill="#203236" font-size="20" font-weight="600">${xesc(fa.label)}</text>`;
    });
  }

  // 對照清單
  if (opts.includeList) {
    const top = layout.mapH + layout.legendH;
    const pad = 32;
    const listColW = (layout.width - pad * 2) / EXPORT_COLS;
    r +=
      `<rect x="0" y="${top}" width="${layout.width}" height="${layout.listH}" fill="#f7f9f9"/>` +
      `<line x1="0" y1="${top}" x2="${layout.width}" y2="${top}" stroke="#cad4d5"/>` +
      `<text x="${pad}" y="${top + 45}" fill="#0e3b43" font-size="34" font-weight="700">對照清單</text>`;
    if (!layout.features.length)
      r += `<text x="${pad}" y="${top + 94}" fill="#627579" font-size="22">尚無資料</text>`;
    for (let col = 0; col < EXPORT_COLS; col++) {
      let y = top + 67;
      const cellX = pad + col * listColW;
      for (const { feature, height } of layout.listColumns[col]!) {
        const lines = wrapText(feature.name, 13, 2);
        const x = cellX + 9;
        const num = numbers[feature.id];
        const color = catColor.get(feature.category) ?? "#D9DEE0";
        const nameY = y + (lines.length > 1 ? 22 : 25);
        const catY = y + (lines.length > 1 ? 79 : 52);
        r +=
          `<rect x="${f1(cellX)}" y="${y}" width="${f1(listColW)}" height="${height}" fill="${color}" fill-opacity=".14" stroke="#5a6e72" stroke-opacity=".24"/>` +
          `<circle cx="${f1(x + 20)}" cy="${f1(y + height / 2)}" r="20" fill="#0e3b43"/>` +
          `<text x="${f1(x + 20)}" y="${f1(y + height / 2)}" fill="#fff" font-size="19" font-weight="700" text-anchor="middle" dominant-baseline="central">${num ?? ""}</text>` +
          `<text x="${f1(x + 50)}" y="${nameY}" fill="#1c2b2e" font-size="27" font-weight="600">` +
          lines
            .map((line, li) => `<tspan x="${f1(x + 50)}" y="${nameY + li * 28}">${xesc(line)}</tspan>`)
            .join("") +
          `</text>` +
          `<text x="${f1(x + 50)}" y="${catY}" fill="#53676b" font-size="21">${xesc(catName.get(feature.category) ?? "")}</text>`;
        y += height;
      }
    }
  }

  return r + `</svg>`;
}
