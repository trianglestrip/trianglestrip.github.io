import { apiBase } from "../config/app.js";

export async function fetchRoom({ site, room, mode = "lazy", quality, force = false } = {}) {
  const params = new URLSearchParams({
    site,
    room,
    source: "local",
    mode,
  });
  if (quality) params.set("quality", quality);
  if (force) params.set("force", "1");

  const res = await fetch(`${apiBase()}/api/room?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export function parseRoomId(value) {
  const text = String(value || "").trim();
  if (/^\d+$/.test(text)) return text;
  const match = text.match(/(?:douyu|huya|bilibili|douyin)\.com\/([a-zA-Z0-9]+)/);
  return match ? match[1] : text;
}

export function qualityNames(payload) {
  const list = payload?.available_qualities || [];
  if (list.length) return list.map((item) => item.name || String(item));
  return (payload?.streams || []).map((item) => item.name || "默认");
}

export function streamByName(payload, name) {
  return (payload?.streams || []).find((item) => item.name === name) || null;
}

export function streamHasUrl(stream) {
  const url = stream?.lines?.[0]?.url || "";
  return !!url && !url.includes("edgesrv.com");
}

export function mergePayload(existing, incoming) {
  const streams = [...(existing?.streams || [])];
  for (const item of incoming.streams || []) {
    const index = streams.findIndex((entry) => entry.name === item.name);
    if (index >= 0) streams[index] = item;
    else streams.push(item);
  }
  return {
    ...(existing || {}),
    ...incoming,
    streams,
    available_qualities: incoming.available_qualities || existing?.available_qualities || [],
  };
}

export function findQualityIndex(names, preferred) {
  if (!names.length) return 0;
  if (preferred) {
    const exact = names.findIndex((name) => name === preferred);
    if (exact >= 0) return exact;
  }
  for (const tag of ["原画", "蓝光", "超清", "高清"]) {
    const index = names.findIndex((name) => name.includes(tag));
    if (index >= 0) return index;
  }
  return 0;
}

export function findLineIndex(lines, preferred) {
  if (!lines?.length) return 0;
  if (preferred) {
    const exact = lines.findIndex((line) => line.name === preferred);
    if (exact >= 0) return exact;
  }
  return 0;
}

export function currentPlayUrl(payload, qualityIndex, lineIndex) {
  const names = qualityNames(payload);
  const name = names[qualityIndex];
  const stream = streamByName(payload, name) || payload.streams?.[qualityIndex];
  if (stream) {
    const line = stream.lines?.[lineIndex] || stream.lines?.[0];
    if (line?.url && !line.url.includes("edgesrv.com")) return line.url;
  }
  for (const candidate of [payload.play_url, payload.flv_url, payload.m3u8_url]) {
    if (candidate && !candidate.includes("edgesrv.com")) return candidate;
  }
  return "";
}
