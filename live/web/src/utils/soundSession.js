const STORAGE_KEY = "lemon_live.sound_unlocked";

function readStoredUnlock() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function isPageReload() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    return nav?.type === "reload";
  } catch {
    return false;
  }
}

/** 本标签页内是否已解除自动播放静音限制（同页切房保持，F5 刷新重置） */
let soundUnlocked = isPageReload() ? false : readStoredUnlock();

export function isSoundUnlocked() {
  return soundUnlocked;
}

export function unlockSound() {
  soundUnlocked = true;
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetSoundSession() {
  soundUnlocked = false;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
