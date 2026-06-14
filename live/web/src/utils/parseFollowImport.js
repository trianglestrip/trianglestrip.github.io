import { normalizeFollows } from "./prefStore.js";
import { parseFollowsMinimal } from "./followExport.js";

/** 从 JSON 或逗号/换行分隔的房间号解析关注项 */
export function parseFollowImport(text, defaultSite = "douyu") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];

  if (/[a-z][a-z0-9]*\s*:\s*\[/.test(trimmed)) {
    return parseFollowsMinimal(trimmed);
  }

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
      .filter(Boolean)
      .map((s) => {
        const douyinMatch = s.match(/live\.douyin\.com\/(\d+)/i);
        if (douyinMatch) return douyinMatch[1];
        return s;
      });
    return normalizeFollows(ids.map((id) => ({ site: defaultSite, id })));
  }

  const douyinUrlMatch = trimmed.match(/live\.douyin\.com\/(\d+)/i);
  if (douyinUrlMatch) {
    return normalizeFollows([{ site: defaultSite, id: douyinUrlMatch[1] }]);
  }

  const ids = [...trimmed.matchAll(/\d{4,}/g)].map((m) => m[0]);
  return normalizeFollows(ids.map((id) => ({ site: defaultSite, id })));
}
