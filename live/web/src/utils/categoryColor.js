import { displayCategoryName } from "./categoryDisplay.js";

/** 分类名 → 稳定配色（跨平台同名同色，基于统一展示名） */
const CATEGORY_PALETTE = [
  { color: "#6eb5ff", bg: "rgba(110, 181, 255, 0.18)" },
  { color: "#7dd87d", bg: "rgba(125, 216, 125, 0.18)" },
  { color: "#c792ea", bg: "rgba(199, 146, 234, 0.18)" },
  { color: "#56d6c2", bg: "rgba(86, 214, 194, 0.18)" },
  { color: "#f78c6c", bg: "rgba(247, 140, 108, 0.18)" },
  { color: "#ffcb6b", bg: "rgba(255, 203, 107, 0.18)" },
  { color: "#82aaff", bg: "rgba(130, 170, 255, 0.18)" },
  { color: "#f07178", bg: "rgba(240, 113, 120, 0.18)" },
  { color: "#a6e22e", bg: "rgba(166, 226, 46, 0.16)" },
  { color: "#e6b450", bg: "rgba(230, 180, 80, 0.18)" },
  { color: "#66d9ef", bg: "rgba(102, 217, 239, 0.18)" },
  { color: "#fd971f", bg: "rgba(253, 151, 31, 0.18)" },
];

function hashCategory(name) {
  let hash = 0;
  const text = String(name).trim();
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getCategoryStyle(category, site = "", cid = "", options = {}) {
  const name = displayCategoryName(site, category, cid);
  if (!name) return null;
  const palette = CATEGORY_PALETTE[hashCategory(name) % CATEGORY_PALETTE.length];
  const bgAlpha = Number(options.bgAlpha);
  const backgroundColor =
    Number.isFinite(bgAlpha) && bgAlpha >= 0
      ? palette.bg.replace(/,\s*[\d.]+\)$/, `, ${bgAlpha})`)
      : palette.bg;
  return {
    color: palette.color,
    backgroundColor,
  };
}
