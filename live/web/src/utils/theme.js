import { applyAccent } from "./accent.js";
import { DEFAULT_ACCENT_ID } from "../config/accentPresets.js";
import { loadGlobalPref, saveGlobalPref } from "./prefStore.js";

const DEFAULTS = { mode: "dark", accent: DEFAULT_ACCENT_ID };

export function loadThemePref() {
  return loadGlobalPref("theme", DEFAULTS);
}

export function saveThemePref(patch) {
  const next = { ...loadThemePref(), ...patch };
  saveGlobalPref("theme", next);
  return next;
}

export function getTheme() {
  const pref = loadThemePref();
  return pref.mode === "light" ? "light" : "dark";
}

export function getAccent() {
  return loadThemePref().accent || DEFAULT_ACCENT_ID;
}

export function applyTheme(mode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode === "light" ? "light" : "dark";
}

export function initTheme() {
  const pref = loadThemePref();
  applyTheme(pref.mode);
  applyAccent(pref.accent);
}

export function toggleTheme() {
  const pref = loadThemePref();
  const next = pref.mode === "light" ? "dark" : "light";
  const updated = saveThemePref({ mode: next });
  applyTheme(updated.mode);
  applyAccent(updated.accent);
  return updated.mode;
}

export function setAccent(accentId) {
  const updated = saveThemePref({ accent: accentId });
  applyAccent(updated.accent);
  return updated.accent;
}
