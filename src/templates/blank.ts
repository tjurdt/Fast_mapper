import type { Template } from "./types";

const STARTER_CATEGORIES = [
  { id: "c1", name: "分類 A", color: "#ED7D31" },
  { id: "c2", name: "分類 B", color: "#2E75B6" },
  { id: "c3", name: "分類 C", color: "#70AD47" },
];
const STARTER_PLAN_LAYERS = [
  { id: "z1", name: "區域", color: "#9966FF" },
  { id: "z2", name: "走道", color: "#D9DEE0" },
];

export const blankGridTemplate: Template = {
  id: "blank-grid",
  title: "空白網格",
  description: "從零開始的格線地圖，附幾個可改名的起始分類；隨時可調整網格大小。",
  build: () => ({
    name: "未命名地圖",
    doc: {
      grid: { w: 60, h: 40, cellPx: 14 },
      categories: STARTER_CATEGORIES.map((c) => ({ ...c })),
      planLayers: STARTER_PLAN_LAYERS.map((z) => ({ ...z })),
    },
  }),
};

export const blankImageTemplate: Template = {
  id: "blank-image",
  title: "底圖描繪",
  description: "匯入一張平面圖或照片當底圖，在上面描繪格線與分區。",
  build: () => ({
    name: "未命名地圖",
    doc: {
      grid: { w: 80, h: 60, cellPx: 14 },
      categories: STARTER_CATEGORIES.map((c) => ({ ...c })),
      planLayers: STARTER_PLAN_LAYERS.map((z) => ({ ...z })),
    },
    view: { view: "plan" },
  }),
};
