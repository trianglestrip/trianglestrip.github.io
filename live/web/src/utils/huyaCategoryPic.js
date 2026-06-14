import { fetchCategories } from "../api/browse.js";
import {
  findCrossCategory,
  huyaCidForCrossKey,
  loadCategoryCrossMap,
} from "./categoryDisplay.js";

export const HUYA_GAME_PIC =
  "https://huyaimg.msstatic.com/cdnimage/game/{cid}-MS.jpg";

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

export function huyaPicFromCid(huyaCid) {
  const cid = String(huyaCid || "").trim();
  if (!cid) return "";
  return HUYA_GAME_PIC.replace("{cid}", cid);
}

export function buildHuyaPicIndex(huyaGroups) {
  const byCid = new Map();
  const byName = new Map();
  for (const group of huyaGroups || []) {
    for (const cat of group.list || []) {
      const pic = String(cat.pic || huyaPicFromCid(cat.cid)).trim();
      if (!pic) continue;
      byCid.set(String(cat.cid), pic);
      for (const key of nameKeys(cat.name)) {
        if (!byName.has(key)) byName.set(key, pic);
      }
    }
  }
  return { byCid, byName };
}

export function lookupHuyaPic({ huyaCid, name }, index) {
  if (huyaCid) {
    const pic = huyaPicFromCid(huyaCid);
    if (pic) return pic;
  }
  const normalized = normName(name);
  if (normalized && index?.byName?.has(normalized)) {
    return index.byName.get(normalized);
  }
  if (normalized && index?.byName) {
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

export function resolveHuyaCidForItem(site, item) {
  const entry = findCrossCategory(site, item.name, item.cid);
  if (entry?.key) return huyaCidForCrossKey(entry.key, entry.huya);
  return entry?.huya ? String(entry.huya) : "";
}

let huyaIndexCache = null;
let huyaIndexPromise = null;

export async function getHuyaPicIndex() {
  if (huyaIndexCache) return huyaIndexCache;
  if (!huyaIndexPromise) {
    huyaIndexPromise = fetchCategories("huya")
      .then((data) => {
        huyaIndexCache = buildHuyaPicIndex(data.categories);
        return huyaIndexCache;
      })
      .finally(() => {
        huyaIndexPromise = null;
      });
  }
  return huyaIndexPromise;
}

export async function prepareHuyaPicFallback() {
  await loadCategoryCrossMap();
  return getHuyaPicIndex();
}
