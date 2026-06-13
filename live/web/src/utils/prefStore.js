/** 偏好与关注：键名不依赖站点 URL；关注另写 Cookie(path=/) 以便同主机不同端口共享 */

const PREFIX = "lemon_live";

export function followStorageKey() {
  return `${PREFIX}.follows`;
}

export function pendingFollowImportKey() {
  return `${PREFIX}.pending_follow_import`;
}

export function platformPrefKey(site, category) {
  return `${PREFIX}.prefs.${site}.${category}`;
}

export function globalPrefKey(category) {
  return `${PREFIX}.prefs.global.${category}`;
}

export function loadGlobalPref(category, defaults, legacyMigrators = []) {
  const key = globalPrefKey(category);
  const stored = loadJson(key);
  if (stored && typeof stored === "object" && Object.keys(stored).length) {
    return { ...defaults, ...stored };
  }

  for (const migrate of legacyMigrators) {
    const legacy = migrate();
    if (legacy && typeof legacy === "object" && Object.keys(legacy).length) {
      const merged = { ...defaults, ...legacy };
      saveJson(key, merged);
      return merged;
    }
  }

  return { ...defaults };
}

export function saveGlobalPref(category, value) {
  saveJson(globalPrefKey(category), value);
}

export function loadJson(key, fallback = null) {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function readLegacyCookie(name) {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function clearLegacyCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function loadPlatformPref(site, category, defaults, legacyMigrators = []) {
  const key = platformPrefKey(site, category);
  const stored = loadJson(key);
  if (stored && typeof stored === "object" && Object.keys(stored).length) {
    return { ...defaults, ...stored };
  }

  for (const migrate of legacyMigrators) {
    const legacy = migrate();
    if (legacy && typeof legacy === "object" && Object.keys(legacy).length) {
      const merged = { ...defaults, ...legacy };
      saveJson(key, merged);
      return merged;
    }
  }

  return { ...defaults };
}

export function savePlatformPref(site, category, value) {
  saveJson(platformPrefKey(site, category), value);
}

export function migrateGlobalCookiePref(site, category, cookieName, defaults, ownerSite = null) {
  return () => {
    if (ownerSite && site !== ownerSite) return null;
    const fromCookie = readLegacyCookie(cookieName);
    if (fromCookie && typeof fromCookie === "object" && Object.keys(fromCookie).length) {
      clearLegacyCookie(cookieName);
      return fromCookie;
    }
    return null;
  };
}

export function migrateLocalPref(site, category, localKey, ownerSite = null) {
  return () => {
    if (ownerSite && site !== ownerSite) return null;
    const legacy = loadJson(localKey);
    if (legacy && typeof legacy === "object" && Object.keys(legacy).length) {
      localStorage.removeItem(localKey);
      return legacy;
    }
    return null;
  };
}

function readLegacyQualityPref() {
  const fromCookie = readLegacyCookie("lemon_quality");
  if (fromCookie?.qualityName || fromCookie?.lineName) {
    clearLegacyCookie("lemon_quality");
    return {
      qualityName: fromCookie.qualityName ? String(fromCookie.qualityName) : "",
      lineName: fromCookie.lineName ? String(fromCookie.lineName) : "",
    };
  }

  const legacy = loadJson("live.web.prefs");
  if (legacy?.qualityName) {
    localStorage.removeItem("live.web.prefs");
    return {
      qualityName: String(legacy.qualityName),
      lineName: legacy.lineName ? String(legacy.lineName) : "",
    };
  }

  return null;
}

/** 旧版全局清晰度偏好迁移到各平台独立键 */
export function migrateGlobalQualityToPlatform(site, platforms = ["douyu", "huya", "bilibili", "douyin"]) {
  return () => {
    const legacy = readLegacyQualityPref();
    if (!legacy) return null;

    for (const platform of platforms) {
      const key = platformPrefKey(platform, "quality");
      if (!loadJson(key)) {
        saveJson(key, legacy);
      }
    }

    return legacy;
  };
}

const FOLLOWS_COOKIE = `${PREFIX}.follows`;

/** Cookie 不按端口隔离，用于同主机不同端口间同步关注（localStorage 按 origin 含端口隔离） */
function readFollowsCookie() {
  const raw = readLegacyCookie(FOLLOWS_COOKIE);
  if (!Array.isArray(raw) || !raw.length) return [];
  return normalizeFollows(raw);
}

function syncFollowsCookie(list) {
  if (typeof document === "undefined") return;
  const normalized = normalizeFollows(list);
  if (!normalized.length) {
    clearLegacyCookie(FOLLOWS_COOKIE);
    return;
  }
  const payload = encodeURIComponent(JSON.stringify(normalized));
  if (payload.length > 3800) return;
  document.cookie = `${FOLLOWS_COOKIE}=${payload}; path=/; SameSite=Lax; max-age=31536000`;
}

export function loadFollows() {
  const key = followStorageKey();
  let result = [];

  const stored = loadJson(key);
  if (Array.isArray(stored)) {
    result = normalizeFollows(stored);
  } else {
    const legacy = loadJson("lemon_follow_list");
    if (Array.isArray(legacy) && legacy.length) {
      result = normalizeFollows(legacy);
      saveJson(key, result);
      localStorage.removeItem("lemon_follow_list");
    }
  }

  const fromCookie = readFollowsCookie();
  if (fromCookie.length) {
    const merged = mergeFollows(result, fromCookie);
    if (merged.length !== result.length) {
      result = merged;
      saveJson(key, result);
    }
  }

  if (result.length) syncFollowsCookie(result);

  return result;
}

export function saveFollows(list, { touchUpdatedAt = false } = {}) {
  const now = Date.now();
  const normalized = normalizeFollows(
    (list || []).map((item) => ({
      ...item,
      clientUpdatedAt: touchUpdatedAt ? now : (Number(item.clientUpdatedAt) || Number(item.addedAt) || now),
    })),
  );
  saveJson(followStorageKey(), normalized);
  syncFollowsCookie(normalized);
}

/** Tampermonkey / 跨页写入的待导入关注，合并后清除 */
export function applyPendingFollowImport() {
  const key = pendingFollowImportKey();
  const pending = loadJson(key);
  if (!Array.isArray(pending) || !pending.length) return 0;

  const before = loadFollows();
  const beforeKeys = new Set(before.map((r) => followKey(r.site, r.id)));
  const merged = mergeFollows(before, pending);
  saveFollows(merged);
  localStorage.removeItem(key);
  return merged.filter((r) => !beforeKeys.has(followKey(r.site, r.id))).length;
}

/** 关注仅以 platform + roomId 为唯一键，忽略 URL 类字段 */
export function normalizeFollows(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const site = String(item?.site || "").trim();
    const id = String(item?.id || "").trim();
    if (!site || !id) continue;
    const key = `${site}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      site,
      id,
      title: item.title ? String(item.title) : "",
      anchor: item.anchor ? String(item.anchor) : "",
      cover: item.cover ? String(item.cover) : "",
      avatar: item.avatar ? String(item.avatar) : "",
      addedAt: Number(item.addedAt) || Date.now(),
      super: Boolean(item.super),
      clientUpdatedAt: Number(item.clientUpdatedAt) || Number(item.addedAt) || Date.now(),
    });
  }
  return out;
}

export function followKey(site, id) {
  return `${site}:${id}`;
}

/** 合并关注列表，以 platform + roomId 去重，保留较早的 addedAt */
export function mergeFollows(existing, incoming) {
  return normalizeFollows([...(existing || []), ...(incoming || [])]);
}

/** 与远端备份合并：较新的 clientUpdatedAt 优先，super 取并集 */
export function mergeFollowsWithRemote(local, remote) {
  const map = new Map();
  for (const raw of [...(local || []), ...(remote || [])]) {
    const item = normalizeFollows([raw])[0];
    if (!item) continue;
    const key = followKey(item.site, item.id);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    const takeIncoming = item.clientUpdatedAt >= prev.clientUpdatedAt;
    const base = takeIncoming ? item : prev;
    const other = takeIncoming ? prev : item;
    map.set(key, {
      ...base,
      super: Boolean(base.super || other.super),
      addedAt: Math.min(Number(prev.addedAt) || Date.now(), Number(item.addedAt) || Date.now()),
    });
  }
  return [...map.values()];
}
