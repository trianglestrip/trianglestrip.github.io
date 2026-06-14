import { fetchCategories } from "../api/browse.js";
import { findCrossCategory, loadCategoryCrossMap } from "./categoryDisplay.js";

function normName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[：:!！?？·]/g, "")
    .replace(/[\s\u3000]+/g, "");
}

function nameKeys(name) {
  const keys = new Set();
  const normalized = normName(name);
  if (normalized) keys.add(normalized);
  const head = String(name || "").split(/[：:]/)[0]?.trim();
  if (head) keys.add(normName(head));
  return [...keys].filter(Boolean);
}

export function buildDouyuPicIndex(douyuGroups) {
  const byCid = new Map();
  const byName = new Map();
  for (const group of douyuGroups || []) {
    for (const cat of group.list || []) {
      const pic = String(cat.pic || "").trim();
      if (!pic) continue;
      byCid.set(String(cat.cid), pic);
      for (const key of nameKeys(cat.name)) {
        if (!byName.has(key)) byName.set(key, pic);
      }
    }
  }
  return { byCid, byName };
}

export function lookupDouyuPic({ douyuCid, name }, index) {
  if (douyuCid) {
    const pic = index.byCid.get(String(douyuCid));
    if (pic) return pic;
  }
  const normalized = normName(name);
  if (normalized && index.byName.has(normalized)) {
    return index.byName.get(normalized);
  }
  if (normalized) {
    let best = "";
    let bestLen = 0;
    for (const [key, pic] of index.byName) {
      if (key.length < 2) continue;
      let matchLen = 0;
      if (normalized.includes(key)) matchLen = key.length;
      else if (key.includes(normalized)) matchLen = normalized.length;
      if (matchLen > bestLen) {
        bestLen = matchLen;
        best = pic;
      }
    }
    if (best) return best;
  }
  return "";
}

export function resolveDouyuCidForItem(site, item) {
  const entry = findCrossCategory(site, item.name, item.cid);
  return entry?.douyu ? String(entry.douyu) : "";
}

export function withDouyuFallbackPic(item, site, index) {
  const current = String(item.pic || "").trim();
  if (current) return item;
  const douyuCid =
    site === "douyu" ? String(item.cid || "") : resolveDouyuCidForItem(site, item);
  const pic = lookupDouyuPic({ douyuCid, name: item.name }, index);
  return pic ? { ...item, pic } : item;
}

export function enrichGroupsWithDouyuPic(groups, site, index) {
  if (!index || site === "douyu") return groups;
  return (groups || []).map((group) => ({
    ...group,
    list: (group.list || []).map((item) => withDouyuFallbackPic(item, site, index)),
  }));
}

let douyuIndexCache = null;
let douyuIndexPromise = null;

export async function getDouyuPicIndex() {
  if (douyuIndexCache) return douyuIndexCache;
  if (!douyuIndexPromise) {
    douyuIndexPromise = fetchCategories("douyu")
      .then((data) => {
        douyuIndexCache = buildDouyuPicIndex(data.categories);
        return douyuIndexCache;
      })
      .finally(() => {
        douyuIndexPromise = null;
      });
  }
  return douyuIndexPromise;
}

export async function prepareDouyuPicFallback() {
  await loadCategoryCrossMap();
  return getDouyuPicIndex();
}
