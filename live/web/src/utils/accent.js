import { ACCENT_PRESETS, DEFAULT_ACCENT_ID, findAccentPreset } from "../config/accentPresets.js";

function getCurrentMode() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const raw = String(hex || "").replace("#", "");
  if (raw.length !== 6) return { r: 243, g: 208, b: 78 };
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function mixRgb(a, b, weight) {
  const w = clamp(weight, 0, 1);
  return {
    r: a.r + (b.r - a.r) * w,
    g: a.g + (b.g - a.g) * w,
    b: a.b + (b.b - a.b) * w,
  };
}

function computeHover(hex, mode) {
  const rgb = hexToRgb(hex);
  const target = mode === "light" ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const amount = mode === "light" ? 0.14 : 0.12;
  const mixed = mixRgb(rgb, target, amount);
  return rgbToHex(mixed.r, mixed.g, mixed.b);
}

function computeOnColor(hex) {
  return relativeLuminance(hexToRgb(hex)) > 0.58 ? "#1a1400" : "#ffffff";
}

export function applyAccent(accentId = DEFAULT_ACCENT_ID) {
  if (typeof document === "undefined") return;
  const preset = findAccentPreset(accentId);
  const mode = getCurrentMode();
  const rgb = hexToRgb(preset.hex);
  const root = document.documentElement;

  root.dataset.accent = preset.id;
  root.style.setProperty("--primary", preset.hex);
  root.style.setProperty("--primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty("--primary-hover", computeHover(preset.hex, mode));
  root.style.setProperty("--primary-on", computeOnColor(preset.hex));
}

export function getAccentPresets() {
  return ACCENT_PRESETS;
}

export function getAccentHex(accentId) {
  return findAccentPreset(accentId).hex;
}
