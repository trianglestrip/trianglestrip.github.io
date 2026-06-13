import { createRequire } from 'module';const require=createRequire(import.meta.url);

// dist/index.js
import { createServer } from "node:http";
import { URL as URL3 } from "node:url";

// dist/cache/resolve-cache.js
var PAYLOAD_TTL = 20;
var TIER_TTL = 20;
var META_TTL = 180;
var DEFAULT_TTL = PAYLOAD_TTL;
var MAX_ENTRIES = 100;
function now() {
  return performance.now() / 1e3;
}
function metaKey(site, roomId) {
  return `meta:${site}:${roomId}`;
}
function tierKey(site, roomId, qualityName) {
  return `tier:${site}:${roomId}:${qualityName}`;
}
function payloadKey(site, roomId, mode, qualityKey) {
  return `payload:${site}:${roomId}:${mode}:${qualityKey}`;
}
var ResolveCache = class {
  entries = /* @__PURE__ */ new Map();
  order = [];
  purgeExpired() {
    const t = now();
    for (const key of [...this.order]) {
      const entry = this.entries.get(key);
      if (!entry || t >= entry.expires) {
        this.entries.delete(key);
        this.order = this.order.filter((k) => k !== key);
      }
    }
  }
  evictIfNeeded() {
    while (this.order.length > MAX_ENTRIES) {
      const oldest = this.order.shift();
      if (oldest) {
        this.entries.delete(oldest);
      }
    }
  }
  get(key) {
    this.purgeExpired();
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (now() >= entry.expires) {
      this.entries.delete(key);
      this.order = this.order.filter((k) => k !== key);
      return null;
    }
    this.order = this.order.filter((k) => k !== key);
    this.order.push(key);
    return structuredClone(entry.data);
  }
  set(key, data, opts) {
    const ttl = opts?.ttl ?? DEFAULT_TTL;
    this.purgeExpired();
    this.entries.delete(key);
    this.order = this.order.filter((k) => k !== key);
    this.entries.set(key, { data: structuredClone(data), expires: now() + ttl });
    this.order.push(key);
    this.evictIfNeeded();
  }
  stats() {
    this.purgeExpired();
    return {
      entries: this.entries.size,
      max_entries: MAX_ENTRIES,
      ttl_sec: {
        meta: META_TTL,
        tier: TIER_TTL,
        payload: PAYLOAD_TTL
      }
    };
  }
  getMeta(site, roomId) {
    const data = this.get(metaKey(site, roomId));
    return data && typeof data === "object" ? data : null;
  }
  setMeta(site, roomId, meta) {
    this.set(metaKey(site, roomId), meta, { ttl: META_TTL });
  }
  getTier(site, roomId, qualityName) {
    const data = this.get(tierKey(site, roomId, qualityName));
    return data && typeof data === "object" ? data : null;
  }
  setTier(site, roomId, qualityName, tier) {
    this.set(tierKey(site, roomId, qualityName), tier, { ttl: TIER_TTL });
  }
  getPayload(site, roomId, mode, qualityKey) {
    const data = this.get(payloadKey(site, roomId, mode, qualityKey));
    return data && typeof data === "object" ? data : null;
  }
  setPayload(site, roomId, mode, qualityKey, payload) {
    this.set(payloadKey(site, roomId, mode, qualityKey), payload, { ttl: PAYLOAD_TTL });
  }
};

// dist/middleware/sanitize-json.js
function sanitizeUnicode(value) {
  if (typeof value === "string") {
    return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnicode(item));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeUnicode(v);
    }
    return out;
  }
  return value;
}

