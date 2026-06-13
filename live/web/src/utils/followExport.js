import { normalizeFollows } from "./prefStore.js";

/**
 * 关注最小导出格式：JSON 数组，每项为 [平台, 房间号] 或 [平台, 房间号, 1]（超关）
 * 例：[["douyu","252140"],["huya","660000",1]]
 */
export function serializeFollowsMinimal(follows) {
  const list = (follows || []).map((room) => {
    const site = String(room.site || "").trim();
    const id = String(room.id || "").trim();
    if (!site || !id) return null;
    if (room.super) return [site, id, 1];
    return [site, id];
  }).filter(Boolean);
  return JSON.stringify(list);
}

function rowsFromJson(data) {
  if (!Array.isArray(data)) return [];
  if (!data.length) return [];

  if (Array.isArray(data[0])) {
    return data.map((row) => ({
      site: row[0],
      id: row[1],
      super: row[2] === 1 || row[2] === true || row[2] === "super",
    }));
  }

  if (typeof data[0] === "object" && data[0]) {
    return data.map((item) => ({
      site: item.site || item.platform || item.siteId,
      id: item.id || item.roomId || item.room,
      super: Boolean(item.super),
    }));
  }

  return [];
}

function rowsFromLines(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    const jsonLine = trimmed.startsWith("[") || trimmed.startsWith("{");
    if (jsonLine) {
      try {
        out.push(...rowsFromJson(JSON.parse(trimmed)));
        continue;
      } catch {
        /* fall through */
      }
    }

    const match = trimmed.match(
      /^([a-z][a-z0-9]*)\s*[:/,\s]\s*([^\s#]+?)(?:\s+(?:\*|super|超关))?$/i,
    );
    if (!match) continue;
    const site = match[1].toLowerCase();
    const id = match[2].replace(/[,;]+$/, "");
    const superFlag = /\s+(\*|super|超关)\s*$/i.test(trimmed);
    out.push({ site, id, super: superFlag });
  }
  return out;
}

/** 解析剪贴板/文本为关注条目，无效项会被 normalize 丢弃 */
export function parseFollowsMinimal(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return normalizeFollows(rowsFromJson(data));
    if (data && Array.isArray(data.list)) return normalizeFollows(rowsFromJson(data.list));
    if (data && Array.isArray(data.follows)) return normalizeFollows(rowsFromJson(data.follows));
  } catch {
    /* 尝试行格式 */
  }

  return normalizeFollows(rowsFromLines(raw));
}
