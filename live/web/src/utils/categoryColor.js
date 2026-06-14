import { displayCategoryName } from "./categoryDisplay.js";

/** 分类名 → 稳定配色（跨平台同名同色，基于统一展示名） */
const CATEGORY_PALETTE = [
  { color: "#6eb5ff", bg: "rgba(110, 181, 255, 0.18)", bgDark: "#1e3a58", colorDark: "#8ec8ff", bgLight: "#c5ddf5", colorLight: "#1a5080", bgSolid: "#456888", colorSolid: "#cce4ff" },
  { color: "#7dd87d", bg: "rgba(125, 216, 125, 0.18)", bgDark: "#1e4028", colorDark: "#8ee890", bgLight: "#c8ebc8", colorLight: "#1a6020", bgSolid: "#487858", colorSolid: "#c8f0d0" },
  { color: "#c792ea", bg: "rgba(199, 146, 234, 0.18)", bgDark: "#3a2850", colorDark: "#d4a8f0", bgLight: "#e8d0f5", colorLight: "#6a2880", bgSolid: "#685878", colorSolid: "#ecd8f8" },
  { color: "#56d6c2", bg: "rgba(86, 214, 194, 0.18)", bgDark: "#1a4038", colorDark: "#68e8d8", bgLight: "#b8ebe0", colorLight: "#1a6858", bgSolid: "#3a6860", colorSolid: "#c0f0e8" },
  { color: "#f78c6c", bg: "rgba(247, 140, 108, 0.18)", bgDark: "#4a2818", colorDark: "#ffa890", bgLight: "#f5d0c0", colorLight: "#a04020", bgSolid: "#805040", colorSolid: "#ffd8c8" },
  { color: "#ffcb6b", bg: "rgba(255, 203, 107, 0.18)", bgDark: "#4a3810", colorDark: "#ffd880", bgLight: "#f5e0a8", colorLight: "#806010", bgSolid: "#786038", colorSolid: "#ffe8b0" },
  { color: "#82aaff", bg: "rgba(130, 170, 255, 0.18)", bgDark: "#243058", colorDark: "#98b8ff", bgLight: "#c8d8f8", colorLight: "#284878", bgSolid: "#485880", colorSolid: "#d0dcff" },
  { color: "#f07178", bg: "rgba(240, 113, 120, 0.18)", bgDark: "#4a1820", colorDark: "#ff8890", bgLight: "#f5c0c8", colorLight: "#a02030", bgSolid: "#804048", colorSolid: "#ffd0d8" },
  { color: "#a6e22e", bg: "rgba(166, 226, 46, 0.16)", bgDark: "#304010", colorDark: "#b8f040", bgLight: "#d8eaa0", colorLight: "#506810", bgSolid: "#586830", colorSolid: "#e0f0a8" },
  { color: "#e6b450", bg: "rgba(230, 180, 80, 0.18)", bgDark: "#483818", colorDark: "#f0c868", bgLight: "#f0d898", colorLight: "#806018", bgSolid: "#786038", colorSolid: "#ffe8b8" },
  { color: "#66d9ef", bg: "rgba(102, 217, 239, 0.18)", bgDark: "#1a3848", colorDark: "#78e8f8", bgLight: "#b8e8f0", colorLight: "#1a5870", bgSolid: "#386878", colorSolid: "#c8f0f8" },
  { color: "#fd971f", bg: "rgba(253, 151, 31, 0.18)", bgDark: "#4a3010", colorDark: "#ffa840", bgLight: "#f5d8a8", colorLight: "#904810", bgSolid: "#805028", colorSolid: "#ffe0a8" },
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

  if (options.opaque === true) {
    return {
      color: palette.colorSolid,
      backgroundColor: palette.bgSolid,
    };
  }

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