// dist/utils/format-online.js
function formatOnline(count) {
  let value;
  try {
    value = Number(count ?? 0);
    if (Number.isNaN(value)) {
      return "";
    }
  } catch {
    return "";
  }
  if (value >= 1e4) {
    return `${(value / 1e4).toFixed(1)}\u4E07`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}\u5343`;
  }
  if (value > 0) {
    return String(Math.trunc(value));
  }
  return "";
}

// dist/browse/douyu.js
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var DOUYU_HEADERS = {
  "User-Agent": USER_AGENT,
  Referer: "https://www.douyu.com/"
};
var cate2NameCache = null;
async function getJson(url, params) {
  const u = new URL(url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(u, { headers: DOUYU_HEADERS, signal: AbortSignal.timeout(2e4) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json();
}
async function fetchDouyuCategories() {
  const data = await getJson("https://m.douyu.com/api/cate/list");
  const payload = data.data || {};
  const cate1 = Object.fromEntries((payload.cate1Info || []).map((item) => [
    item.cate1Id,
    item.cate1Name
  ]));
  const grouped = /* @__PURE__ */ new Map();
  for (const item of payload.cate2Info || []) {
    const cate1Id = Number(item.cate1Id);
    let group = grouped.get(cate1Id);
    if (!group) {
      group = {
        id: String(cate1Id),
        name: cate1[cate1Id] || "\u5206\u7C7B",
        list: []
      };
      grouped.set(cate1Id, group);
    }
    group.list.push({
      cid: Number(item.cate2Id),
      name: String(item.cate2Name || ""),
      pic: String(item.pic || item.icon || "")
    });
  }
  return [...grouped.values()].filter((g) => g.list.length > 0);
}
async function douyuCate2Names() {
  if (!cate2NameCache) {
    const mapping = {};
    for (const group of await fetchDouyuCategories()) {
      for (const item of group.list) {
        mapping[String(item.cid)] = item.name;
      }
    }
    cate2NameCache = mapping;
  }
  return cate2NameCache;
}
function douyuOnline(item) {
  const hn = item.hn;
  if (hn) {
    const text = String(hn).trim();
    if (text) {
      return text;
    }
  }
  return formatOnline(item.online ?? item.viewerCount);
}
async function douyuCategory(item) {
  const name = item.cate2Name || item.gameName || item.cate3Name;
  if (name) {
    return String(name);
  }
  const cid = item.cate2Id ?? item.cate1Id;
  if (cid != null) {
    const names = await douyuCate2Names();
    return names[String(cid)] || "";
  }
  return "";
}
function normalizeDouyuRoom(item) {
  return {
    roomId: String(item.rid || ""),
    siteId: "douyu",
    status: Boolean(item.isLive ?? item.showStatus ?? 1),
    title: String(item.roomName || ""),
    nickname: String(item.nickname || item.ownerName || ""),
    cid: String(item.cate2Id || item.cate1Id || ""),
    category: "",
    online: douyuOnline(item),
    cover: String(item.roomSrc || item.verticalSrc || "")
  };
}
async function enrichDouyuRoom(item) {
  const room = normalizeDouyuRoom(item);
  room.category = await douyuCategory(item);
  return room;
}
async function fetchDouyuRooms(cid, page, limit = 30) {
  const params = { page, limit };
  if (cid != null && String(cid) !== "" && String(cid) !== "0") {
    params.cate2Id = cid;
  }
  const data = await getJson("https://m.douyu.com/api/room/list", params);
  const payload = data.data || {};
  const items = payload.list || [];
  const pageCount = Number(payload.pageCount || 1);
  const nowPage = Number(payload.nowPage || page);
  let hasMore = payload.hasMore;
  if (hasMore == null) {
    hasMore = nowPage < pageCount;
  }
  const list = [];
  for (const item of items) {
    const room = await enrichDouyuRoom(item);
    if (room.roomId) {
      list.push(room);
    }
  }
  return {
    list,
    hasMore: Boolean(hasMore),
    page: nowPage
  };
}

// dist/browse/huya.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.huya.com/"
};
var HUYA_GAME_PIC = "https://huyaimg.msstatic.com/cdnimage/game/{cid}-MS.jpg";
var HUYA_CATEGORY_GROUPS = [
  {
    id: "1",
    name: "\u70ED\u95E8",
    list: [
      { cid: 1, name: "\u82F1\u96C4\u8054\u76DF" },
      { cid: 862, name: "CS2" },
      { cid: 2336, name: "\u738B\u8005\u8363\u8000" },
      { cid: 3203, name: "\u548C\u5E73\u7CBE\u82F1" },
      { cid: 5937, name: "\u65E0\u754F\u5951\u7EA6" },
      { cid: 5485, name: "lol\u4E91\u9876\u4E4B\u5F08" },
      { cid: 4, name: "\u7A7F\u8D8A\u706B\u7EBF" },
      { cid: 393, name: "\u7089\u77F3\u4F20\u8BF4" },
      { cid: 7, name: "DOTA2" },
      { cid: 2, name: "\u5730\u4E0B\u57CE\u4E0E\u52C7\u58EB" },
      { cid: 802, name: "\u5766\u514B\u4E16\u754C" },
      { cid: 897, name: "\u661F\u79C0" },
      { cid: 1964, name: "\u4E00\u8D77\u770B" }
    ]
  }
];
function huyaPic(cid) {
  return HUYA_GAME_PIC.replace("{cid}", String(cid));
}
async function getJson2(url, params) {
  const u = new URL(url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(u, { headers: HEADERS, signal: AbortSignal.timeout(2e4) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json();
}
function normalizeHuyaRoom(item) {
  const roomId = item.lProfileRoom ?? item.lChannel ?? item.lUid;
  let cover = String(item.sScreenshot || item.sPreviewUrl || "");
  if (cover.startsWith("//")) {
    cover = `https:${cover}`;
  }
  return {
    roomId: String(roomId || ""),
    siteId: "huya",
    status: true,
    title: String(item.sIntroduction || item.sRoomName || ""),
    nickname: String(item.sNick || ""),
    cid: String(item.iGid ?? item.iGameId ?? ""),
    category: String(item.sGameFullName || ""),
    online: formatOnline(item.lTotalCount ?? item.lUserCount),
    cover
  };
}
async function fetchHuyaCategories() {
  const groups = [];
  for (const group of HUYA_CATEGORY_GROUPS) {
    const items = group.list.map((item) => ({
      cid: item.cid,
      name: item.name,
      pic: huyaPic(item.cid)
    }));
    groups.push({ id: group.id, name: group.name, list: items });
  }
  return groups;
}
async function fetchHuyaLiveList(gid, page, pageSize = 120) {
  const data = await getJson2("https://live.huya.com/liveHttpUI/getLiveList", {
    iGid: gid,
    iPageNo: page,
    iPageSize: pageSize
  });
  const items = data.vList || [];
  const totalPage = Number(data.iTotalPage || 1);
  const list = items.map((item) => normalizeHuyaRoom(item)).filter((room) => room.roomId);
  return {
    list,
    hasMore: page < totalPage,
    page
  };
}

// dist/browse/index.js
var browseApi = {
  async fetchCategories(site) {
    if (site === "huya") {
      return sanitizeUnicode(await fetchHuyaCategories());
    }
    if (site === "douyu") {
      return sanitizeUnicode(await fetchDouyuCategories());
    }
    throw new Error(`\u6682\u4E0D\u652F\u6301\u5E73\u53F0: ${site}`);
  },
  async fetchRecommendRooms(site, page) {
    if (site === "huya") {
      return sanitizeUnicode(await fetchHuyaLiveList(0, page));
    }
    if (site === "douyu") {
      return sanitizeUnicode(await fetchDouyuRooms(null, page));
    }
    throw new Error(`\u6682\u4E0D\u652F\u6301\u5E73\u53F0: ${site}`);
  },
  async fetchCategoryRooms(site, cid, page, pid) {
    void pid;
    if (site === "huya") {
      const result = await fetchHuyaLiveList(cid, page);
      return sanitizeUnicode({ ...result, cid: String(cid) });
    }
    if (site === "douyu") {
      const result = await fetchDouyuRooms(cid, page);
      return sanitizeUnicode({ ...result, cid: String(cid) });
    }
    throw new Error(`\u6682\u4E0D\u652F\u6301\u5E73\u53F0: ${site}`);
  }
};

// dist/config/load-config.js
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 8765,
  cors: {
    enabled: true,
    allowOrigin: "*"
  },
  static: {
    enabled: false,
    distPath: "../dist/web"
  }
};
function deepMerge(base, patch) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    const existing = out[key];
    if (value && typeof value === "object" && !Array.isArray(value) && existing && typeof existing === "object") {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
function readJsonFile(filePath) {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}
function appRoot() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  if (existsSync(path.join(scriptDir, "config.json"))) {
    return scriptDir;
  }
  const parent = path.dirname(scriptDir);
  if (existsSync(path.join(parent, "config.json"))) {
    return parent;
  }
  return parent;
}
function loadConfig(configPath) {
  const root = appRoot();
  const pathToUse = configPath ? path.resolve(configPath) : path.join(root, "config.json");
  let cfg = structuredClone(DEFAULT_CONFIG);
  if (existsSync(pathToUse)) {
    cfg = deepMerge(cfg, readJsonFile(pathToUse));
  }
  const local = path.join(path.dirname(pathToUse), "config.local.json");
  if (existsSync(local)) {
    cfg = deepMerge(cfg, readJsonFile(local));
  }
  return cfg;
}
function resolveStaticRoot(cfg) {
  const staticCfg = cfg.static || {};
  if (!staticCfg.enabled) {
    return null;
  }
  const raw = staticCfg.distPath || "../dist/web";
  const root = path.resolve(appRoot(), raw);
  const index = path.join(root, "index.html");
  return existsSync(index) ? root : null;
}

// dist/http/handler.js
import { URL as URL2 } from "node:url";

// dist/resolve/parse-room-id.js
var ROOM_RES = {
  douyu: /(?:douyu\.com\/)?(\d+)$/,
  huya: /(?:huya\.com\/)?(\d+)$/
};
function parseRoomId(value, site = "douyu") {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return text;
  }
  const cleaned = text.replace(/^https?:\/\//, "");
  const pattern = ROOM_RES[site] || ROOM_RES.douyu;
  const match = cleaned.match(pattern);
  if (match) {
    return match[1];
  }
  throw new Error(`\u65E0\u6548\u623F\u95F4\u53F7: ${value}`);
}

// dist/resolve/timing.js
function wallResolve(resolveService, site, room, quality, force) {
  const t0 = performance.now();
  return resolveService.resolveRoom({ site, roomId: room, mode: "lazy", quality, force }).then((payload) => {
    const wallMs = Math.trunc(performance.now() - t0);
    const timing = payload._timing || {};
    return {
      wall_ms: wallMs,
      timing,
      cached: Boolean(payload.cached),
      cached_meta: Boolean(timing.meta_cached),
      cached_tier: Boolean(timing.tier_cached),
      payload_cached: Boolean(timing.payload_cached),
      anchor: String(payload.anchor_name || payload.title || ""),
      is_live: payload.is_live
    };
  });
}
function buildTimeReport(resolveService, cache, site, room, opts) {
  const quality = opts?.quality;
  const run = opts?.run ?? false;
  const report = {
    ok: true,
    server_time: (/* @__PURE__ */ new Date()).toISOString(),
    cache: cache.stats(),
    params: {
      site,
      room,
      quality: quality || "",
      run
    }
  };
  if (!run) {
    return Promise.resolve(report);
  }
  return Promise.all([
    wallResolve(resolveService, site, room, quality, true),
    wallResolve(resolveService, site, room, quality, false)
  ]).then(([cold, warm]) => {
    report.benchmark = {
      site,
      room,
      quality: quality || "",
      runs: [
        { label: "cold", desc: "force=1 \u8DF3\u8FC7\u7F13\u5B58", ...cold },
        { label: "warm", desc: "\u547D\u4E2D payload \u7F13\u5B58", ...warm }
      ]
    };
    return report;
  });
}

// dist/resolve/douyu/betard.js
var USER_AGENT2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS2 = {
  "User-Agent": USER_AGENT2,
  Referer: "https://www.douyu.com/"
};
async function getRoomId(url) {
  const ridMatch = url.match(/douyu\.com\/(\d+)/) || url.match(/rid=(\d+)/);
  if (ridMatch) {
    return ridMatch[1];
  }
  const path3 = url.split("douyu.com/")[1]?.split("?")[0]?.split("/")[0];
  if (!path3) {
    throw new Error(`\u65E0\u6548\u7684\u6597\u9C7C\u5730\u5740: ${url}`);
  }
  const res = await fetch(`https://m.douyu.com/${path3}`, {
    headers: HEADERS2,
    signal: AbortSignal.timeout(2e4)
  });
  const html = await res.text();
  const match = html.match(/"rid":(\d+)/);
  if (!match) {
    throw new Error(`\u65E0\u6CD5\u89E3\u6790\u623F\u95F4\u53F7: ${url}`);
  }
  return match[1];
}
async function fetchBetard(rid) {
  const res = await fetch(`https://www.douyu.com/betard/${rid}`, {
    headers: HEADERS2,
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) {
    throw new Error(`betard HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.room;
}
function coverFromRoom(room) {
  let cover = String(room.room_pic || room.coverSrc || "").trim();
  if (!cover) {
    const src = String(room.room_src || "").trim();
    if (src.startsWith("//")) {
      cover = `https:${src}`;
    } else if (src.startsWith("http")) {
      cover = src;
    } else if (src) {
      cover = `https://rpic.douyucdn.cn/${src.replace(/^\//, "")}`;
    }
  } else if (cover.startsWith("//")) {
    cover = `https:${cover}`;
  }
  return cover;
}

// dist/follow/status.js
var STATUS_ORDER = { live: 0, replay: 1, offline: 2 };
var HUYA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/"
};
function httpsUrl(text) {
  const value = String(text || "").trim();
  if (!value)
    return "";
  if (value.startsWith("//"))
    return `https:${value}`;
  return value;
}
function avatarFromDouyu(room) {
  const avatar = room.avatar;
  if (avatar && typeof avatar === "object") {
    const obj = avatar;
    return httpsUrl(String(obj.big || obj.middle || obj.small || ""));
  }
  return httpsUrl(String(avatar || ""));
}
function douyuState(room) {
  const showStatus = Number(room.show_status || 0);
  if (showStatus === 1)
    return "live";
  if (showStatus === 2)
    return "replay";
  return "offline";
}
function huyaState(data) {
  const statusRaw = String(data.liveStatus || data.realLiveStatus || "").toUpperCase();
  if (statusRaw === "ON")
    return "live";
  if (statusRaw === "REPLAY" || statusRaw === "VOD")
    return "replay";
  const liveData = data.liveData || {};
  if (liveData.isReplay === 1 || liveData.isReplay === "1" || liveData.isReplay === true) {
    return "replay";
  }
  return "offline";
}
function avatarFromHuya(profile) {
  return httpsUrl(String(profile.avatar180 || profile.avatar || ""));
}
async function fetchDouyuSnapshot(roomId) {
  const rid = String(roomId).trim();
  const room = await fetchBetard(rid);
  const raw = room;
  return {
    site: "douyu",
    id: rid,
    state: douyuState(raw),
    avatar: avatarFromDouyu(raw),
    cover: coverFromRoom(room),
    title: String(room.room_name || room.nickname || ""),
    anchor: String(room.nickname || "")
  };
}
async function fetchHuyaSnapshot(roomId) {
  const rid = String(roomId).trim();
  const url = new URL("https://mp.huya.com/cache.php");
  url.searchParams.set("m", "Live");
  url.searchParams.set("do", "profileRoom");
  url.searchParams.set("roomid", rid);
  url.searchParams.set("showSecret", "1");
  const res = await fetch(url, { headers: HUYA_HEADERS, signal: AbortSignal.timeout(12e3) });
  if (!res.ok) {
    throw new Error(`\u864E\u7259\u623F\u95F4\u4FE1\u606F HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (Number(payload.status || 0) !== 200) {
    throw new Error(String(payload.message || "\u864E\u7259\u623F\u95F4\u4FE1\u606F\u83B7\u53D6\u5931\u8D25"));
  }
  const data = payload.data || {};
  const profile = data.profileInfo || {};
  const liveData = data.liveData || {};
  return {
    site: "huya",
    id: rid,
    state: huyaState(data),
    avatar: avatarFromHuya(profile),
    cover: httpsUrl(String(liveData.screenshot || liveData.cover || "")),
    title: String(liveData.introduction || liveData.gameHostName || profile.nick || ""),
    anchor: String(profile.nick || "")
  };
}
function emptySnapshot(site, id) {
  return { site, id, state: "offline", avatar: "", cover: "", title: "", anchor: "" };
}
async function fetchOne(site, roomId) {
  const normalizedSite = String(site || "").trim();
  const rid = String(roomId || "").trim();
  if (!normalizedSite || !rid) {
    return emptySnapshot(normalizedSite, rid);
  }
  try {
    if (normalizedSite === "douyu")
      return await fetchDouyuSnapshot(rid);
    if (normalizedSite === "huya")
      return await fetchHuyaSnapshot(rid);
  } catch {
  }
  return emptySnapshot(normalizedSite, rid);
}
async function fetchFollowSnapshots(rooms) {
  const tasks = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of rooms || []) {
    const site = String(item.site || "").trim();
    const id = String(item.id || item.roomId || "").trim();
    const key = `${site}:${id}`;
    if (!site || !id || seen.has(key))
      continue;
    seen.add(key);
    tasks.push(fetchOne(site, id));
  }
  const results = await Promise.all(tasks);
  return results.sort((a, b) => {
    const byState = (STATUS_ORDER[a.state] ?? 9) - (STATUS_ORDER[b.state] ?? 9);
    if (byState !== 0)
      return byState;
    return a.site.localeCompare(b.site) || a.id.localeCompare(b.id);
  });
}

// dist/danmaku/huya.js
var HEADERS3 = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/"
};
async function fetchHuyaDanmakuSession(roomId) {
  const room = String(roomId).trim();
  if (!/^\d+$/.test(room)) {
    throw new Error(`\u65E0\u6548\u864E\u7259\u623F\u95F4\u53F7: ${roomId}`);
  }
  const url = new URL("https://mp.huya.com/cache.php");
  url.searchParams.set("m", "Live");
  url.searchParams.set("do", "profileRoom");
  url.searchParams.set("roomid", room);
  url.searchParams.set("showSecret", "1");
  const res = await fetch(url, { headers: HEADERS3, signal: AbortSignal.timeout(12e3) });
  if (!res.ok) {
    throw new Error(`\u864E\u7259\u623F\u95F4\u4FE1\u606F HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (Number(payload.status || 0) !== 200) {
    throw new Error(payload.message || "\u864E\u7259\u623F\u95F4\u4FE1\u606F\u83B7\u53D6\u5931\u8D25");
  }
  const data = payload.data || {};
  const stream = data.stream || {};
  const baseList = stream.baseSteamInfoList || [];
  const profile = data.profileInfo || {};
  const liveData = data.liveData || {};
  const ayyuid = Number(profile.yyid || liveData.yyid || 0);
  let topSid = 0;
  if (baseList.length) {
    topSid = Number(baseList[0]?.lChannelId || 0);
  }
  if (!topSid) {
    topSid = Number(liveData.liveChannel || liveData.channel || 0);
  }
  if (!ayyuid || !topSid) {
    throw new Error("\u623F\u95F4\u672A\u5F00\u64AD\u6216\u7F3A\u5C11\u5F39\u5E55\u8FDE\u63A5\u53C2\u6570");
  }
  return {
    room_id: room,
    ayyuid,
    topSid,
    is_live: String(data.liveStatus || "").toUpperCase() === "ON"
  };
}

// dist/middleware/cors.js
function applyCorsHeaders(headers, cors) {
  if (cors?.enabled === false) {
    return;
  }
  headers["Access-Control-Allow-Origin"] = cors?.allowOrigin || "*";
  headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type";
  headers["Access-Control-Allow-Private-Network"] = "true";
}

// dist/http/json.js
function sendJson(res, config, payload, status = 200) {
  const data = JSON.stringify(sanitizeUnicode(payload));
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data)
  };
  applyCorsHeaders(headers, config.cors);
  res.writeHead(status, headers);
  res.end(data);
}
function createJsonSender(config) {
  return (res, payload, status = 200) => sendJson(res, config, payload, status);
}

