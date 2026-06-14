import { httpsUrl } from "../../utils/https-url.js";

const PC_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://live.bilibili.com/",
};

export const BILIBILI_QN_TIERS = [
  { qn: 10000, name: "原画" },
  { qn: 400, name: "蓝光" },
  { qn: 250, name: "超清" },
  { qn: 150, name: "高清" },
  { qn: 80, name: "流畅" },
] as const;

export interface BilibiliRoomInfo {
  room_id: number;
  uid: number;
  live_status: number;
  title: string;
  uname: string;
  anchor_info?: { base_info?: { uname?: string } };
  user_cover: string;
  keyframe: string;
  face: string;
  parent_area_name: string;
  area_name: string;
  attention?: number;
  online?: number;
  live_time?: string;
}

export interface BilibiliPlayCodec {
  base_url?: string;
  current_qn?: number;
  accept_qn?: number[];
  url_info?: Array<{ host?: string; extra?: string }>;
}

async function fetchJson<T>(
  url: string,
  params?: Record<string, string | number>,
  roomId?: string,
): Promise<T> {
  const u = new URL(url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      u.searchParams.set(key, String(value));
    }
  }
  const referer = roomId ? `https://live.bilibili.com/${roomId}` : PC_HEADERS.Referer;
  const res = await fetch(u, {
    headers: { ...PC_HEADERS, Referer: referer, Origin: "https://live.bilibili.com" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`B 站 API HTTP ${res.status}`);
  }
  const json = (await res.json()) as { code?: number; message?: string; data?: T };
  if (Number(json.code ?? 0) !== 0) {
    throw new Error(json.message || `B 站 API 错误 ${json.code ?? "unknown"}`);
  }
  return json.data as T;
}

export interface BilibiliAnchorInfo {
  uname: string;
  face: string;
}

export async function fetchAnchorInRoom(roomId: string): Promise<BilibiliAnchorInfo> {
  const data = await fetchJson<{ info?: { uname?: string; face?: string } }>(
    "https://api.live.bilibili.com/live_user/v1/UserInfo/get_anchor_in_room",
    { roomid: roomId },
  );
  return {
    uname: String(data.info?.uname || ""),
    face: httpsUrl(String(data.info?.face || "")),
  };
}

export async function fetchRoomInfo(roomId: string): Promise<BilibiliRoomInfo> {
  return fetchJson<BilibiliRoomInfo>(
    "https://api.live.bilibili.com/room/v1/Room/get_info",
    { room_id: roomId },
    roomId,
  );
}

function pickFlvCodec(data: Record<string, unknown> | undefined, preferQn?: number): BilibiliPlayCodec | null {
  const playurl = (data?.playurl_info as Record<string, unknown> | undefined)?.playurl as
    | Record<string, unknown>
    | undefined;
  const streams = (playurl?.stream as Array<Record<string, unknown>>) || [];
  const httpStream = streams.find((item) => item.protocol_name === "http_stream") || streams[0];
  const formats = (httpStream?.format as Array<Record<string, unknown>>) || [];
  const flvFormat = formats.find((item) => item.format_name === "flv") || formats[0];
  const codecs = (flvFormat?.codec as BilibiliPlayCodec[]) || [];
  if (!codecs.length) return null;
  const nonHevc = codecs.filter((c) => !String(c.base_url || "").includes("minihevc"));
  const pool = nonHevc.length ? nonHevc : codecs;
  if (preferQn != null) {
    const matched = pool.find((c) => Number(c.current_qn) === preferQn);
    if (matched) return matched;
    return pool.reduce((best, item) =>
      Number(item.current_qn ?? 0) > Number(best.current_qn ?? 0) ? item : best,
    pool[0]);
  }
  return pool[0] || null;
}

export async function fetchRoomPlayCodec(roomId: string, qn = 10000): Promise<BilibiliPlayCodec | null> {
  const data = await fetchJson<Record<string, unknown>>(
    "https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo",
    {
      room_id: roomId,
      protocol: "0,1",
      format: "0,1,2",
      codec: "0,1",
      qn,
      platform: "web",
      ptype: 8,
    },
    roomId,
  );
  return pickFlvCodec(data, qn);
}

export function buildFlvUrl(codec: BilibiliPlayCodec, lineIndex = 0): string {
  const urlInfo = codec.url_info?.[lineIndex] || codec.url_info?.[0];
  if (!urlInfo?.host || !codec.base_url || !urlInfo.extra) {
    return "";
  }
  // B 站 CDN 校验 qn 与签名一致，必须原样使用 API 返回的 extra
  return httpsUrl(`${urlInfo.host}${codec.base_url}${urlInfo.extra}`);
}

export function flvLinesForQn(codec: BilibiliPlayCodec, _qn?: number): Array<{ name: string; url: string }> {
  const lines: Array<{ name: string; url: string }> = [];
  const urlInfos = codec.url_info || [];
  if (!urlInfos.length) {
    const url = buildFlvUrl(codec, 0);
    if (url) lines.push({ name: "线路1", url });
    return lines;
  }
  urlInfos.forEach((info, index) => {
    const url = buildFlvUrl({ ...codec, url_info: [info] }, 0);
    if (url) {
      lines.push({ name: `线路${index + 1}`, url });
    }
  });
  return lines;
}

export function coverFromRoom(info: BilibiliRoomInfo): string {
  return httpsUrl(String(info.user_cover || info.keyframe || ""));
}

export function avatarFromRoom(info: BilibiliRoomInfo): string {
  return httpsUrl(String(info.face || ""));
}

export interface BilibiliGuardInfo {
  /** 大航海总人数，对应 UI「大航海」/ guard 字段 */
  total: number;
  /** 舰长（guard_level=3） */
  captain: number;
  /** 提督（2）+ 总督（1） */
  admiral: number;
}

interface BilibiliGuardListItem {
  guard_level?: number;
}

/** 大航海人数：guardTab/topList → data.info.num；分级从 top3+list 抽样统计 */
export async function fetchBilibiliGuardInfo(
  roomId: string,
  anchorUid: number,
): Promise<BilibiliGuardInfo> {
  const rid = String(roomId).trim();
  const ruid = Number(anchorUid || 0);
  if (!rid || !ruid) return { total: 0, captain: 0, admiral: 0 };

  const data = await fetchJson<{
    info?: { num?: number };
    top3?: BilibiliGuardListItem[];
    list?: BilibiliGuardListItem[];
  }>(
    "https://api.live.bilibili.com/xlive/app-room/v2/guardTab/topList",
    { roomid: rid, ruid, page: 1, page_size: 50 },
    rid,
  );

  const total = Number(data.info?.num ?? 0);
  let captain = 0;
  let admiral = 0;
  for (const item of [...(data.top3 || []), ...(data.list || [])]) {
    const level = Number(item.guard_level ?? 0);
    if (level === 3) captain += 1;
    else if (level === 1 || level === 2) admiral += 1;
  }
  return { total, captain, admiral };
}
