import { huyaRoomState } from "../follow/huya-state.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/",
};

export interface HuyaDanmakuSession {
  room_id: string;
  ayyuid: number;
  topSid: number;
  is_live: boolean;
}

export async function fetchHuyaDanmakuSession(roomId: string): Promise<HuyaDanmakuSession> {
  const room = String(roomId).trim();
  if (!/^\d+$/.test(room)) {
    throw new Error(`无效虎牙房间号: ${roomId}`);
  }

  const url = new URL("https://mp.huya.com/cache.php");
  url.searchParams.set("m", "Live");
  url.searchParams.set("do", "profileRoom");
  url.searchParams.set("roomid", room);
  url.searchParams.set("showSecret", "1");

  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    throw new Error(`虎牙房间信息 HTTP ${res.status}`);
  }

  const payload = (await res.json()) as {
    status?: number;
    message?: string;
    data?: {
      liveStatus?: string;
      stream?: { baseSteamInfoList?: Array<{ lChannelId?: number }> };
      profileInfo?: { yyid?: number };
      liveData?: { yyid?: number; liveChannel?: number; channel?: number };
    };
  };

  if (Number(payload.status || 0) !== 200) {
    throw new Error(payload.message || "虎牙房间信息获取失败");
  }

  const data = payload.data || {};
  const stream = data.stream || {};
  const baseList = stream.baseSteamInfoList || [];
  const profile = data.profileInfo || {};
  const liveData = data.liveData || {};
  const roomState = huyaRoomState(data as Record<string, unknown>);

  const ayyuid = Number(profile.yyid || liveData.yyid || 0);
  let topSid = 0;
  if (baseList.length) {
    topSid = Number(baseList[0]?.lChannelId || 0);
  }
  if (!topSid) {
    topSid = Number(liveData.liveChannel || liveData.channel || 0);
  }

  if (!ayyuid || !topSid) {
    throw new Error("房间未开播或缺少弹幕连接参数");
  }

  return {
    room_id: room,
    ayyuid,
    topSid,
    is_live: roomState === "live",
  };
}
