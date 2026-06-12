/** 偏好设置 Cookie 读写（默认 30 天过期） */

export const COOKIE_DAYS = 30;

export const COOKIE_KEYS = {
  overlayDanmaku: "lemon_dm_overlay",
  chatDanmaku: "lemon_dm_chat",
  quality: "lemon_quality",
};

export function setCookieJson(name, value, days = COOKIE_DAYS) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const encoded = encodeURIComponent(JSON.stringify(value));
  document.cookie = `${name}=${encoded}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookieJson(name, fallback = null) {
  if (typeof document === "undefined") return fallback;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) return fallback;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return fallback;
  }
}

export function loadPrefCookie(name, defaults, legacyLocalKey) {
  const fromCookie = getCookieJson(name);
  if (fromCookie && typeof fromCookie === "object") {
    return { ...defaults, ...fromCookie };
  }
  if (legacyLocalKey) {
    try {
      const legacy = JSON.parse(localStorage.getItem(legacyLocalKey) || "{}");
      if (legacy && typeof legacy === "object" && Object.keys(legacy).length) {
        const merged = { ...defaults, ...legacy };
        setCookieJson(name, merged);
        return merged;
      }
    } catch {
      /* ignore */
    }
  }
  return { ...defaults };
}
