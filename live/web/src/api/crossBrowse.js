import { apiUrl } from "../config/app.js";

async function readJson(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.status === 404) {
      throw new Error("跨平台 API 不可用，请重启 API 服务");
    }
    throw new Error(`服务器响应异常 (HTTP ${res.status})`);
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchHotCategories() {
  const res = await fetch(apiUrl("/api/hot-categories"), { cache: "no-store" });
  return readJson(res);
}

export async function fetchCrossCategoryRooms(crossKey, page = 1, limit = 21) {
  const params = new URLSearchParams({
    key: String(crossKey),
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(apiUrl(`/api/cross-rooms?${params}`), { cache: "no-store" });
  return readJson(res);
}
