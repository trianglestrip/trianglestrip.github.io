import { apiBase } from "../config/app.js";

export function buildBilibiliAuthPacket(session) {
  const body = JSON.stringify({
    uid: Number(session.uid || 0),
    roomid: Number(session.room_id),
    protover: 3,
    platform: "web",
    type: 2,
    key: session.token,
  });
  return encodeBilibiliPacket(7, body);
}

export function buildBilibiliHeartbeatPacket() {
  return encodeBilibiliPacket(2, "");
}

function encodeBilibiliPacket(op, body = "") {
  const bodyBytes = typeof body === "string" && body ? new TextEncoder().encode(body) : new Uint8Array(0);
  const headerLen = 16;
  const packetLen = headerLen + bodyBytes.length;
  const buffer = new ArrayBuffer(packetLen);
  const view = new DataView(buffer);
  view.setInt32(0, packetLen, false);
  view.setInt16(4, headerLen, false);
  view.setInt16(6, 1, false);
  view.setInt32(8, op, false);
  view.setInt32(12, 1, false);
  if (bodyBytes.length) {
    new Uint8Array(buffer, headerLen).set(bodyBytes);
  }
  return buffer;
}

export async function fetchBilibiliDanmakuSession(roomId) {
  const params = new URLSearchParams({ room: String(roomId).trim() });
  const res = await fetch(`${apiBase()}/api/bilibili/danmaku?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return {
    room_id: String(data.room_id || roomId),
    uid: Number(data.uid || 0),
    host: String(data.host || ""),
    port: Number(data.wss_port || data.port || 443),
    token: String(data.token || ""),
  };
}

export function bilibiliDanmakuWsUrl(session) {
  const host = session.host.replace(/^https?:\/\//, "");
  const port = session.port || 443;
  return `wss://${host}:${port}/sub`;
}
