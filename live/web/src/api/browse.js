import { apiBase } from "../config/platforms";

async function readJson(res) {
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchCategories(site) {
  const params = new URLSearchParams({ site });
  const res = await fetch(`${apiBase()}/api/categories?${params}`, { cache: "no-store" });
  return readJson(res);
}

export async function fetchRecommendRooms(site, page = 1) {
  const params = new URLSearchParams({ site, recommend: "1", page: String(page) });
  const res = await fetch(`${apiBase()}/api/rooms?${params}`, { cache: "no-store" });
  return readJson(res);
}

export async function fetchCategoryRooms(site, { cid, pid, page = 1 } = {}) {
  const params = new URLSearchParams({ site, cid: String(cid), page: String(page) });
  if (pid) params.set("pid", String(pid));
  const res = await fetch(`${apiBase()}/api/rooms?${params}`, { cache: "no-store" });
  return readJson(res);
}

export function roomKey(room) {
  return String(room?.roomId ?? room?.id ?? "");
}
