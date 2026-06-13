/** 偏好与关注：按平台/房间号存储，不依赖站点 URL 或 Cookie 域 */

const PREFIX = "lemon_live";

export function followStorageKey() {
  return `${PREFIX}.follows`;
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

export function loadFollows() {
  const key = followStorageKey();
  const stored = loadJson(key);
  if (Array.isArray(stored)) {
    return normalizeFollows(stored);
  }

  const legacy = loadJson("lemon_follow_list");
  if (Array.isArray(legacy) && legacy.length) {
    const normalized = normalizeFollows(legacy);
    saveJson(key, normalized);
    localStorage.removeItem("lemon_follow_list");
    return normalized;
  }

  return [];
}

export function saveFollows(list) {
  saveJson(followStorageKey(), normalizeFollows(list));
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
    });
  }
  return out;
}

export function followKey(site, id) {
  return `${site}:${id}`;
}