// dist/http/handler.js
function queryBool(value, truthy = ["1", "true", "yes"]) {
  return truthy.includes((value || "").toLowerCase());
}
function readQuery(req) {
  const url = new URL2(req.url || "/", "http://localhost");
  return url.searchParams;
}
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) {
    return {};
  }
  return JSON.parse(body);
}
function finalizePayload(payload) {
  payload.ok = true;
  return payload;
}
async function handleApi(req, res, ctx) {
  const url = new URL2(req.url || "/", "http://localhost");
  const pathname = url.pathname;
  if (pathname === "/api/health" && req.method === "GET") {
    const staticCfg = ctx.config.static || {};
    sendJson(res, ctx.config, {
      ok: true,
      mode: ctx.webRoot ? "static+api" : "api-only",
      host: ctx.config.host,
      port: ctx.config.port,
      static_enabled: Boolean(staticCfg.enabled),
      static_root: ctx.webRoot,
      browse_api: true,
      resolve_cache: ctx.cache.stats()
    });
    return true;
  }
  if (pathname === "/api/room" && req.method === "GET") {
    const query = readQuery(req);
    const site = query.get("site") || "douyu";
    const room = query.get("room") || query.get("id") || "9999";
    const mode = query.get("mode") || "lazy";
    const quality = query.get("quality") || null;
    const force = queryBool(query.get("force"));
    try {
      const roomId = parseRoomId(room, site);
      const payload = await ctx.resolveService.resolveRoom({
        site,
        roomId,
        mode,
        quality,
        force
      });
      if (!payload.is_live && !payload.status) {
        sendJson(res, ctx.config, { ok: false, error: "\u623F\u95F4\u672A\u5F00\u64AD" }, 404);
        return true;
      }
      sendJson(res, ctx.config, finalizePayload(payload));
    } catch (err) {
      sendJson(res, ctx.config, { ok: false, error: String(err) }, 500);
    }
    return true;
  }
  if (pathname === "/api/resolve" && req.method === "POST") {
    const query = readQuery(req);
    let data;
    try {
      data = await readJsonBody(req);
    } catch {
      sendJson(res, ctx.config, { ok: false, error: "\u65E0\u6548 JSON" }, 400);
      return true;
    }
    const room = String(data.room ?? query.get("room") ?? "9999");
    const site = String(data.site ?? query.get("site") ?? "douyu");
    try {
      const roomId = parseRoomId(room, site);
      const mode = String(data.mode ?? query.get("mode") ?? "lazy");
      const quality = String(data.quality ?? query.get("quality") ?? "") || null;
      const force = queryBool(String(data.force ?? query.get("force") ?? "0"));
      const payload = await ctx.resolveService.resolveRoom({
        site,
        roomId,
        mode,
        quality,
        force
      });
      sendJson(res, ctx.config, finalizePayload(payload));
    } catch (err) {
      sendJson(res, ctx.config, { ok: false, error: String(err) }, 500);
    }
    return true;
  }
  if (pathname === "/api/categories" && req.method === "GET") {
    const site = readQuery(req).get("site") || "douyu";
    const cacheKey = `browse:categories:${site}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached) {
      sendJson(res, ctx.config, { ok: true, site, categories: cached, cached: true });
      return true;
    }
    try {
      const categories = await ctx.browseApi.fetchCategories(site);
      ctx.cache.set(cacheKey, categories, { ttl: 300 });
      sendJson(res, ctx.config, { ok: true, site, categories });
    } catch (err) {
      sendJson(res, ctx.config, { ok: false, error: String(err) }, 500);
    }
    return true;
  }
  if (pathname === "/api/rooms" && req.method === "GET") {
    const query = readQuery(req);
    const site = query.get("site") || "douyu";
    const page = Number(query.get("page") || "1") || 1;
    const cid = query.get("cid") || query.get("id") || "";
    const pid = query.get("pid") || void 0;
    const recommend = queryBool(query.get("recommend"));
    const cacheKey = `browse:rooms:${site}:${recommend ? "rec" : cid}:${pid || ""}:${page}`;
    const cached = ctx.cache.get(cacheKey);
    if (cached && typeof cached === "object") {
      sendJson(res, ctx.config, { ok: true, site, ...cached, cached: true });
      return true;
    }
    try {
      let payload;
      if (recommend) {
        payload = await ctx.browseApi.fetchRecommendRooms(site, page);
      } else {
        if (!cid) {
          sendJson(res, ctx.config, { ok: false, error: "\u7F3A\u5C11 cid \u53C2\u6570" }, 400);
          return true;
        }
        payload = await ctx.browseApi.fetchCategoryRooms(site, cid, page, pid);
      }
      const result = {
        list: payload.list || [],
        hasMore: Boolean(payload.hasMore),
        page
      };
      if (!recommend) {
        result.cid = cid;
        if (pid) {
          result.pid = pid;
        }
      }
      ctx.cache.set(cacheKey, result, { ttl: 60 });
      sendJson(res, ctx.config, { ok: true, site, ...result });
    } catch (err) {
      sendJson(res, ctx.config, { ok: false, error: String(err) }, 500);
    }
    return true;
  }
  if (pathname === "/api/follows/status" && req.method === "POST") {
    let data;
    try {
      data = await readJsonBody(req);
    } catch {
      sendJson(res, ctx.config, { ok: false, error: "\u65E0\u6548 JSON" }, 400);
      return true;
    }
    const rooms = data.rooms;
    if (!Array.isArray(rooms)) {
      sendJson(res, ctx.config, { ok: false, error: "\u7F3A\u5C11 rooms \u6570\u7EC4" }, 400);
      return true;
    }
    try {
      const list = await fetchFollowSnapshots(rooms);
      sendJson(res, ctx.config, { ok: true, list });
    } catch (err) {
      sendJson(res, ctx.config, { ok: false, error: String(err) }, 500);
    }
    return true;
  }
  if (pathname === "/api/huya/danmaku" && req.method === "GET") {
    const query = readQuery(req);
    const room = query.get("room") || query.get("id") || "";
    if (!room) {
      sendJson(res, ctx.config, { ok: false, error: "\u7F3A\u5C11 room \u53C2\u6570" }, 400);
      return true;
    }
    try {
      const session = await fetchHuyaDanmakuSession(room);
      sendJson(res, ctx.config, { ok: true, ...session });
    } catch (err) {
      sendJson(res, ctx.config, { ok: false, error: String(err) }, 500);
    }
    return true;
  }
  if (pathname === "/api/time" && req.method === "GET") {
    const query = readQuery(req);
    const site = query.get("site") || "douyu";
    const room = query.get("room") || query.get("id") || "252140";
    const quality = query.get("quality") || null;
    const run = queryBool(query.get("run"));
    try {
      const roomId = parseRoomId(room, site);
      const payload = await buildTimeReport(ctx.resolveService, ctx.cache, site, roomId, {
        quality,
        run
      });
      sendJson(res, ctx.config, payload);
    } catch (err) {
      sendJson(res, ctx.config, { ok: false, error: String(err) }, 500);
    }
    return true;
  }
  return false;
}
function handleOptions(res, config) {
  const headers = {};
  applyCorsHeaders(headers, config.cors);
  res.writeHead(204, headers);
  res.end();
}

// dist/resolve/schema.js
function pickQualityName(items, qualityName) {
  if (qualityName) {
    for (const item of items) {
      const name = String(item.name || "");
      if (qualityName === name || qualityName.includes(name) || name.includes(qualityName)) {
        return item;
      }
    }
  }
  for (const item of items) {
    const name = String(item.name || "");
    if (["\u9AD8\u6E05", "\u8D85\u6E05", "\u84DD\u5149"].some((tag) => name.includes(tag))) {
      return item;
    }
  }
  return items[0];
}
function fetchedAtIso() {
  const d = /* @__PURE__ */ new Date();
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const tz = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:${s}${tz}`;
}
function buildRoomPayload(meta, tiers, opts) {
  if (!tiers.length) {
    throw new Error("\u672A\u83B7\u53D6\u5230\u53EF\u64AD\u653E\u5730\u5740");
  }
  let active = tiers[0];
  if (opts?.activeQuality) {
    const matched = tiers.find((tier) => tier.name === opts.activeQuality);
    if (matched) {
      active = matched;
    }
  }
  const playUrl = active.play_url || active.lines[0]?.url || "";
  const backupUrls = tiers.flatMap((tier) => tier.lines || []).map((line) => line.url).filter((url) => url && url !== playUrl);
  const payload = {
    source_url: meta.source_url,
    source: opts?.source || "streamget",
    fetched_at: fetchedAtIso(),
    platform: meta.site,
    site: meta.site,
    room_id: meta.room_id,
    anchor_name: meta.anchor_name || "",
    title: meta.title || meta.anchor_name || "",
    cover: meta.cover || "",
    is_live: true,
    status: true,
    streams: tiers.map((tier) => ({ name: tier.name, lines: tier.lines })),
    available_qualities: meta.available_qualities || [],
    play_url: playUrl,
    flv_url: playUrl,
    m3u8_url: meta.m3u8_url || "",
    backup_urls: backupUrls,
    meta: {
      site: meta.site,
      room_id: meta.room_id,
      title: meta.title || "",
      anchor_name: meta.anchor_name || "",
      cover: meta.cover || "",
      is_live: true,
      available_qualities: meta.available_qualities || []
    },
    ok: true
  };
  if (opts?.partial) {
    payload.partial = true;
    payload.quality = active.name;
  }
  return payload;
}

// dist/resolve/douyu/encryption.js
import { createHash } from "node:crypto";
var DEFAULT_DID = "10000000000000000000000000001501";
var USER_AGENT3 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
function md5(text) {
  return createHash("md5").update(text).digest("hex");
}
async function fetchWhiteKey() {
  const url = `https://www.douyu.com/wgapi/livenc/liveweb/websec/getEncryption?did=${DEFAULT_DID}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT3 },
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) {
    throw new Error(`getEncryption HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error !== 0 || !data.data) {
    throw new Error("\u83B7\u53D6\u767D\u540D\u5355\u5BC6\u94A5\u5931\u8D25");
  }
  return data.data;
}
function computeAuth(rid, white, ts) {
  let secret = white.rand_str;
  const salt = white.is_special ? "" : `${rid}${ts}`;
  for (let i = 0; i < white.enc_time; i++) {
    secret = md5(secret + white.key);
  }
  return md5(secret + white.key + salt);
}

