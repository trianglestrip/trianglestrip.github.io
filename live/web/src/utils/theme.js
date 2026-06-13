import { loadGlobalPref, saveGlobalPref } from "./prefStore.js";

const DEFAULTS = { mode: "dark" };

export function getTheme() {
  const pref = loadGlobalPref("theme", DEFAULTS);
  return pref.mode === "light" ? "light" : "dark";
}

export function applyTheme(mode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode === "light" ? "light" : "dark";
}

export function initTheme() {
  applyTheme(getTheme());
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  saveGlobalPref("theme", { mode: next });
  applyTheme(next);
  return next;
}
