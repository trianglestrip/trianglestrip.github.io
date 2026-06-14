import { loadGlobalPref, saveGlobalPref } from "./prefStore.js";

const DEFAULTS = { open: true };

export function loadDrawerPref() {
  return loadGlobalPref("directoryDrawer", DEFAULTS);
}

export function saveDrawerOpen(open) {
  saveGlobalPref("directoryDrawer", { ...loadDrawerPref(), open: !!open });
}