// dist/resolve/douyu/play-v1.js
var USER_AGENT4 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var VER = "219032101";
async function fetchH5PlayV1(rid, rate, white, cdn = "hw-h5") {
  const ts = Math.floor(Date.now() / 1e3);
  const auth = computeAuth(rid, white, ts);
  const body = new URLSearchParams({
    rate,
    ver: VER,
    iar: "0",
    ive: "0",
    rid,
    hevc: "0",
    fa: "0",
    sov: "0",
    enc_data: white.enc_data,
    tt: String(ts),
    did: DEFAULT_DID,
    auth,
    cdn
  });
  const res = await fetch(`https://playweb.douyucdn.cn/lapi/live/getH5PlayV1/${rid}`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT4,
      Referer: "https://www.douyu.com/",
      Origin: "https://www.douyu.com",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString(),
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) {
    throw new Error(`getH5PlayV1 HTTP ${res.status}`);
  }
  return await res.json();
}
function flvFromApiData(data) {
  return `${data.rtmp_url}/${data.rtmp_live}`;
}
function isDouyucdnUrl(url) {
  return Boolean(url) && url.includes("douyucdn") && !url.includes("edgesrv.com");
}

// dist/resolve/douyu/normalize.js
function normalizeUrl(value) {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return `https://www.douyu.com/${text}`;
  }
  if (!text.includes("douyu.com")) {
    throw new Error(`\u65E0\u6548\u7684\u6597\u9C7C\u5730\u5740: ${value}`);
  }
  if (!text.startsWith("http")) {
    return `https://${text}`;
  }
  return text;
}

