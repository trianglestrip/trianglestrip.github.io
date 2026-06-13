import { huyaRoomState, profileNeedsPageCheck, type HuyaPageRoomFlags } from "../../follow/huya-state.js";
import { buildAntiCode } from "./anti-code.js";
import { httpsUrl } from "../../utils/https-url.js";

const PC_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://www.huya.com/",
};

const MOBILE_HEADERS = {
  "user-agent": "ios/7.830 (ios 17.0; ; iPhone 15 (A2846/A3089/A3090/A3092))",
  "xweb_xhr": "1",
  referer: "https://servicewechat.com/wx74767bf0b684f7d3/301/page-frame.html",
  "accept-language": "zh-CN,zh;q=0.9",
};

export interface HuyaWebData {
  data?: Array<{
    gameLiveInfo?: Record<string, unknown>;
    gameStreamInfoList?: Array<Record<string, unknown>>;
  }>;
  vMultiStreamInfo?: Array<{ sDisplayName?: string; iBitRate?: number }>;
  live_url?: string;
}

async function fetchHuyaProfilePayload(roomId: string): Promise<Record<string, unknown> | null> {
  const rid = String(roomId || "").trim();
  if (!rid) return null;
  const params = new URLSearchParams({
    m: "Live",
    do: "profileRoom",
    roomid: rid,
    showSecret: "1",
  });
  const res = await fetch(`https://mp.huya.com/cache.php?${params}`, {
    headers: PC_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Record<string, unknown> };
  return json.data || null;
}

export async function fetchHuyaProfileAvatar(roomId: string): Promise<string> {
  try {
    const data = await fetchHuyaProfilePayload(roomId);
    if (!data) return "";
    const profile = (data.profileInfo || {}) as Record<string, unknown>;
    return httpsUrl(String(profile.avatar180 || profile.avatar || ""));
  } catch {
    return "";
  }
}

export async function fetchHuyaPageRoomFlags(roomId: string): Promise<HuyaPageRoomFlags | null> {
  const rid = String(roomId || "").trim();
  if (!rid) return null;
  try {
    const res = await fetch(`https://www.huya.com/${rid}`, {
      headers: PC_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/TT_ROOM_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;
    const tt = JSON.parse(match[1]) as { isOn?: boolean; isReplay?: boolean };
    return { isOn: Boolean(tt.isOn), isReplay: Boolean(tt.isReplay) };
  } catch {
    return null;
  }
}

async function resolveHuyaRoomState(
  data: Record<string, unknown>,
  roomId: string,
): Promise<ReturnType<typeof huyaRoomState>> {
  let page: HuyaPageRoomFlags | undefined;
  if (profileNeedsPageCheck(data)) {
    const flags = await fetchHuyaPageRoomFlags(roomId);
    if (flags) page = flags;
  }
  return huyaRoomState(data, page);
}

export async function fetchHuyaProfileBrief(roomId: string): Promise<{
  avatar: string;
  roomState: ReturnType<typeof huyaRoomState>;
}> {
  try {
    const data = await fetchHuyaProfilePayload(roomId);
    if (!data) return { avatar: "", roomState: "offline" };
    const profile = (data.profileInfo || {}) as Record<string, unknown>;
    const roomState = await resolveHuyaRoomState(data, roomId);
    return {
      avatar: httpsUrl(String(profile.avatar180 || profile.avatar || "")),
      roomState,
    };
  } catch {
    return { avatar: "", roomState: "offline" };
  }
}

export async function fetchWebStreamData(url: string): Promise<HuyaWebData> {
  const res = await fetch(url, {
    headers: PC_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`虎牙页面 HTTP ${res.status}`);
  }
  const html = await res.text();
  const match = html.match(/stream:\s*(\{"data".*?),"iWebDefaultBitRate"/);
  if (!match) {
    throw new Error("无法解析虎牙页面流数据");
  }
  const jsonData = JSON.parse(`${match[1]}}`) as HuyaWebData;
  jsonData.live_url = url;
  return jsonData;
}

export interface HuyaAppData {
  anchor_name?: string;
  is_live?: boolean;
  title?: string;
  flv_url?: string;
  m3u8_url?: string;
}

async function resolveRoomId(url: string): Promise<string> {
  let roomId = url.split("?")[0].split("/").pop() || "";
  if (/[a-zA-Z]/.test(roomId)) {
    const res = await fetch(url, { headers: MOBILE_HEADERS, signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    const match = html.match(/ProfileRoom":(\d+),"sPrivateHost/);
    if (!match) {
      throw new Error('请使用 "https://www.huya.com/+room_number" 解析');
    }
    roomId = match[1];
  }
  return roomId;
}

export async function fetchAppStreamData(url: string): Promise<HuyaAppData> {
  const roomId = await resolveRoomId(url);
  const liveUrl = `https://www.huya.com/${roomId}`;
  const params = new URLSearchParams({
    m: "Live",
    do: "profileRoom",
    roomid: roomId,
    showSecret: "1",
  });
  const apiUrl = `https://mp.huya.com/cache.php?${params}`;
  const res = await fetch(apiUrl, {
    headers: PC_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`虎牙 app API HTTP ${res.status}`);
  }
  const jsonData = (await res.json()) as {
    data?: {
      profileInfo?: { nick?: string };
      realLiveStatus?: string;
      liveData?: { introduction?: string; gameHostName?: string };
      stream?: { baseSteamInfoList?: Array<Record<string, unknown>> };
    };
  };

  const profileData = (jsonData.data || {}) as Record<string, unknown>;
  const profileInfo = (profileData.profileInfo || {}) as Record<string, unknown>;
  const anchorName = String(profileInfo.nick || "");
  let page: HuyaPageRoomFlags | undefined;
  if (profileNeedsPageCheck(profileData)) {
    const flags = await fetchHuyaPageRoomFlags(roomId);
    if (flags) page = flags;
  }
  const roomState = huyaRoomState(profileData, page);
  if (roomState !== "live") {
    return { anchor_name: anchorName, is_live: false };
  }

  const liveTitle = jsonData.data?.liveData?.introduction || "";
  const baseList = jsonData.data?.stream?.baseSteamInfoList || [];
  if (!baseList.length) {
    return { anchor_name: anchorName, is_live: false, title: liveTitle };
  }

  const playUrlList: Array<{ cdn_type: string; flv_url: string; m3u8_url: string }> = [];
  for (const item of baseList) {
    const cdnType = String(item.sCdnType || "");
    const streamName = String(item.sStreamName || "");
    const sFlvUrl = String(item.sFlvUrl || "");
    const flvAntiCode = String(item.sFlvAntiCode || "");
    const sHlsUrl = String(item.sHlsUrl || "");
    const hlsAntiCode = String(item.sHlsAntiCode || "");
    playUrlList.push({
      cdn_type: cdnType,
      m3u8_url: `${sHlsUrl}/${streamName}.m3u8?${hlsAntiCode}`,
      flv_url: `${sFlvUrl}/${streamName}.flv?${flvAntiCode}`,
    });
  }

  let selectItem = playUrlList.find((item) => item.cdn_type === "TX") || playUrlList[0];
  let flvUrl = selectItem?.flv_url || "";
  let m3u8Url = selectItem?.m3u8_url || "";
  if (selectItem && ["TX", "HW"].includes(selectItem.cdn_type)) {
    flvUrl = flvUrl.replace("&ctype=tars_mp", "&ctype=huya_webh5").replace("&fs=bhct", "&fs=bgct");
    m3u8Url = m3u8Url.replace("&ctype=tars_mp", "&ctype=huya_webh5").replace("&fs=bhct", "&fs=bgct");
  }

  return {
    anchor_name: anchorName,
    is_live: true,
    title: liveTitle,
    flv_url: flvUrl.replace("http://", "https://"),
    m3u8_url: m3u8Url.replace("http://", "https://"),
  };
}

export function lineName(streamInfo: Record<string, unknown>): string {
  const index = streamInfo.iLineIndex;
  if (index != null) {
    return `线路${index}`;
  }
  const cdn = String(streamInfo.sCdnType || "CDN");
  return `线路${cdn}`;
}

export function buildFlvUrl(streamInfo: Record<string, unknown>, ratio: number | string = ""): string {
  const flvUrl = String(streamInfo.sFlvUrl || "");
  const streamName = String(streamInfo.sStreamName || "");
  const suffix = String(streamInfo.sFlvUrlSuffix || "flv");
  const antiCode = String(streamInfo.sFlvAntiCode || "");
  if (!flvUrl || !streamName || !antiCode) {
    return "";
  }
  const newAntiCode = buildAntiCode(antiCode, streamName);
  const ratioStr = ratio === 0 || ratio === "0" || ratio === "" ? "" : String(ratio);
  const url = `${flvUrl}/${streamName}.${suffix}?${newAntiCode}&ratio=${ratioStr}`;
  return url.replace("http://", "https://");
}

export function qualityItems(webData: HuyaWebData): Array<{ name: string; rate: number }> {
  const items = webData.vMultiStreamInfo || [];
  if (items.length) {
    return items.map((item) => ({
      name: String(item.sDisplayName || `档${item.iBitRate ?? 0}`),
      rate: Number(item.iBitRate ?? 0),
    }));
  }
  return [{ name: "默认", rate: 0 }];
}

export function streamLines(webData: HuyaWebData, ratio: number | string = ""): Array<{ name: string; url: string }> {
  const streamList = webData.data?.[0]?.gameStreamInfoList || [];
  const lines: Array<{ name: string; url: string }> = [];
  for (const streamInfo of streamList) {
    const url = buildFlvUrl(streamInfo, ratio);
    if (!url) {
      continue;
    }
    lines.push({ name: lineName(streamInfo), url });
  }
  return lines;
}
