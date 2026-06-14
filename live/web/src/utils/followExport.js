import { normalizeFollows } from "./prefStore.js";

/**
 * 关注紧凑导出：douyu:[252140,6188551],huya:[660000,123*]
 * 超关房间号后缀 *，例 huya:[660000*]
 */
export function serializeFollowsMinimal(follows) {
  const siteOrder = [];
  const bySite = new Map();

  for (const room of follows || []) {
    const site = String(room.site || "").trim();
    const id = String(room.id || "").trim();
    if (!site || !id) continue;
    if (!bySite.has(site)) {
      bySite.set(site, []);
      siteOrder.push(site);
    }
    bySite.get(site).push(formatCompactId(id, room.super));
  }

  return siteOrder
    .map((site) => `${site}:[${bySite.get(site).join(",")}]`)
    .join(",");
}

function formatCompactId(id, superFollow) {
  const token = superFollow ? `${id}*` : id;
  if (/^\d+$/.test(id)) return token;
  return JSON.stringify(token);
}

function parseIdToken(token) {
  let raw = String(token || "").trim();
  if (!raw) return null;

  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }

  const superFlag = raw.endsWith("*");
  const id = superFlag ? raw.slice(0, -1).trim() : raw;
  if (!id) return null;
  return { id, super: superFlag };
}

function splitBracketItems(inner) {
  const items = [];
  let current = "";
  let inQuote = false;
  let quote = "";

  for (const ch of inner) {
    if ((ch === '"' || ch === "'") && (!inQuote || ch === quote)) {
      inQuote = !inQuote;
      quote = inQuote ? ch : "";
      current += ch;
      continue;
    }
    if (ch === "," && !inQuote) {
      if (current.trim()) items.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  if (current.trim()) items.push(current.trim());
  return items;
}

function rowsFromCompact(text) {
  const rows = [];
  const re = /([a-z][a-z0-9]*)\s*:\s*\[([^\]]*)\]/gi;
  let match = re.exec(text);
  while (match) {
    const site = match[1].toLowerCase();
    const inner = match[2].trim();
    if (inner) {
      for (const part of splitBracketItems(inner)) {
        const parsed = parseIdToken(part);
        if (parsed) rows.push({ site, id: parsed.id, super: parsed.super });
      }
    }
    match = re.exec(text);
  }
  return rows;
}

/** 解析剪贴板/文本为关注条目，无效项会被 normalize 丢弃 */
export function parseFollowsMinimal(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const compact = rowsFromCompact(raw.replace(/\r?\n/g, ","));
  return normalizeFollows(compact);
}