// dist/resolve/douyu/index.js
function lineNameForCdn(cdns, cdnCode) {
  for (const item of cdns) {
    if (item.cdn === cdnCode) {
      return String(item.name || cdnCode);
    }
  }
  return cdnCode;
}
function availableQualities(multirates) {
  return multirates.map((item) => ({
    name: String(item.name || `\u6863${item.rate ?? 0}`),
    rate: Number(item.rate ?? 0)
  }));
}
function tierFromResponse(item, resp, lineLabel, seenPaths) {
  if (resp.error !== 0) {
    return null;
  }
  const rate = String(item.rate ?? 0);
  const groupName = String(item.name || `\u6863${rate}`);
  const info = resp.data || {};
  const playUrl = flvFromApiData(info);
  if (!isDouyucdnUrl(playUrl)) {
    return null;
  }
  if (seenPaths) {
    const pathKey = playUrl.split("?")[0].split("/").pop() || "";
    if (seenPaths.has(pathKey)) {
      return null;
    }
    seenPaths.add(pathKey);
  }
  return {
    name: groupName,
    lines: [{ name: lineLabel, url: playUrl }],
    play_url: playUrl
  };
}
async function loadPlayContext(url, preferredCdn = "hw-h5") {
  const rid = await getRoomId(url);
  const [roomRaw, white] = await Promise.all([fetchBetard(rid), fetchWhiteKey()]);
  if (roomRaw.show_status !== 1) {
    throw new Error("\u623F\u95F4\u672A\u5F00\u64AD\u6216\u89E3\u6790\u5931\u8D25");
  }
  const base = await fetchH5PlayV1(rid, "0", white, preferredCdn);
  if (base.error !== 0) {
    throw new Error(base.msg || "getH5PlayV1 \u5931\u8D25");
  }
  const apiData = base.data || {};
  const multirates = apiData.multirates || [];
  const cdns = apiData.cdnsWithName || [];
  if (!multirates.length) {
    throw new Error("\u672A\u8FD4\u56DE multirates \u6863\u4F4D\u4FE1\u606F");
  }
  return {
    rid,
    url,
    anchor_name: roomRaw.nickname || "",
    cover: coverFromRoom(roomRaw),
    white,
    base,
    multirates,
    cdns,
    line_label: lineNameForCdn(cdns, preferredCdn),
    preferred_cdn: preferredCdn
  };
}
function metaFromContext(ctx) {
  return {
    site: "douyu",
    room_id: ctx.rid,
    source_url: ctx.url,
    anchor_name: ctx.anchor_name,
    title: ctx.anchor_name,
    cover: ctx.cover,
    available_qualities: availableQualities(ctx.multirates),
    context: {
      rid: ctx.rid,
      url: ctx.url,
      anchor_name: ctx.anchor_name,
      multirates: ctx.multirates,
      cdns: ctx.cdns,
      line_label: ctx.line_label,
      preferred_cdn: ctx.preferred_cdn,
      white: ctx.white,
      base: ctx.base
    }
  };
}
function contextFromMeta(meta) {
  return meta.context;
}
async function fetchTierResponse(ctx, item) {
  const rate = String(item.rate ?? 0);
  if (rate === "0") {
    return ctx.base;
  }
  return fetchH5PlayV1(ctx.rid, rate, ctx.white, ctx.preferred_cdn);
}
async function loadMeta(url, preferredCdn = "hw-h5") {
  const ctx = await loadPlayContext(url, preferredCdn);
  return metaFromContext(ctx);
}
async function resolveTier(meta, qualityName) {
  const ctx = contextFromMeta(meta);
  const item = pickQualityName(meta.available_qualities, qualityName);
  const resp = await fetchTierResponse(ctx, item);
  const tier = tierFromResponse(item, resp, ctx.line_label);
  if (!tier) {
    throw new Error(`\u672A\u83B7\u53D6\u5230\u6863\u4F4D ${item.name || qualityName} \u7684\u64AD\u653E\u5730\u5740`);
  }
  return tier;
}
async function resolveAllTiers(meta) {
  const ctx = contextFromMeta(meta);
  const results = await Promise.all(ctx.multirates.map(async (item) => ({ item, resp: await fetchTierResponse(ctx, item) })));
  const streams = [];
  const seenPaths = /* @__PURE__ */ new Set();
  for (const { item, resp } of results) {
    const tier = tierFromResponse(item, resp, ctx.line_label, seenPaths);
    if (tier) {
      streams.push(tier);
    }
  }
  if (!streams.length) {
    throw new Error("\u672A\u83B7\u53D6\u5230\u53EF\u64AD\u653E\u7684 douyucdn \u5730\u5740");
  }
  return streams;
}

