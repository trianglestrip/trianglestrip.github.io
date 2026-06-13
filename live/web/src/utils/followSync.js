import { fetchFollowStore, pushFollowStore } from "../api/follow.js";
import { loadFollows, mergeFollowsWithRemote, saveFollows } from "./prefStore.js";

const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const SYNC_META_KEY = "lemon_live.follows.sync_at";

let started = false;
let syncing = false;

function saveSyncMeta() {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    /* ignore */
  }
}

async function pullRemote(applyMerged) {
  const data = await fetchFollowStore();
  const remote = Array.isArray(data.follows) ? data.follows : [];
  if (!remote.length) return false;
  const local = loadFollows();
  const merged = mergeFollowsWithRemote(local, remote);
  applyMerged(merged);
  return true;
}

async function pushLocal() {
  const local = loadFollows();
  if (!local.length) return false;
  await pushFollowStore(local);
  saveSyncMeta();
  return true;
}

async function syncBoth(applyMerged) {
  if (syncing) return;
  syncing = true;
  try {
    await pullRemote(applyMerged);
    await pushLocal();
  } catch {
    /* 离线或 API 不可用时静默跳过 */
  } finally {
    syncing = false;
  }
}

/** @deprecated 多用户公服不共享关注；已停用，跨设备请用设置中的导出/导入 */
export function startFollowSync(applyMerged) {
  if (started || typeof window === "undefined") return;
  started = true;

  window.setTimeout(() => {
    pullRemote(applyMerged).catch(() => {});
  }, 2500);

  window.setInterval(() => {
    syncBoth(applyMerged).catch(() => {});
  }, SYNC_INTERVAL_MS);
}

export const followSyncIntervalMs = SYNC_INTERVAL_MS;
