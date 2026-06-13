import { pickQualityName } from "../schema.js";
import { fetchBetard, getRoomId, coverFromRoom, type BetardRoom } from "./betard.js";
import { fetchWhiteKey } from "./encryption.js";
import { fetchH5PlayV1, flvFromApiData, isDouyucdnUrl, type PlayV1Response } from "./play-v1.js";
import { normalizeUrl } from "./normalize.js";

export interface DouyuTier {
  name: string;
  lines: Array<{ name: string; url: string }>;
  play_url: string;
}

export interface DouyuMeta {
  site: string;
  room_id: string;
  source_url: string;
  anchor_name: string;
  title: string;
  cover: string;
  available_qualities: Array<{ name: string; rate: number }>;
  offline?: boolean;
  context?: {
    rid: string;
    url: string;
    anchor_name: string;
    multirates: Array<{ name?: string; rate?: number }>;
    cdns: Array<{ name?: string; cdn?: string }>;
    line_label: string;
    preferred_cdn: string;
    white: Awaited<ReturnType<typeof fetchWhiteKey>>;
    base: PlayV1Response;
  };
}

type DouyuPlayContext = NonNullable<DouyuMeta["context"]>;

function lineNameForCdn(cdns: Array<{ name?: string; cdn?: string }>, cdnCode: string): string {
  for (const item of cdns) {
    if (item.cdn === cdnCode) {
      return String(item.name || cdnCode);
    }
  }
  return cdnCode;
}

function availableQualities(multirates: Array<{ name?: string; rate?: number }>): Array<{ name: string; rate: number }> {
  return multirates.map((item) => ({
    name: String(item.name || `档${item.rate ?? 0}`),
    rate: Number(item.rate ?? 0),
  }));
}

function tierFromResponse(
  item: { name?: string; rate?: number },
  resp: PlayV1Response,
  lineLabel: string,
  seenPaths?: Set<string>,
): DouyuTier | null {
  if (resp.error !== 0) {
    return null;
  }
  const rate = String(item.rate ?? 0);
  const groupName = String(item.name || `档${rate}`);
  const info = resp.data || {};
  const playUrl = flvFromApiData(info);
  if (!isDouyucdnUrl(playUrl)) {
    return null;
  }
  if (seenPaths) {
    const pathKey = playUrl.split("?")[0].split("/").pop() || "";
    if (seenPaths.has(pathKey)) {
      return null;
    }
    seenPaths.add(pathKey);
  }
  return {
    name: groupName,
    lines: [{ name: lineLabel, url: playUrl }],
    play_url: playUrl,
  };
}

interface LoadPlayContextOpts {
  rid?: string;
  roomRaw?: BetardRoom;
  white?: Awaited<ReturnType<typeof fetchWhiteKey>>;
}

async function loadPlayContext(url: string, preferredCdn = "hw-h5", opts?: LoadPlayContextOpts) {
  const rid = opts?.rid ?? await getRoomId(url);
  const roomRaw = opts?.roomRaw ?? await fetchBetard(rid);
  const white = opts?.white ?? await fetchWhiteKey();

  if (roomRaw.show_status !== 1) {
    throw new Error("房间未开播或解析失败");
  }

  const base = await fetchH5PlayV1(rid, "0", white, preferredCdn);
  if (base.error !== 0) {
    throw new Error(base.msg || "getH5PlayV1 失败");
  }

  const apiData = base.data || {};
  const multirates = apiData.multirates || [];
  const cdns = apiData.cdnsWithName || [];
  if (!multirates.length) {
    throw new Error("未返回 multirates 档位信息");
  }

  return {
    rid,
    url,
    anchor_name: roomRaw.nickname || "",
    title: roomRaw.room_name || roomRaw.nickname || "",
    cover: coverFromRoom(roomRaw),
    white,
    base,
    multirates,
    cdns,
    line_label: lineNameForCdn(cdns, preferredCdn),
    preferred_cdn: preferredCdn,
  };
}

function metaFromContext(ctx: Awaited<ReturnType<typeof loadPlayContext>>): DouyuMeta {
  return {
    site: "douyu",
    room_id: ctx.rid,
    source_url: ctx.url,
    anchor_name: ctx.anchor_name,
    title: ctx.title || ctx.anchor_name,
    cover: ctx.cover,
    available_qualities: availableQualities(ctx.multirates),
    context: {
      rid: ctx.rid,
      url: ctx.url,
      anchor_name: ctx.anchor_name,
      multirates: ctx.multirates,
      cdns: ctx.cdns,
      line_label: ctx.line_label,
      preferred_cdn: ctx.preferred_cdn,
      white: ctx.white,
      base: ctx.base,
    },
  };
}

function contextFromMeta(meta: DouyuMeta): DouyuPlayContext | undefined {
  return meta.context;
}

async function fetchTierResponse(ctx: DouyuPlayContext, item: { rate?: number }): Promise<PlayV1Response> {
  const rate = String(item.rate ?? 0);
  if (rate === "0") {
    return ctx.base;
  }
  return fetchH5PlayV1(ctx.rid, rate, ctx.white, ctx.preferred_cdn);
}

export async function loadMeta(url: string, preferredCdn = "hw-h5"): Promise<DouyuMeta> {
  const rid = await getRoomId(url);
  const [roomRaw, white] = await Promise.all([fetchBetard(rid), fetchWhiteKey()]);
  if (roomRaw.show_status !== 1) {
    return {
      site: "douyu",
      room_id: rid,
      source_url: url,
      anchor_name: roomRaw.nickname || "",
      title: roomRaw.room_name || roomRaw.nickname || "",
      cover: coverFromRoom(roomRaw),
      available_qualities: [],
      offline: true,
    };
  }
  const ctx = await loadPlayContext(url, preferredCdn, { rid, roomRaw, white });
  return metaFromContext(ctx);
}

export async function resolveTier(meta: DouyuMeta, qualityName?: string): Promise<DouyuTier> {
  const ctx = contextFromMeta(meta);
  if (!ctx) {
    throw new Error("房间未开播");
  }
  const item = pickQualityName(meta.available_qualities, qualityName);
  const resp = await fetchTierResponse(ctx, item);
  const tier = tierFromResponse(item, resp, ctx.line_label);
  if (!tier) {
    throw new Error(`未获取到档位 ${item.name || qualityName} 的播放地址`);
  }
  return tier;
}

export async function resolveAllTiers(meta: DouyuMeta): Promise<DouyuTier[]> {
  const ctx = contextFromMeta(meta);
  if (!ctx) {
    throw new Error("房间未开播");
  }
  const results = await Promise.all(
    ctx.multirates.map(async (item) => ({ item, resp: await fetchTierResponse(ctx, item) })),
  );
  const streams: DouyuTier[] = [];
  const seenPaths = new Set<string>();
  for (const { item, resp } of results) {
    const tier = tierFromResponse(item, resp, ctx.line_label, seenPaths);
    if (tier) {
      streams.push(tier);
    }
  }
  if (!streams.length) {
    throw new Error("未获取到可播放的 douyucdn 地址");
  }
  return streams;
}

export { normalizeUrl };
