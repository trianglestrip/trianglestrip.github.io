import { apiBase } from "../config/app.js";
import { buildHuyaJoinPayload, HUYA_HEARTBEAT } from "./huyaJce.js";

export { buildHuyaJoinPayload, HUYA_HEARTBEAT };

export async function fetchHuyaDanmakuSession(roomId) {
  const params = new URLSearchParams({ room: String(roomId).trim() });
  const res = await fetch(`${apiBase()}/api/huya/danmaku?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return {
    ayyuid: Number(data.ayyuid),
    topSid: Number(data.topSid),
  };
}