// dist/resolve/huya/anti-code.js
import { createHash as createHash2, randomInt } from "node:crypto";
function buildAntiCode(oldAntiCode, streamName) {
  const paramsT = 100;
  const sdkVersion = 2403051612;
  const t13 = Math.floor(Date.now() / 1e3) * 1e3;
  const sdkSid = t13;
  const initUuid = (Math.trunc(t13 % 10 ** 10 * 1e3) + Math.trunc(1e3 * Math.random())) % 4294967295;
  const uid = randomInt(14e11, 1400009999999);
  const seqId = uid + sdkSid;
  const targetUnixTime = Math.trunc((t13 + 110624) / 1e3);
  const wsTime = targetUnixTime.toString(16).toLowerCase();
  const urlQuery = new URLSearchParams(oldAntiCode);
  const fm = urlQuery.get("fm");
  const ctype = urlQuery.get("ctype");
  const fs = urlQuery.get("fs");
  if (!fm || !ctype || !fs) {
    throw new Error("\u65E0\u6548\u7684 anti_code");
  }
  const wsSecretPf = Buffer.from(decodeURIComponent(fm), "base64").toString("utf8").split("_")[0];
  const wsSecretHash = createHash2("md5").update(`${seqId}|${ctype}|${paramsT}`).digest("hex");
  const wsSecret = `${wsSecretPf}_${uid}_${streamName}_${wsSecretHash}_${wsTime}`;
  const wsSecretMd5 = createHash2("md5").update(wsSecret).digest("hex");
  return `wsSecret=${wsSecretMd5}&wsTime=${wsTime}&seqid=${seqId}&ctype=${ctype}&ver=1&fs=${fs}&uuid=${initUuid}&u=${uid}&t=${paramsT}&sv=${sdkVersion}&sdk_sid=${sdkSid}&codec=264`;
}

