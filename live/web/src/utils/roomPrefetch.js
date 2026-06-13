import { fetchRoom } from "../api/room.js";
import { loadPlatformPref, migrateGlobalQualityToPlatform } from "./prefStore.js";

const MAX_ENTRIES = 12;
const CLIENT_TTL_MS = 55_000;

/** @type {Map<string, { data: object, ts: number }>} */
const cache = new Map();
/** @type {Map<string, Promise<object>>} */
const inflight = new Map();

function qualityForSite(site) {
  const prefs = loadPlatformPref(site, "quality", { qualityName: "", lineName: "" }, [
    migrateGlobalQualityToPlatform(site),
  ]);
  return prefs.qualityName || undefined;
}

function cacheKey(site, room, quality) {
  return `${site}:${room}:${quality || "*"}`;
}

function evictIfNeeded() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

/**
 * 列表 hover 时预热 /api/room，进播放页可跳过等待。
 */
export function prefetchRoom(site, roomId) {
  const room = String(roomId || "").trim();
  const platform = String(site || "").trim();
  if (!platform || !room) return;

  const quality = qualityForSite(platform);
  const key = cacheKey(platform, room, quality);
  const existing = cache.get(key);
  if (existing && Date.now() - existing.ts < CLIENT_TTL_MS) return;
  if (inflight.has(key)) return;

  const promise = fetchRoom({
    site: platform,
    room,
    mode: "lazy",
    quality,
    force: false,
  })
    .then((data) => {
      cache.set(key, { data, ts: Date.now() });
      evictIfNeeded();
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
}

/** 进房时读取 hover 预热结果（未过期） */
export function getPrefetchedRoom(site, roomId) {
  const room = String(roomId || "").trim();
  const platform = String(site || "").trim();
  if (!platform || !room) return null;

  const quality = qualityForSite(platform);
  const key = cacheKey(platform, room, quality);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CLIENT_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
