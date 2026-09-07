import type { Template } from "./types";

export const blankGridTemplate: Template = {
  id: "blank-grid",
  title: "空白網格",
  description: "從零開始的格線地圖，之後可調整網格大小、新增分區與分類。",
  build: () => ({
    name: "未命名地圖",
    doc: { grid: { w: 60, h: 40, cellPx: 14 } },
  }),
};

export const blankImageTemplate: Template = {
  id: "blank-image",
  title: "底圖描繪",
  description: "匯入一張平面圖或照片當底圖，在上面描繪格線與分區。",
  build: () => ({
    name: "未命名地圖",
    doc: { grid: { w: 80, h: 60, cellPx: 14 } },
    view: { view: "plan" },
  }),
};