// dist/resolve/huya/web-stream.js
var PC_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://www.huya.com/"
};
var MOBILE_HEADERS = {
  "user-agent": "ios/7.830 (ios 17.0; ; iPhone 15 (A2846/A3089/A3090/A3092))",
  "xweb_xhr": "1",
  referer: "https://servicewechat.com/wx74767bf0b684f7d3/301/page-frame.html",
  "accept-language": "zh-CN,zh;q=0.9"
};
async function fetchWebStreamData(url) {
  const res = await fetch(url, {
    headers: PC_HEADERS,
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) {
    throw new Error(`\u864E\u7259\u9875\u9762 HTTP ${res.status}`);
  }
  const html = await res.text();
  const match = html.match(/stream:\s*(\{"data".*?),"iWebDefaultBitRate"/);
  if (!match) {
    throw new Error("\u65E0\u6CD5\u89E3\u6790\u864E\u7259\u9875\u9762\u6D41\u6570\u636E");
  }
  const jsonData = JSON.parse(`${match[1]}}`);
  jsonData.live_url = url;
  return jsonData;
}
async function resolveRoomId(url) {
  let roomId = url.split("?")[0].split("/").pop() || "";
  if (/[a-zA-Z]/.test(roomId)) {
    const res = await fetch(url, { headers: MOBILE_HEADERS, signal: AbortSignal.timeout(2e4) });
    const html = await res.text();
    const match = html.match(/ProfileRoom":(\d+),"sPrivateHost/);
    if (!match) {
      throw new Error('\u8BF7\u4F7F\u7528 "https://www.huya.com/+room_number" \u89E3\u6790');
    }
    roomId = match[1];
  }
  return roomId;
}
async function fetchAppStreamData(url) {
  const roomId = await resolveRoomId(url);
  const liveUrl = `https://www.huya.com/${roomId}`;
  const params = new URLSearchParams({
    m: "Live",
    do: "profileRoom",
    roomid: roomId,
    showSecret: "1"
  });
  const apiUrl = `https://mp.huya.com/cache.php?${params}`;
  const res = await fetch(apiUrl, {
    headers: PC_HEADERS,
    signal: AbortSignal.timeout(2e4)
  });
  if (!res.ok) {
    throw new Error(`\u864E\u7259 app API HTTP ${res.status}`);
  }
  const jsonData = await res.json();
  const anchorName = jsonData.data?.profileInfo?.nick || "";
  const liveStatus = jsonData.data?.realLiveStatus;
  if (liveStatus !== "ON") {
    return { anchor_name: anchorName, is_live: false };
  }
  const liveTitle = jsonData.data?.liveData?.introduction || "";
  const baseList = jsonData.data?.stream?.baseSteamInfoList || [];
  if (!baseList.length) {
    return { anchor_name: anchorName, is_live: false, title: liveTitle };
  }
  const playUrlList = [];
  for (const item of baseList) {
    const cdnType = String(item.sCdnType || "");
    const streamName = String(item.sStreamName || "");
    const sFlvUrl = String(item.sFlvUrl || "");
    const flvAntiCode = String(item.sFlvAntiCode || "");
    const sHlsUrl = String(item.sHlsUrl || "");
    const hlsAntiCode = String(item.sHlsAntiCode || "");
    playUrlList.push({
      cdn_type: cdnType,
      m3u8_url: `${sHlsUrl}/${streamName}.m3u8?${hlsAntiCode}`,
      flv_url: `${sFlvUrl}/${streamName}.flv?${flvAntiCode}`
    });
  }
  let selectItem = playUrlList.find((item) => item.cdn_type === "TX") || playUrlList[0];
  let flvUrl = selectItem?.flv_url || "";
  let m3u8Url = selectItem?.m3u8_url || "";
  if (selectItem && ["TX", "HW"].includes(selectItem.cdn_type)) {
    flvUrl = flvUrl.replace("&ctype=tars_mp", "&ctype=huya_webh5").replace("&fs=bhct", "&fs=bgct");
    m3u8Url = m3u8Url.replace("&ctype=tars_mp", "&ctype=huya_webh5").replace("&fs=bhct", "&fs=bgct");
  }
  return {
    anchor_name: anchorName,
    is_live: true,
    title: liveTitle,
    flv_url: flvUrl.replace("http://", "https://"),
    m3u8_url: m3u8Url.replace("http://", "https://")
  };
}
function lineName(streamInfo) {
  const index = streamInfo.iLineIndex;
  if (index != null) {
    return `\u7EBF\u8DEF${index}`;
  }
  const cdn = String(streamInfo.sCdnType || "CDN");
  return `\u7EBF\u8DEF${cdn}`;
}
function buildFlvUrl(streamInfo, ratio = "") {
  const flvUrl = String(streamInfo.sFlvUrl || "");
  const streamName = String(streamInfo.sStreamName || "");
  const suffix = String(streamInfo.sFlvUrlSuffix || "flv");
  const antiCode = String(streamInfo.sFlvAntiCode || "");
  if (!flvUrl || !streamName || !antiCode) {
    return "";
  }
  const newAntiCode = buildAntiCode(antiCode, streamName);
  const ratioStr = ratio === 0 || ratio === "0" || ratio === "" ? "" : String(ratio);
  const url = `${flvUrl}/${streamName}.${suffix}?${newAntiCode}&ratio=${ratioStr}`;
  return url.replace("http://", "https://");
}
function qualityItems(webData) {
  const items = webData.vMultiStreamInfo || [];
  if (items.length) {
    return items.map((item) => ({
      name: String(item.sDisplayName || `\u6863${item.iBitRate ?? 0}`),
      rate: Number(item.iBitRate ?? 0)
    }));
  }
  return [{ name: "\u9ED8\u8BA4", rate: 0 }];
}
function streamLines(webData, ratio = "") {
  const streamList = webData.data?.[0]?.gameStreamInfoList || [];
  const lines = [];
  for (const streamInfo of streamList) {
    const url = buildFlvUrl(streamInfo, ratio);
    if (!url) {
      continue;
    }
    lines.push({ name: lineName(streamInfo), url });
  }
  return lines;
}

// dist/resolve/huya/normalize.js
function normalizeUrl2(value) {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return `https://www.huya.com/${text}`;
  }
  if (!text.includes("huya.com")) {
    throw new Error(`\u65E0\u6548\u7684\u864E\u7259\u5730\u5740: ${value}`);
  }
  if (!text.startsWith("http")) {
    return `https://${text}`;
  }
  return text;
}

// dist/resolve/huya/index.js
async function loadPlayContext2(url) {
  const webData = await fetchWebStreamData(url);
  const gameInfo = webData.data?.[0]?.gameLiveInfo || {};
  const streamList = webData.data?.[0]?.gameStreamInfoList || [];
  const roomId = url.replace(/\/$/, "").split("/").pop() || "";
  if (!streamList.length) {
    let appData = {};
    try {
      appData = await fetchAppStreamData(url);
    } catch {
      appData = {};
    }
    if (appData.is_live === false) {
      throw new Error("\u623F\u95F4\u672A\u5F00\u64AD");
    }
    if (appData.flv_url) {
      const flvUrl = appData.flv_url.replace("http://", "https://");
      const tier = {
        name: "\u9ED8\u8BA4",
        lines: [{ name: "\u7EBF\u8DEF1", url: flvUrl }],
        play_url: flvUrl
      };
      return {
        url,
        room_id: roomId,
        anchor_name: appData.anchor_name || String(gameInfo.nick || ""),
        title: appData.title || String(gameInfo.introduction || ""),
        cover: String(gameInfo.screenshot || ""),
        web_data: webData,
        qualities: [{ name: "\u9ED8\u8BA4", rate: 0 }],
        app_fallback_tier: tier
      };
    }
    throw new Error("\u623F\u95F4\u672A\u5F00\u64AD\u6216\u89E3\u6790\u5931\u8D25");
  }
  return {
    url,
    room_id: roomId,
    anchor_name: String(gameInfo.nick || ""),
    title: String(gameInfo.introduction || gameInfo.roomName || ""),
    cover: String(gameInfo.screenshot || ""),
    web_data: webData,
    qualities: qualityItems(webData)
  };
}
function metaFromContext2(ctx) {
  const context = { web_data: ctx.web_data };
  if (ctx.app_fallback_tier) {
    context.app_fallback_tier = ctx.app_fallback_tier;
  }
  return {
    site: "huya",
    room_id: ctx.room_id,
    source_url: ctx.url,
    anchor_name: ctx.anchor_name,
    title: ctx.title || ctx.anchor_name,
    cover: ctx.cover,
    available_qualities: ctx.qualities,
    context
  };
}
function tierFromQuality(webData, quality) {
  const lines = streamLines(webData, quality.rate ?? 0);
  if (!lines.length) {
    return null;
  }
  return {
    name: String(quality.name || "\u9ED8\u8BA4"),
    lines,
    play_url: lines[0].url
  };
}
async function loadMeta2(url) {
  const ctx = await loadPlayContext2(url);
  return metaFromContext2(ctx);
}
async function resolveTier2(meta, qualityName) {
  const fallback = meta.context.app_fallback_tier;
  if (fallback) {
    return fallback;
  }
  const webData = meta.context.web_data;
  const quality = pickQualityName(meta.available_qualities, qualityName);
  const tier = tierFromQuality(webData, quality);
  if (!tier) {
    throw new Error(`\u672A\u83B7\u53D6\u5230\u6863\u4F4D ${quality.name || qualityName} \u7684\u64AD\u653E\u5730\u5740`);
  }
  return tier;
}
async function resolveAllTiers2(meta) {
  const fallback = meta.context.app_fallback_tier;
  if (fallback) {
    return [fallback];
  }
  const webData = meta.context.web_data;
  const streams = [];
  for (const quality of meta.available_qualities) {
    const tier = tierFromQuality(webData, quality);
    if (tier) {
      streams.push(tier);
    }
  }
  if (!streams.length) {
    throw new Error("\u672A\u83B7\u53D6\u5230\u53EF\u64AD\u653E\u7684\u864E\u7259 FLV \u5730\u5740");
  }
  return streams;
}

// dist/resolve/service.js
var SITE_LOAD_META = {
  douyu: (url) => loadMeta(url),
  huya: (url) => loadMeta2(url)
};
var SITE_RESOLVE_TIER = {
  douyu: (meta, quality) => resolveTier(meta, quality),
  huya: (meta, quality) => resolveTier2(meta, quality)
};
var SITE_RESOLVE_ALL_TIERS = {
  douyu: (meta) => resolveAllTiers(meta),
  huya: (meta) => resolveAllTiers2(meta)
};
var SITE_NORMALIZE_URL = {
  douyu: normalizeUrl,
  huya: normalizeUrl2
};
function msSince(start) {
  return Math.trunc(performance.now() - start);
}
function createResolveService(cache) {
  function normalizeRoomUrl(site, roomId) {
    const normalizer = SITE_NORMALIZE_URL[site];
    if (!normalizer) {
      throw new Error(`\u6682\u4E0D\u652F\u6301\u5E73\u53F0: ${site}`);
    }
    return normalizer(roomId);
  }
  async function fetchMeta(site, roomId, force = false) {
    if (!force) {
      const cached = cache.getMeta(site, roomId);
      if (cached) {
        cached.cached_meta = true;
        return cached;
      }
    }
    const loader = SITE_LOAD_META[site];
    if (!loader) {
      throw new Error(`\u6682\u4E0D\u652F\u6301\u5E73\u53F0: ${site}`);
    }
    const url = normalizeRoomUrl(site, roomId);
    const meta = await loader(url);
    cache.setMeta(site, roomId, meta);
    return meta;
  }
  async function fetchTier(site, roomId, meta, qualityName, force = false) {
    if (!force) {
      const cached = cache.getTier(site, roomId, qualityName);
      if (cached) {
        cached.cached_tier = true;
        return cached;
      }
    }
    const resolver = SITE_RESOLVE_TIER[site];
    if (!resolver) {
      throw new Error(`\u6682\u4E0D\u652F\u6301\u5E73\u53F0: ${site}`);
    }
    const tier = await resolver(meta, qualityName);
    cache.setTier(site, roomId, qualityName, tier);
    return tier;
  }
  return {
    async resolveRoom({ site, roomId, mode = "lazy", quality = null, force = false }) {
      const t0 = performance.now();
      const timing = {
        total_ms: 0,
        meta_ms: 0,
        tier_ms: 0,
        payload_cached: false,
        meta_cached: false,
        tier_cached: false
      };
      const qualityKey = (quality || "").trim() || "*";
      if (!force) {
        const cached = cache.getPayload(site, roomId, mode, qualityKey);
        if (cached) {
          cached.cached = true;
          timing.payload_cached = true;
          timing.total_ms = msSince(t0);
          cached._timing = timing;
          return cached;
        }
      }
      const tMeta = performance.now();
      const meta = await fetchMeta(site, roomId, force);
      timing.meta_ms = msSince(tMeta);
      timing.meta_cached = Boolean(meta.cached_meta);
      let payload;
      if (mode === "full") {
        const tTier = performance.now();
        const resolver = SITE_RESOLVE_ALL_TIERS[site];
        if (!resolver) {
          throw new Error(`\u6682\u4E0D\u652F\u6301\u5E73\u53F0: ${site}`);
        }
        const tiers = await resolver(meta);
        timing.tier_ms = msSince(tTier);
        payload = buildRoomPayload(meta, tiers, { source: "streamget" });
      } else {
        const qualityItem = pickQualityName(meta.available_qualities || [], quality);
        const tierName = String(qualityItem.name || quality || "\u9ED8\u8BA4");
        const tTier = performance.now();
        const tier = await fetchTier(site, roomId, meta, tierName, force);
        timing.tier_ms = msSince(tTier);
        timing.tier_cached = Boolean(tier.cached_tier);
        payload = buildRoomPayload(meta, [tier], {
          partial: true,
          activeQuality: tierName,
          source: "streamget"
        });
      }
      payload.source = "streamget";
      cache.setPayload(site, roomId, mode, qualityKey, payload);
      timing.total_ms = msSince(t0);
      payload._timing = timing;
      return payload;
    }
  };
}

// dist/static/serve-static.js
import { createReadStream, existsSync as existsSync2, statSync } from "node:fs";
import path2 from "node:path";
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp"
};
function serveStatic(webRoot, reqPath, res, extraHeaders) {
  const rel = reqPath.replace(/^\/+/, "") || "index.html";
  const root = path2.resolve(webRoot);
  let target = path2.resolve(root, rel);
  if (!target.startsWith(root + path2.sep) && target !== root) {
    res.writeHead(403);
    res.end();
    return true;
  }
  if (existsSync2(target) && statSync(target).isDirectory()) {
    target = path2.join(target, "index.html");
  }
  if (!existsSync2(target) || !statSync(target).isFile()) {
    const fallback = path2.join(root, "index.html");
    if (existsSync2(fallback) && !rel.startsWith("api/")) {
      target = fallback;
    } else {
      res.writeHead(404);
      res.end("Not found");
      return true;
    }
  }
  const ext = path2.extname(target).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    ...extraHeaders
  });
  createReadStream(target).pipe(res);
  return true;
}
function sendApiOnly(res, send) {
  send(res, {
    ok: false,
    error: "\u672C\u670D\u52A1\u4EC5\u63D0\u4F9B API\u3002\u8BF7\u5355\u72EC\u90E8\u7F72\u524D\u7AEF\uFF0C\u6216\u5728 server/config.json \u4E2D\u5F00\u542F static.enabled\u3002"
  }, 404);
}
function webHeaders(webRoot) {
  const headers = {
    "Permissions-Policy": "unload=(self)"
  };
  if (webRoot) {
    headers["X-Live-Web-Root"] = webRoot;
  }
  return headers;
}

