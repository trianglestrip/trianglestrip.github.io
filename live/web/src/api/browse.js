import { apiUrl } from "../config/app.js";

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
