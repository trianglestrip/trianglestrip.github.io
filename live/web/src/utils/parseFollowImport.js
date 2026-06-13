import { normalizeFollows } from "./prefStore.js";

/** 从 JSON 或逗号/换行分隔的房间号解析关注项 */
export function parseFollowImport(text, defaultSite = "douyu") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return normalizeFollows(
        parsed.map((item) => {
          if (item && typeof item === "object") return item;
          return { site: defaultSite, id: String(item) };
        }),
      );
    }
  } catch {
    // 非 JSON
  }

  if (trimmed.includes(",") || trimmed.includes("，")) {
    const ids = trimmed
      .split(/[,，]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return normalizeFollows(ids.map((id) => ({ site: defaultSite, id })));
  }

  const ids = [...trimmed.matchAll(/\d{4,}/g)].map((m) => m[0]);
  return normalizeFollows(ids.map((id) => ({ site: defaultSite, id })));
}
