import { apiBase } from "../config/app.js";

export async function fetchTimeReport({ site = "douyu", room = "252140", quality = "", run = false } = {}) {
  const params = new URLSearchParams({ site, room });
  if (quality) params.set("quality", quality);
  if (run) params.set("run", "1");
  const res = await fetch(`${apiBase()}/api/time?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
