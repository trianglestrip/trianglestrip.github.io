import {
  avatarFromRoom,
  coverFromRoom,
  fetchAnchorInRoom,
  fetchBilibiliGuardInfo,
  fetchRoomInfo,
} from "../resolve/bilibili/web-stream.js";
import { coverFromRoom as coverFromDouyuRoom, fetchBetard } from "../resolve/douyu/betard.js";
import { fetchDouyinUserFollowInfo, fetchWebStreamData } from "../resolve/douyin/web-stream.js";
import {
  fetchDouyinAudienceExtras,
  pickDouyinCategory,
  resolveDouyinLiveTimes,
} from "./douyin-extras.js";
import { huyaRoomState, profileNeedsPageCheck } from "./huya-state.js";
import { fetchHuyaPageRoomFlags } from "../resolve/huya/web-stream.js";
import { fetchHuyaGuardInfo, fetchHuyaVipCount } from "./huya-wup.js";
import { getDouyinRoomMeta } from "../danmaku/douyin-meta.js";
import { isPlausibleLiveStartAt } from "../danmaku/protobuf-lite.js";
import { formatCount, formatOnline, formatPlainCount } from "../utils/format-online.js";

export type FollowState = "live" | "replay" | "offline";

export interface FollowSnapshot {
  site: string;
  id: string;
  state: FollowState;
  avatar: string;
  cover: string;
  title: string;
  anchor: string;
  category: string;
  fans: string;
  online: string;
  /** 斗鱼：钻粉数 */
  diamondFans: string;
  /** 斗鱼：粉丝团人数 */
  fanGroup: string;
  /** 虎牙：守护总数 */
  guard: string;
  /** 虎牙：贵宾数 */
  vip: string;
  /** 虎牙：普通守护数（iGuardType=0，排序用） */
  guardNormal: number;
  /** 虎牙：超关守护数（iGuardType=2，排序用） */
  guardSuper: number;
  /** 离线：上次开播 Unix 秒时间戳 */
  lastLiveAt: number;
  /** 直播中/重播：本场开播 Unix 秒时间戳 */
  liveStartAt: number;
}

const STATUS_ORDER: Record<FollowState, number> = { live: 0, replay: 1, offline: 2 };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HUYA_HEADERS = {
  "User-Agent": USER_AGENT,
  Origin: "https://www.huya.com",
  Referer: "https://www.huya.com/",
};

const DOUYU_HEADERS = {
  "User-Agent": USER_AGENT,
  Referer: "https://www.douyu.com/",
  Origin: "https://www.douyu.com",
  "Client-Type": "web",
};

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function pickUnixTime(...values: unknown[]): number {
  for (const value of values) {
    const num = Number(value ?? 0);
    if (Number.isFinite(num) && num > 1_000_000_000) return Math.trunc(num);
  }
  return 0;
}

