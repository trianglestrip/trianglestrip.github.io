import { apiUrl } from "../config/app.js";
import { PLATFORMS, supportsBrowse } from "../config/platforms.js";

async function readJson(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.status === 404) {
      throw new Error("分类/列表 API 不可用，请重启 API 服务");
    }
    throw new Error(`服务器响应异常 (HTTP ${res.status})`);
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchCategories(site) {
  const params = new URLSearchParams({ site });
  const res = await fetch(apiUrl(`/api/categories?${params}`), { cache: "no-store" });
  return readJson(res);
}

export async function fetchRecommendRooms(site, page = 1) {
  const params = new URLSearchParams({ site, recommend: "1", page: String(page) });
  const res = await fetch(apiUrl(`/api/rooms?${params}`), { cache: "no-store" });
  return readJson(res);
}

export async function fetchCategoryRooms(site, { cid, pid, page = 1 } = {}) {
  const params = new URLSearchParams({ site, cid: String(cid), page: String(page) });
  if (pid) params.set("pid", String(pid));
  const res = await fetch(apiUrl(`/api/rooms?${params}`), { cache: "no-store" });
  return readJson(res);
}

export function roomKey(room) {
  return String(room?.roomId ?? room?.id ?? "");
}

/** 支持推荐列表的平台（斗鱼、虎牙等） */
export function recommendBrowseSites() {
  return PLATFORMS.filter((p) => p.enabled && supportsBrowse(p.id)).map((p) => p.id);
}

function interleaveRoomLists(lists) {
  const merged = [];
  const maxLen = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const list of lists) {
      if (list[i]) merged.push(list[i]);
    }
  }
  return merged;
}

/** 按当前房间分类跨平台相关推荐；API 不可用时回退为混合推荐 */
export async function fetchRelatedRecommendRooms({
  site,
  category = "",
  cid = "",
  page = 1,
  perSite = 10,
  limit = 20,
} = {}) {
  const params = new URLSearchParams({
    site,
    category,
    page: String(page),
    perSite: String(perSite),
    limit: String(limit),
  });
  if (cid) params.set("cid", String(cid));
  const res = await fetch(apiUrl(`/api/recommend-related?${params.toString()}`), { cache: "no-store" });
  if (res.status === 404) {
    const list = await fetchMixedRecommendRooms({ page, perSite });
    return { ok: true, list, categoryKey: null, categoryName: category || null };
  }
  return readJson(res);
}

/** 各平台均匀取推荐，交错排列（无分类上下文时的兜底） */
export async function fetchMixedRecommendRooms({ page = 1, perSite = 6 } = {}) {
  const sites = recommendBrowseSites();
  if (!sites.length) throw new Error("暂无可用推荐平台");

  const lists = await Promise.all(
    sites.map(async (site) => {
      try {
        const data = await fetchRecommendRooms(site, page);
        return (data.list || []).slice(0, perSite).map((room) => ({
          ...room,
          siteId: site,
        }));
      } catch {
        return [];
      }
    }),
  );

  const merged = interleaveRoomLists(lists);
  if (!merged.length) throw new Error("暂无推荐直播");
  return merged;
}
