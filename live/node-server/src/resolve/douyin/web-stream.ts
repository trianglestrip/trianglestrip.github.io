import { abSign } from "./ab-sign.js";

export const DOUYIN_PC_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "accept-language": "zh-CN,zh;q=0.9",
  referer: "https://live.douyin.com/",
};

const PC_HEADERS = DOUYIN_PC_HEADERS;

const SESSION_COOKIE_TTL_MS = 60_000;
let sessionCookie: string | null = null;
let sessionCookieAt = 0;

function randomHex(len: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function bootstrapCookie(): Promise<string> {
  const acNonce = randomHex(21);
  const seed = `__ac_nonce=${acNonce}; odin_tt=${randomHex(160)}`;
  try {
    // 从首页拿 ttwid 等 cookie；直接访问房间页易触发验证码中间页
    const res = await fetch("https://live.douyin.com/", {
      headers: { ...PC_HEADERS, cookie: seed },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const parts = [`__ac_nonce=${acNonce}`];
    for (const item of res.headers.getSetCookie?.() || []) {
      const nameValue = item.split(";")[0]?.trim();
      if (nameValue) parts.push(nameValue);
    }
    if (parts.length > 1) {
      return parts.join("; ");
    }
  } catch {
    // ignore
  }
  return seed;
}

export function clearDouyinSessionCookie(): void {
  sessionCookie = null;
  sessionCookieAt = 0;
}

export async function fetchDouyinSessionCookie(force = false): Promise<string> {
  if (!force && sessionCookie && Date.now() - sessionCookieAt < SESSION_COOKIE_TTL_MS) {
    return sessionCookie;
  }
  sessionCookie = await bootstrapCookie();
  sessionCookieAt = Date.now();
  return sessionCookie;
}

function isDouyinRiskControlBody(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

function decodeHtmlEscapes(value: string): string {
  return value.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

function lastMatchBefore(html: string, end: number, re: RegExp): RegExpMatchArray | null {
  const slice = html.slice(0, Math.max(0, end));
  const matches = [...slice.matchAll(re)];
  return matches.at(-1) || null;
}

function extractEscapedUrlMap(html: string, key: string): Record<string, string> {
  const marker = `\\"${key}\\":{`;
  const start = html.indexOf(marker);
  if (start < 0) return {};
  const block = html.slice(start, start + 12_000);
  const map: Record<string, string> = {};
  const re = /\\"([A-Z0-9_]+)\\":\\"((?:https?:\\\/\\\/|http:\\\/\\\/)[^"\\]*(?:\\u0026[^"\\]*)*)\\"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    map[match[1]] = decodeHtmlEscapes(match[2]);
  }
  return map;
}

async function fetchRoomPageHtml(webRid: string, cookie: string): Promise<string> {
  const res = await fetch(`https://live.douyin.com/${webRid}`, {
    headers: {
      ...PC_HEADERS,
      referer: `https://live.douyin.com/${webRid}`,
      cookie,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`抖音房间页 HTTP ${res.status}`);
  }
  return res.text();
}

function parseRoomDataFromHtml(html: string, webRid: string): DouyinRoomData | null {
  const flvIdx = html.indexOf('\\"flv_pull_url\\":{');
  if (flvIdx < 0) return null;

  const flvMap = extractEscapedUrlMap(html, "flv_pull_url");
  const hlsMap = extractEscapedUrlMap(html, "hls_pull_url_map");
  if (!Object.keys(flvMap).length && !Object.keys(hlsMap).length) return null;

  const idMatch = lastMatchBefore(html, flvIdx, /\\"id_str\\":\\"(\d+)\\"/g);
  const statusMatch = lastMatchBefore(html, flvIdx, /\\"status\\":(\d+)/g);
  const titleMatch = lastMatchBefore(html, flvIdx, /\\"title\\":\\"([^"\\]+)\\"/g);
  const nickMatch = lastMatchBefore(html, flvIdx, /\\"nickname\\":\\"([^"\\]+)\\"/g);

  const roomData: DouyinRoomData = {
    id_str: idMatch?.[1] || "",
    status: Number(statusMatch?.[1] || 0),
    title: titleMatch?.[1] || "",
    anchor_name: nickMatch?.[1] || "",
    owner: nickMatch?.[1] ? { nickname: nickMatch[1] } : undefined,
    live_url: `https://live.douyin.com/${webRid}`,
    stream_url: {
      flv_pull_url: flvMap,
      hls_pull_url_map: hlsMap,
    },
  };
  return roomData;
}

async function fetchRoomDataFromPage(webRid: string): Promise<DouyinRoomData> {
  const cookie = await fetchDouyinSessionCookie();
  const html = await fetchRoomPageHtml(webRid, cookie);
  const roomData = parseRoomDataFromHtml(html, webRid);
  if (!roomData) {
    throw new Error("抖音房间页未解析到流地址");
  }
  if (roomData.status === 4) {
    return roomData;
  }
  return normalizeLiveStreamData(roomData);
}

function buildEnterApi(webRid: string): string {
  const params = new URLSearchParams({
    aid: "6383",
    app_name: "douyin_web",
    live_id: "1",
    device_platform: "web",
    language: "zh-CN",
    enter_from: "web_live",
    cookie_enabled: "true",
    screen_width: "1920",
    screen_height: "1080",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Chrome",
    browser_version: "141.0.0.0",
    web_rid: webRid,
    is_need_double_stream: "false",
    msToken: "",
  });
  const query = params.toString();
  const aBogus = abSign(query, PC_HEADERS["user-agent"]);
  return `https://live.douyin.com/webcast/room/web/enter/?${query}&a_bogus=${encodeURIComponent(aBogus)}`;
}

async function fetchEnterRoomData(webRid: string, cookie: string): Promise<DouyinRoomData> {
  const api = buildEnterApi(webRid);
  const res = await fetch(api, {
    headers: {
      ...PC_HEADERS,
      referer: `https://live.douyin.com/${webRid}`,
      cookie,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`抖音房间接口 HTTP ${res.status}`);
  }
  const text = await res.text();
  if (isDouyinRiskControlBody(text)) {
    throw new Error("抖音接口触发风控");
  }

  let json: {
    status_code?: number;
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
    const prompt = payload?.prompts || payload?.message || "";
    if (json.status_code === 4001038 || prompt.includes("无法查看")) {
      throw new Error(prompt || "该直播间暂不可查看");
    }
    throw new Error(prompt || "抖音房间信息获取失败");
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
  return normalizeLiveStreamData(roomData);
}

export interface DouyinUserFollowInfo {
  follower_count?: number;
  following_count?: number;
}

export interface DouyinRoomData {
  id?: number | string;
  id_str?: string;
  status?: number;
  title?: string;
  category?: string;
  category_name?: string;
  create_time?: number;
  start_time?: number;
  open_time?: number;
  live_start_time?: number;
  modify_time?: number;
  game_tag?: { name?: string };
  game_data?: {
    game_tag_info?: {
      game_tag_name?: string;
      game_tag_id?: number | string;
      is_game?: number;
    };
  };
  partition_road_map?: Record<string, unknown>;
  room_auth?: Record<string, unknown>;
  fansclub?: Record<string, unknown>;
  fansclub_total?: number | string;
  fansclub_count?: number | string;
  fan_ticket_count?: number | string;
  cover?: { url_list?: string[] };
  owner?: {
    id_str?: string;
    sec_uid?: string;
    nickname?: string;
    follow_info?: {
      follower_count?: number;
      following_count?: number;
    };
    avatar_thumb?: { url_list?: string[] };
    avatar_medium?: { url_list?: string[] };
  };
  anchor_name?: string;
  user_count?: number;
  user_count_str?: string;
  live_url?: string;
  stream_url?: {
    stream_orientation?: number;
    flv_pull_url?: Record<string, string>;
    hls_pull_url_map?: Record<string, string>;
    pull_datas?: Record<string, { stream_data?: string }>;
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

function applyPortraitPullDatas(roomData: DouyinRoomData): DouyinRoomData {
  const streamUrl = roomData.stream_url;
  if (!streamUrl) return roomData;
  const orientation = Number(streamUrl.stream_orientation || 1);
  const pullDatas = streamUrl.pull_datas;
  if (orientation !== 2 || !pullDatas || !Object.keys(pullDatas).length) {
    return roomData;
  }
  const first = Object.values(pullDatas)[0];
  if (!first?.stream_data) return roomData;
  try {
    const streamData = JSON.parse(first.stream_data) as {
      data?: Record<string, { main?: { flv?: string; hls?: string } }>;
    };
    const flvMap: Record<string, string> = {};
    const hlsMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(streamData.data || {})) {
      const main = value?.main;
      if (!main) continue;
      if (main.flv) flvMap[key] = main.flv;
      if (main.hls) hlsMap[key] = main.hls;
    }
    streamUrl.flv_pull_url = flvMap;
    streamUrl.hls_pull_url_map = hlsMap;
  } catch {
    return roomData;
  }
  return roomData;
}

function normalizeLiveStreamData(roomData: DouyinRoomData): DouyinRoomData {
  const portrait = applyPortraitPullDatas(roomData);
  const flvMap = portrait.stream_url?.flv_pull_url || {};
  if (Object.keys(flvMap).length) {
    return portrait;
  }
  return mergeOriginStreams(portrait);
}

export async function fetchWebStreamData(webRid: string): Promise<DouyinRoomData> {
  const rid = String(webRid).trim();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const cookie = await fetchDouyinSessionCookie(attempt > 0);
      return await fetchEnterRoomData(rid, cookie);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retryable =
        lastError.message.includes("风控") ||
        lastError.message.includes("非 JSON") ||
        lastError.message.includes("获取失败");
      if (!retryable || attempt > 0) break;
      clearDouyinSessionCookie();
    }
  }

  try {
    return await fetchRoomDataFromPage(rid);
  } catch (pageErr) {
    const pageMessage = pageErr instanceof Error ? pageErr.message : String(pageErr);
    throw new Error(lastError?.message || pageMessage || "抖音接口触发风控，请稍后重试");
  }
}

export interface DouyinRoomInfoByUser {
  create_time?: number;
  finish_time?: number;
  status?: number;
}

/** 通过主播 uid 拉取当前场次信息（enter 接口常无 create_time） */
export async function fetchDouyinRoomInfoByUser(
  anchorUserId: string,
  webRid: string,
): Promise<DouyinRoomInfoByUser | null> {
  const uid = String(anchorUserId || "").trim();
  if (!uid) return null;

  const params = new URLSearchParams({
    aid: "6383",
    app_name: "douyin_web",
    live_id: "1",
    device_platform: "web",
    user_id: uid,
  });
  const query = params.toString();
  const api = `https://live.douyin.com/webcast/room/info_by_user/?${query}&a_bogus=${encodeURIComponent(abSign(query, PC_HEADERS["user-agent"]))}`;
  const cookie = await fetchDouyinSessionCookie();

  const res = await fetch(api, {
    headers: { ...PC_HEADERS, referer: `https://live.douyin.com/${webRid}`, cookie },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;

  const text = await res.text();
  if (!text || text.startsWith("<!DOCTYPE")) return null;

  let json: { status_code?: number; data?: DouyinRoomInfoByUser };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return null;
  }
  if (Number(json.status_code || 0) !== 0 || !json.data) return null;
  return json.data;
}

export async function fetchDouyinUserFollowInfo(
  targetUid: string,
): Promise<DouyinUserFollowInfo | null> {
  const uid = String(targetUid || "").trim();
  if (!uid) return null;

  const params = new URLSearchParams({
    aid: "6383",
    app_name: "douyin_web",
    live_id: "1",
    device_platform: "web",
    language: "zh-CN",
    cookie_enabled: "true",
    screen_width: "1920",
    screen_height: "1080",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Chrome",
    browser_version: "141.0.0.0",
    target_uid: uid,
    packed: "false",
    msToken: "",
  });
  const query = params.toString();
  const api = `https://live.douyin.com/webcast/user/?${query}&a_bogus=${encodeURIComponent(abSign(query, PC_HEADERS["user-agent"]))}`;
  const cookie = await fetchDouyinSessionCookie();

  const res = await fetch(api, {
    headers: { ...PC_HEADERS, cookie },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;

  const text = await res.text();
  if (!text || text.startsWith("<!DOCTYPE")) return null;

  let json: {
    status_code?: number;
    data?: {
      user?: { follow_info?: DouyinUserFollowInfo };
      follow_info?: DouyinUserFollowInfo;
    };
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return null;
  }
  if (Number(json.status_code || 0) !== 0) return null;
  return json.data?.user?.follow_info || json.data?.follow_info || null;
}

export async function resolveDouyinInternalRoomId(
  webRid: string,
  roomData?: DouyinRoomData,
): Promise<string> {
  const fromData = String(roomData?.id_str || roomData?.id || "").trim();
  if (fromData) return fromData;

  const rid = String(webRid).trim();
  if (!rid) return "";

  try {
    const cookie = await fetchDouyinSessionCookie();
    const res = await fetch(`https://live.douyin.com/${rid}`, {
      headers: {
        ...PC_HEADERS,
        referer: `https://live.douyin.com/${rid}`,
        cookie,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const match = html.match(/roomId\\":\\"(\d+)\\"/) || html.match(/"roomId":"(\d+)"/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}