function httpsUrl(text: string): string {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

function avatarFromDouyu(room: Record<string, unknown>): string {
  const avatar = room.avatar;
  if (avatar && typeof avatar === "object") {
    const obj = avatar as Record<string, unknown>;
    return httpsUrl(String(obj.big || obj.middle || obj.small || ""));
  }
  return httpsUrl(String(avatar || ""));
}

function douyuState(room: Record<string, unknown>): FollowState {
  const showStatus = Number(room.show_status ?? 0);
  if (showStatus !== 1) return "offline";
  const videoLoop = Number(room.videoLoop ?? 0);
  if (videoLoop === 1) return "replay";
  return "live";
}

function douyuOnlineText(state: FollowState, hn: string): string {
  if (state === "offline") return "";
  const text = String(hn || "").trim();
  if (!text || text === "0") return "";
  return text;
}

async function resolveHuyaFollowState(data: Record<string, unknown>, roomId: string): Promise<FollowState> {
  let page: { isOn?: boolean; isReplay?: boolean } | undefined;
  if (profileNeedsPageCheck(data)) {
    const flags = await fetchHuyaPageRoomFlags(roomId);
    if (flags) page = flags;
  }
  return huyaRoomState(data, page);
}

function avatarFromHuya(profile: Record<string, unknown>): string {
  return httpsUrl(String(profile.avatar180 || profile.avatar || ""));
}

async function fetchDouyuRoomApi(rid: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://m.douyu.com/api/room/info?rid=${rid}`, {
    headers: DOUYU_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { code?: number; data?: { roomInfo?: Record<string, unknown> } };
  if (Number(payload.code ?? -1) !== 0) return null;
  return payload.data?.roomInfo || null;
}

async function fetchDouyuMobileRoom(rid: string): Promise<Record<string, unknown> | null> {
  const apiInfo = await fetchDouyuRoomApi(rid);
  if (apiInfo) return apiInfo;
  const res = await fetch(`https://m.douyu.com/${rid}`, {
    headers: DOUYU_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/id="vike_pageContext"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const ctx = JSON.parse(match[1]) as {
      pageProps?: { room?: { roomInfo?: Record<string, unknown> } };
    };
    const block = ctx.pageProps?.room?.roomInfo;
    if (!block) return null;
    const inner = block.roomInfo as Record<string, unknown> | undefined;
    return inner || block;
  } catch {
    return null;
  }
}

async function fetchDouyuAnchorExtras(rid: string): Promise<{
  fans: string;
  diamondFans: string;
  fanGroup: string;
}> {
  const empty = { fans: "", diamondFans: "", fanGroup: "" };
  try {
    const res = await fetch(
      `https://www.douyu.com/wgapi/livenc/liveweb/getAnchorNewCard?rid=${rid}&client_sys=web`,
      { headers: DOUYU_HEADERS, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return empty;
    const payload = (await res.json()) as { data?: Record<string, unknown> };
    const data = payload.data || {};
    const anchorLevel = (data.anchorLevel || {}) as Record<string, unknown>;
    const dFansInfo = (anchorLevel.dFansInfo || {}) as Record<string, unknown>;
    const functionShow = (data.functionShow || {}) as Record<string, unknown>;
    const fanGroup = (functionShow.fanGroup || {}) as Record<string, unknown>;
    const roomInfo = (data.roomInfo || {}) as Record<string, unknown>;
    return {
      fans: formatCount(roomInfo.fansNum as number | string),
      diamondFans: formatCount(dFansInfo.curDfansNum as number | string),
      fanGroup: formatCount(fanGroup.cnt as number | string),
    };
  } catch {
    return empty;
  }
}

async function fetchDouyuSnapshot(roomId: string): Promise<FollowSnapshot> {
  const rid = String(roomId).trim();
  const [room, mobile, extras] = await Promise.all([
    fetchBetard(rid),
    fetchDouyuMobileRoom(rid),
    fetchDouyuAnchorExtras(rid),
  ]);
  const raw = room as unknown as Record<string, unknown>;
  const mobileInfo = mobile || {};
  const state = douyuState(raw);
  const hn = String(mobileInfo.hn || "").trim();
  const lastLiveAt = state === "offline" ? pickUnixTime(mobileInfo.showTime, raw.show_time) : 0;
  const liveStartAt =
    state === "live" || state === "replay" ? pickUnixTime(mobileInfo.showTime, raw.show_time) : 0;

  return {
    site: "douyu",
    id: rid,
    state,
    avatar: httpsUrl(String(mobileInfo.avatar || "")) || avatarFromDouyu(raw),
    cover: coverFromDouyuRoom(room),
    title: String(mobileInfo.roomName || raw.room_name || ""),
    anchor: String(mobileInfo.nickname || raw.nickname || ""),
    category: pickText(
      mobileInfo.gameName,
      mobileInfo.cate2Name,
      mobileInfo.cateName,
      raw.cate2_name,
      raw.game_name,
      raw.cate_name,
    ),
    fans: extras.fans,
    online: douyuOnlineText(state, hn),
    diamondFans: extras.diamondFans,
    fanGroup: extras.fanGroup,
    guard: "",
    vip: "",
    guardNormal: 0,
    guardSuper: 0,
    lastLiveAt,
    liveStartAt,
  };
}

async function fetchDouyinSnapshot(roomId: string): Promise<FollowSnapshot> {
  const rid = String(roomId).trim();
  const roomData = await fetchWebStreamData(rid);
  const status = Number(roomData.status || 0);
  const state: FollowState = status === 2 ? "live" : "offline";
  const coverList = roomData.cover?.url_list || [];
  const owner = roomData.owner || {};
  const avatarThumb = owner.avatar_thumb?.url_list || owner.avatar_medium?.url_list || [];
  const { liveStartAt: startAt, lastLiveAt } = await resolveDouyinLiveTimes(roomData, rid, state);
  let liveStartAt = startAt;

  let fans = "";
  const ownerFans = owner.follow_info?.follower_count;
  if (ownerFans) {
    fans = formatCount(ownerFans);
  } else if (owner.id_str) {
    const followInfo = await fetchDouyinUserFollowInfo(owner.id_str);
    if (followInfo?.follower_count) {
      fans = formatCount(followInfo.follower_count);
    }
  }

  const extras =
    state === "live"
      ? await fetchDouyinAudienceExtras(roomData, rid)
      : { fanGroup: "", vip: "" };

  const cachedMeta = getDouyinRoomMeta(rid);
  if (!liveStartAt && cachedMeta?.liveStartAt && isPlausibleLiveStartAt(cachedMeta.liveStartAt)) {
    liveStartAt = cachedMeta.liveStartAt;
  }
  if (cachedMeta?.fanGroup && !extras.fanGroup) {
    extras.fanGroup = cachedMeta.fanGroup;
  }

  const onlineRaw =
    roomData.user_count_str ||
    roomData.user_count ||
    "";

  return {
    site: "douyin",
    id: rid,
    state,
    avatar: httpsUrl(avatarThumb[0] || ""),
    cover: httpsUrl(coverList[0] || ""),
    title: roomData.title || roomData.anchor_name || "",
    anchor: roomData.anchor_name || owner.nickname || "",
    category: pickDouyinCategory(roomData),
    fans,
    online: state === "live" ? formatPlainCount(onlineRaw) : "",
    diamondFans: "",
    fanGroup: extras.fanGroup,
    guard: "",
    vip: extras.vip,
    guardNormal: 0,
    guardSuper: 0,
    lastLiveAt,
    liveStartAt,
  };
}

async function fetchHuyaSnapshot(roomId: string): Promise<FollowSnapshot> {
  const rid = String(roomId).trim();
  const url = new URL("https://mp.huya.com/cache.php");
  url.searchParams.set("m", "Live");
  url.searchParams.set("do", "profileRoom");
  url.searchParams.set("roomid", rid);
  url.searchParams.set("showSecret", "1");
  const res = await fetch(url, { headers: HUYA_HEADERS, signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    throw new Error(`虎牙房间信息 HTTP ${res.status}`);
  }
  const payload = (await res.json()) as Record<string, unknown>;
  if (Number(payload.status || 0) !== 200) {
    throw new Error(String(payload.message || "虎牙房间信息获取失败"));
  }
  const data = (payload.data || {}) as Record<string, unknown>;
  const profile = (data.profileInfo || {}) as Record<string, unknown>;
  const liveData = (data.liveData || {}) as Record<string, unknown>;
  const state = await resolveHuyaFollowState(data, rid);
  const fansRaw = profile.activityCount ?? liveData.activityCount;
  const onlineRaw = liveData.totalCount ?? liveData.userCount;
  const presenterUid = Number(profile.uid || liveData.uid || 0);
  const channelId = Number(liveData.liveChannel || liveData.channel || presenterUid);
  const isLive = state === "live";
  const [vip, guardInfo] = isLive
    ? await Promise.all([
        fetchHuyaVipCount(presenterUid, channelId),
        fetchHuyaGuardInfo(presenterUid),
      ])
    : ["", { display: "", breakdown: { total: 0, normal: 0, super: 0, supreme: 0 } }];
  const lastLiveAt = state === "offline" ? pickUnixTime(liveData.startTime, liveData.updateCacheTime) : 0;
  const liveStartAt =
    state === "live" || state === "replay" ? pickUnixTime(liveData.startTime) : 0;

  return {
    site: "huya",
    id: rid,
    state,
    avatar: avatarFromHuya(profile),
    cover: httpsUrl(String(liveData.screenshot || liveData.cover || "")),
    title: String(liveData.introduction || liveData.roomName || profile.nick || ""),
    anchor: String(profile.nick || ""),
    category: pickText(liveData.gameHostName, liveData.sGameFullName, profile.gameHostName),
    fans: formatCount(fansRaw as number | string),
    online: state === "offline" ? "" : formatOnline(onlineRaw as number | string),
    diamondFans: "",
    fanGroup: "",
    guard: guardInfo.display,
    vip,
    guardNormal: guardInfo.breakdown.normal,
    guardSuper: guardInfo.breakdown.super + guardInfo.breakdown.supreme,
    lastLiveAt,
    liveStartAt,
  };
}

function parseBilibiliLiveTime(text: string): number {
  const value = String(text || "").trim();
  if (!value) return 0;
  const ms = Date.parse(`${value.replace(" ", "T")}+08:00`);
  return Number.isFinite(ms) && ms > 0 ? Math.trunc(ms / 1000) : 0;
}

async function fetchBilibiliSnapshot(roomId: string): Promise<FollowSnapshot> {
  const rid = String(roomId).trim();
  const [info, anchor] = await Promise.all([
    fetchRoomInfo(rid),
    fetchAnchorInRoom(rid).catch(() => ({ uname: "", face: "" })),
  ]);
  const state: FollowState = Number(info.live_status) === 1 ? "live" : "offline";
  const liveStartAt = state === "live" ? parseBilibiliLiveTime(String(info.live_time || "")) : 0;
  const anchorUid = Number(info.uid || 0);
  const guardInfo =
    state === "live"
      ? await fetchBilibiliGuardInfo(rid, anchorUid).catch(() => ({ total: 0, captain: 0, admiral: 0 }))
      : { total: 0, captain: 0, admiral: 0 };

  return {
    site: "bilibili",
    id: rid,
    state,
    avatar: anchor.face || avatarFromRoom(info),
    cover: coverFromRoom(info),
    title: String(info.title || ""),
    anchor: String(anchor.uname || info.uname || ""),
    category: pickText(info.area_name, info.parent_area_name),
    fans: formatCount(info.attention as number | string),
    online: state === "offline" ? "" : formatOnline(info.online as number | string),
    diamondFans: "",
    fanGroup: "",
    guard: formatCount(guardInfo.total),
    vip: "",
    guardNormal: guardInfo.captain,
    guardSuper: guardInfo.admiral,
    lastLiveAt: 0,
    liveStartAt,
  };
}

function emptySnapshot(site: string, id: string): FollowSnapshot {
  return {
    site,
    id,
    state: "offline",
    avatar: "",
    cover: "",
    title: "",
    anchor: "",
    category: "",
    fans: "",
    online: "",
    diamondFans: "",
    fanGroup: "",
    guard: "",
    vip: "",
    guardNormal: 0,
    guardSuper: 0,
    lastLiveAt: 0,
    liveStartAt: 0,
  };
}

async function fetchOne(site: string, roomId: string): Promise<FollowSnapshot> {
  const normalizedSite = String(site || "").trim();
  const rid = String(roomId || "").trim();
  if (!normalizedSite || !rid) {
    return emptySnapshot(normalizedSite, rid);
  }
  try {
    if (normalizedSite === "douyu") return await fetchDouyuSnapshot(rid);
    if (normalizedSite === "huya") return await fetchHuyaSnapshot(rid);
    if (normalizedSite === "douyin") return await fetchDouyinSnapshot(rid);
    if (normalizedSite === "bilibili") return await fetchBilibiliSnapshot(rid);
  } catch {
    /* fall through */
  }
  return emptySnapshot(normalizedSite, rid);
}

export async function fetchFollowSnapshots(
  rooms: Array<{ site?: string; id?: string; roomId?: string }>,
): Promise<FollowSnapshot[]> {
  const tasks: Promise<FollowSnapshot>[] = [];
  const seen = new Set<string>();
  for (const item of rooms || []) {
    const site = String(item.site || "").trim();
    const id = String(item.id || item.roomId || "").trim();
    const key = `${site}:${id}`;
    if (!site || !id || seen.has(key)) continue;
    seen.add(key);
    tasks.push(fetchOne(site, id));
  }
  const results = await Promise.all(tasks);
  return results.sort((a, b) => {
    const byState = (STATUS_ORDER[a.state] ?? 9) - (STATUS_ORDER[b.state] ?? 9);
    if (byState !== 0) return byState;
    return a.site.localeCompare(b.site) || a.id.localeCompare(b.id);
  });
}
