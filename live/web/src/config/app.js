const DEFAULTS = {
  appTitle: "Lemon live",
  api: {
    baseUrl: "",
    devBaseUrl: "http://127.0.0.1:8765",
  },
};

let appConfig = structuredClone(DEFAULTS);

function trimBase(url) {
  return String(url || "").replace(/\/$/, "");
}

export async function loadAppConfig() {
  async function fetchJson(url) {
    try {
      const res = await fetch(`${url}?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  const base = (await fetchJson("/config.json")) || {};
  const local = (await fetchJson("/config.local.json")) || {};
  appConfig = {
    ...DEFAULTS,
    ...base,
    ...local,
    api: { ...DEFAULTS.api, ...(base.api || {}), ...(local.api || {}) },
  };
  if (appConfig.appTitle) {
    document.title = appConfig.appTitle;
  }
  return appConfig;
}

export function getAppConfig() {
  return appConfig;
}

/** 生产：api.baseUrl；开发：api.devBaseUrl（空字符串则走 Vite /api 代理） */
export function apiBase() {
  if (import.meta.env.DEV) {
    const dev = trimBase(appConfig.api?.devBaseUrl);
    return dev;
  }
  return trimBase(appConfig.api?.baseUrl);
}
