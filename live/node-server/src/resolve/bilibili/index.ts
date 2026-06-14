import { pickQualityName } from "../schema.js";
import {
  avatarFromRoom,
  BILIBILI_QN_TIERS,
  coverFromRoom,
  fetchRoomInfo,
  fetchRoomPlayCodec,
  flvLinesForQn,
  type BilibiliPlayCodec,
} from "./web-stream.js";
import { normalizeUrl, roomIdFromUrl } from "./normalize.js";

export interface BilibiliTier {
  name: string;
  lines: Array<{ name: string; url: string }>;
  play_url: string;
}

export interface BilibiliMeta {
  site: string;
  room_id: string;
  source_url: string;
  anchor_name: string;
  title: string;
  cover: string;
  avatar: string;
  available_qualities: Array<{ name: string; rate: number }>;
  offline?: boolean;
  room_state?: string;
  context?: {
    play_codec: BilibiliPlayCodec;
  };
}

function isLive(info: { live_status?: number }): boolean {
  return Number(info.live_status) === 1;
}

function availableQualities(codec: BilibiliPlayCodec): Array<{ name: string; rate: number }> {
  const accept = new Set((codec.accept_qn || []).map((qn) => Number(qn)));
  return BILIBILI_QN_TIERS.filter((tier) => accept.has(tier.qn)).map((tier) => ({
    name: tier.name,
    rate: tier.qn,
  }));
}

function tierFromQn(codec: BilibiliPlayCodec, qn: number, name: string): BilibiliTier | null {
  const lines = flvLinesForQn(codec, qn);
  if (!lines.length) return null;
  return {
    name,
    lines,
    play_url: lines[0].url,
  };
}

async function loadPlayContext(url: string) {
  const roomId = roomIdFromUrl(url);
  const info = await fetchRoomInfo(roomId);

  if (!isLive(info)) {
    return {
      url,
      room_id: roomId,
      anchor_name: String(info.uname || info.anchor_info?.base_info?.uname || ""),
      title: String(info.title || ""),
      cover: coverFromRoom(info),
      avatar: avatarFromRoom(info),
      qualities: [] as Array<{ name: string; rate: number }>,
      offline: true,
    };
  }

  const codec = await fetchRoomPlayCodec(roomId);
  if (!codec) {
    throw new Error("房间未开播或解析失败");
  }

  return {
    url,
    room_id: roomId,
    anchor_name: String(info.uname || info.anchor_info?.base_info?.uname || ""),
    title: String(info.title || info.uname || ""),
    cover: coverFromRoom(info),
    avatar: avatarFromRoom(info),
    qualities: availableQualities(codec),
    play_codec: codec,
  };
}

function metaFromContext(ctx: Awaited<ReturnType<typeof loadPlayContext>>): BilibiliMeta {
  return {
    site: "bilibili",
    room_id: ctx.room_id,
    source_url: ctx.url,
    anchor_name: ctx.anchor_name,
    title: ctx.title || ctx.anchor_name,
    cover: ctx.cover,
    avatar: ctx.avatar,
    available_qualities: ctx.qualities,
    offline: Boolean(ctx.offline),
    room_state: ctx.offline ? "offline" : "live",
    context: ctx.play_codec ? { play_codec: ctx.play_codec } : undefined,
  };
}

export async function loadMeta(url: string): Promise<BilibiliMeta> {
  const ctx = await loadPlayContext(url);
  return metaFromContext(ctx);
}

export async function resolveTier(meta: BilibiliMeta, qualityName?: string): Promise<BilibiliTier> {
  const codec = meta.context?.play_codec;
  if (!codec || meta.offline) {
    throw new Error("房间未开播");
  }
  const quality = pickQualityName(meta.available_qualities, qualityName);
  const qn = Number(quality.rate ?? BILIBILI_QN_TIERS[0].qn);
  const tierName = String(quality.name || BILIBILI_QN_TIERS[0].name);
  const tier = tierFromQn(codec, qn, tierName);
  if (!tier) {
    throw new Error(`未获取到档位 ${tierName} 的播放地址`);
  }
  return tier;
}

export async function resolveAllTiers(meta: BilibiliMeta): Promise<BilibiliTier[]> {
  const codec = meta.context?.play_codec;
  if (!codec || meta.offline) {
    throw new Error("房间未开播");
  }
  const streams: BilibiliTier[] = [];
  for (const quality of meta.available_qualities) {
    const tier = tierFromQn(codec, Number(quality.rate), String(quality.name));
    if (tier) streams.push(tier);
  }
  if (!streams.length) {
    throw new Error("未获取到可播放的 B 站 FLV 地址");
  }
  return streams;
}

export { normalizeUrl };
