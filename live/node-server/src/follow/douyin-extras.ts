import { abSign } from "../resolve/douyin/ab-sign.js";
import {
  DOUYIN_PC_HEADERS,
  fetchDouyinSessionCookie,
  type DouyinRoomData,
} from "../resolve/douyin/web-stream.js";
import { formatCount, formatPlainCount } from "../utils/format-online.js";
import { getDouyinRoomMeta } from "../danmaku/douyin-meta.js";
import { normalizeUnixTime } from "../danmaku/protobuf-lite.js";
import type { FollowState } from "./status.js";

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function pickUnixTime(...values: unknown[]): number {
  for (const value of values) {
    const normalized = normalizeUnixTime(Number(value ?? 0));
    if (normalized > 0) return normalized;
  }
  return 0;
}

function partitionTitle(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  const partition = (obj.partition || obj) as Record<string, unknown>;
  return pickText(partition.title, partition.name);
}

export function pickDouyinCategory(room: DouyinRoomData): string {
  const gameTagInfo = room.game_data?.game_tag_info;
  const fromGame = pickText(gameTagInfo?.game_tag_name);
  if (fromGame) return fromGame;

  const road = room.partition_road_map as Record<string, unknown> | undefined;
  if (road) {
    const sub = partitionTitle(road.sub_partition);
    const main = partitionTitle(road.partition);
    if (sub && main && sub !== main) return `${main} · ${sub}`;
    return pickText(sub, main);
  }
  const gameTag = room.game_tag as Record<string, unknown> | undefined;
  return pickText(gameTag?.name, room.category_name, room.category);
}

export function pickDouyinLiveTimes(
  room: DouyinRoomData,
  state: FollowState,
): { liveStartAt: number; lastLiveAt: number } {
  const start = pickUnixTime(
    room.create_time,
    room.start_time,
    room.open_time,
    room.live_start_time,
  );
  if (state === "offline") {
    return { liveStartAt: 0, lastLiveAt: start };
  }
  return { liveStartAt: start, lastLiveAt: 0 };
}

function pickFanGroupFromRoom(room: DouyinRoomData): string {
  const auth = (room.room_auth || {}) as Record<string, unknown>;
  const fansClub = (auth.FansClub || auth.fans_club || room.fansclub || {}) as Record<string, unknown>;
  const candidates = [
    fansClub.fans_count,
    fansClub.member_count,
    fansClub.total,
    room.fansclub_total,
    room.fansclub_count,
    room.fan_ticket_count,
  ];
  for (const value of candidates) {
    const num = Number(value ?? 0);
    if (Number.isFinite(num) && num > 0) return formatCount(num);
  }
  return "";
}

async function signedDouyinGet(path: string, params: Record<string, string>, referer: string) {
  const query = new URLSearchParams(params).toString();
  const api = `https://live.douyin.com${path}?${query}&a_bogus=${encodeURIComponent(abSign(query, DOUYIN_PC_HEADERS["user-agent"]))}`;
  const cookie = await fetchDouyinSessionCookie();
  const res = await fetch(api, {
    headers: { ...DOUYIN_PC_HEADERS, referer, cookie },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text.startsWith("<!DOCTYPE")) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchDouyinVipCount(internalRoomId: string, webRid: string): Promise<string> {
  const roomId = String(internalRoomId || "").trim();
  if (!roomId) return "";
  const json = await signedDouyinGet(
    "/webcast/ranklist/audience/",
    {
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
      webcast_sdk_version: "2450",
      room_id: roomId,
      rank_type: "30",
      ignoreToast: "true",
      msToken: "",
    },
    `https://live.douyin.com/${webRid}`,
  );
  if (!json || Number(json.status_code || 0) !== 0) return "";
  const data = (json.data || {}) as Record<string, unknown>;
  const total = data.total ?? data.total_user ?? data.count ?? data.total_count;
  const totalNum = Number(total);
  if (Number.isFinite(totalNum) && totalNum > 0) {
    return formatPlainCount(totalNum);
  }
  const ranks = Array.isArray(data.ranks) ? data.ranks : [];
  return ranks.length ? formatCount(ranks.length) : "";
}

export async function fetchDouyinAudienceExtras(
  room: DouyinRoomData,
  webRid: string,
): Promise<{ fanGroup: string; vip: string }> {
  const internalRoomId = String(room.id_str || room.id || "").trim();
  const fanGroup = pickFanGroupFromRoom(room);
  let vip = "";
  if (Number(room.status || 0) === 2) {
    vip = await fetchDouyinVipCount(internalRoomId, webRid);
  }
  return { fanGroup, vip };
}
