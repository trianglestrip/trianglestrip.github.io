import { apiBase } from "../config/app.js";

async function readJson(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`服务器响应异常 (HTTP ${res.status})`);
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchFollowStatus(rooms) {
  const res = await fetch(`${apiBase()}/api/follows/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rooms }),
    cache: "no-store",
  });
  return readJson(res);
}