// dist/index.js
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--config" && argv[i + 1]) {
      out.config = argv[++i];
    } else if (argv[i] === "--port" && argv[i + 1]) {
      out.port = Number(argv[++i]);
    }
  }
  return out;
}
function startServer(cfg, webRoot) {
  const cache = new ResolveCache();
  const resolveService = createResolveService(cache);
  const ctx = {
    config: cfg,
    cache,
    resolveService,
    browseApi,
    webRoot
  };
  const sendJson2 = createJsonSender(cfg);
  const server = createServer(async (req, res) => {
    const url = new URL3(req.url || "/", "http://localhost");
    if (req.method === "OPTIONS") {
      handleOptions(res, cfg);
      return;
    }
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, ctx);
      if (!handled) {
        sendJson2(res, { ok: false, error: "Not found" }, 404);
      }
      return;
    }
    if (!webRoot) {
      sendApiOnly(res, sendJson2);
      return;
    }
    const extra = { ...webHeaders(webRoot) };
    const corsHeaders = {};
    applyCorsHeaders(corsHeaders, cfg.cors);
    for (const [k, v] of Object.entries(corsHeaders)) {
      extra[k] = String(v);
    }
    serveStatic(webRoot, url.pathname, res, extra);
  });
  const host = cfg.host || "127.0.0.1";
  const port = cfg.port || 8765;
  server.on("error", (err) => {
    console.error(`\u9519\u8BEF: \u65E0\u6CD5\u7ED1\u5B9A ${host}:${port}\uFF08${err.message}\uFF09`);
    console.error("      \u53EF\u80FD\u5DF2\u6709\u65E7\u670D\u52A1\u5728\u8FD0\u884C\u3002Windows \u53EF\u5148\u6267\u884C:");
    console.error(`      netstat -ano | findstr :${port}`);
    console.error("      taskkill /PID <pid> /F");
    console.error("      \u6216\u76F4\u63A5\u8FD0\u884C: .\\start.ps1");
    process.exit(1);
  });
  server.listen(port, host, () => {
    if (webRoot) {
      console.log(`\u9759\u6001\u6258\u7BA1: ${webRoot}`);
    } else if (cfg.static?.enabled) {
      console.log("\u8B66\u544A: static.enabled=true \u4F46\u672A\u627E\u5230 dist/index.html\uFF0C\u4EC5\u63D0\u4F9B API");
    } else {
      console.log("\u6A21\u5F0F: \u4EC5 API\uFF08\u524D\u540E\u7AEF\u89E3\u8026\uFF0C\u524D\u7AEF\u8BF7\u5355\u72EC\u90E8\u7F72\uFF09");
    }
    console.log(`API: http://${host}:${port}/api/health`);
    console.log("     GET /api/room?site=douyu|huya&room=<id>&mode=lazy|full");
    console.log("     GET /api/categories?site=douyu|huya");
    console.log("     GET /api/rooms?site=douyu|huya&cid=<id>&page=1");
    console.log("     GET /api/rooms?site=douyu|huya&recommend=1&page=1");
    console.log("     GET /api/huya/danmaku?room=<id>");
    console.log("\u914D\u7F6E: config.json\uFF08\u53EF\u9009 config.local.json \u8986\u76D6\uFF09");
    console.log("\u6309 Ctrl+C \u505C\u6B62");
  });
}
function main() {
  const args = parseArgs(process.argv);
  const cfg = loadConfig(args.config);
  if (args.port != null) {
    cfg.port = args.port;
  }
  const webRoot = resolveStaticRoot(cfg);
  startServer(cfg, webRoot);
}
main();
export {
  startServer
};
