import { abSign } from "./ab-sign.js";

const PC_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "accept-language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
  referer: "https://live.douyin.com/",
};

const FALLBACK_COOKIE =
  "ttwid=1%7CmDcInbJ7AJ-2PGtsgrG4xj7SOiNMzePqQBF1LMO2Qkg%7C1761107324%7Cbbf97c2cd9f8eae8e8c36db4ef50c323deaa4b161179170aaf659590867c162d";

async function bootstrapCookie(webRid: string): Promise<string> {
  try {
    const res = await fetch(`https://live.douyin.com/${webRid}`, {
      headers: PC_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const parts: string[] = [];
    for (const item of res.headers.getSetCookie?.() || []) {
      const nameValue = item.split(";")[0]?.trim();
      if (nameValue) parts.push(nameValue);
    }
    if (parts.length) {
      return parts.join("; ");
    }
  } catch {
    // ignore
  }
  return FALLBACK_COOKIE;
}

export interface DouyinRoomData {
  id?: number | string;
  status?: number;
  title?: string;
  cover?: { url_list?: string[] };
  owner?: {
    nickname?: string;
    avatar_thumb?: { url_list?: string[] };
    avatar_medium?: { url_list?: string[] };
  };
  anchor_name?: string;
  live_url?: string;
  stream_url?: {
    flv_pull_url?: Record<string, string>;
    hls_pull_url_map?: Record<string, string>;
    live_core_sdk_data?: {
      pull_data?: { stream_data?: string };
    };
  };
}

function parseSdkParamsCodec(sdkParams: unknown): string {
  if (typeof sdkParams === "string") {
    try {
      const parsed = JSON.parse(sdkParams) as { VCodec?: string };
      return parsed.VCodec || "";
    } catch {
      return "";
    }
  }
  if (sdkParams && typeof sdkParams === "object") {
    return String((sdkParams as { VCodec?: string }).VCodec || "");
  }
  return "";
}

function mergeOriginStreams(roomData: DouyinRoomData): DouyinRoomData {
  const streamUrl = roomData.stream_url;
  if (!streamUrl?.live_core_sdk_data?.pull_data?.stream_data) {
    return roomData;
  }
  let originMain: { hls?: string; flv?: string; sdk_params?: unknown };
  try {
    const streamData = JSON.parse(streamUrl.live_core_sdk_data.pull_data.stream_data) as {
      data?: { origin?: { main?: { hls?: string; flv?: string; sdk_params?: unknown } } };
    };
    originMain = streamData.data?.origin?.main || {};
  } catch {
    return roomData;
  }
  const codec = parseSdkParamsCodec(originMain.sdk_params);
  const originM3u8: Record<string, string> = originMain.hls
    ? { ORIGIN: `${originMain.hls}&codec=${codec}` }
    : {};
  const originFlv: Record<string, string> = originMain.flv
    ? { ORIGIN: `${originMain.flv}&codec=${codec}` }
    : {};
  streamUrl.hls_pull_url_map = { ...originM3u8, ...(streamUrl.hls_pull_url_map || {}) };
  streamUrl.flv_pull_url = { ...originFlv, ...(streamUrl.flv_pull_url || {}) };
  return roomData;
}

export async function fetchWebStreamData(webRid: string): Promise<DouyinRoomData> {
  const params = new URLSearchParams({
    aid: "6383",
    app_name: "douyin_web",
    live_id: "1",
    device_platform: "web",
    language: "zh-CN",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Chrome",
    browser_version: "116.0.0.0",
    web_rid: webRid,
    is_need_double_stream: "false",
    msToken: "",
  });
  const query = params.toString();
  const baseApi = `https://live.douyin.com/webcast/room/web/enter/?${query}`;
  const aBogus = abSign(query, PC_HEADERS["user-agent"]);
  const api = `${baseApi}&a_bogus=${encodeURIComponent(aBogus)}`;
  const cookie = await bootstrapCookie(webRid);

  const res = await fetch(api, {
    headers: { ...PC_HEADERS, cookie },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`抖音房间接口 HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text) {
    throw new Error("抖音接口触发风控");
  }

  let json: {
    data?: {
      data?: DouyinRoomData[];
      user?: { nickname?: string };
      prompts?: string;
      message?: string;
    };
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error("抖音接口返回非 JSON");
  }

  const payload = json.data;
  if (!payload?.data?.length) {
    throw new Error(payload?.prompts || payload?.message || "抖音房间信息获取失败");
  }

  const roomData = payload.data[0];
  if (!roomData) {
    throw new Error("VR live is not supported");
  }

  roomData.anchor_name = payload.user?.nickname || roomData.owner?.nickname || "";
  roomData.live_url = `https://live.douyin.com/${webRid}`;

  if (roomData.status === 4) {
    return roomData;
  }

  return mergeOriginStreams(roomData);
}
