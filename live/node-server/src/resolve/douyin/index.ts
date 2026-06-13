import { pickQualityName } from "../schema.js";
import { webRidFromUrl, normalizeUrl } from "./normalize.js";
import { fetchWebStreamData, type DouyinRoomData } from "./web-stream.js";

const QUALITY_LABELS: Record<string, string> = {
  ORIGIN: "原画",
  FULL_HD1: "蓝光",
  uhd: "蓝光",
  hd: "超清",
  HD1: "超清",
  sd: "高清",
  SD1: "高清",
  SD2: "流畅",
  ld: "流畅",
};

const QUALITY_ORDER = ["ORIGIN", "FULL_HD1", "uhd", "HD1", "hd", "SD1", "sd", "SD2", "ld"];

export interface DouyinTier {
  name: string;
  lines: Array<{ name: string; url: string }>;
  play_url: string;
}

export interface DouyinMeta {
  site: string;
  room_id: string;
  source_url: string;
  anchor_name: string;
  title: string;
  cover: string;
  available_qualities: Array<{ name: string; rate: number }>;
  m3u8_url?: string;
  offline?: boolean;
  context?: {
    room_data: DouyinRoomData;
  };
}

function qualityLabel(key: string): string {
  return QUALITY_LABELS[key] || key;
}

function sortedQualityKeys(flvMap: Record<string, string>): string[] {
  const keys = Object.keys(flvMap).filter((key) => flvMap[key]);
  return keys.sort((a, b) => {
    const ai = QUALITY_ORDER.indexOf(a);
    const bi = QUALITY_ORDER.indexOf(b);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

function tiersFromRoomData(roomData: DouyinRoomData): DouyinTier[] {
  const streamUrl = roomData.stream_url || {};
  const flvMap = streamUrl.flv_pull_url || {};
  const hlsMap = streamUrl.hls_pull_url_map || {};
  const tiers: DouyinTier[] = [];

  for (const key of sortedQualityKeys(flvMap)) {
    const flv = flvMap[key];
    const hls = hlsMap[key] || "";
    const url = flv || hls;
    if (!url) continue;
    tiers.push({
      name: qualityLabel(key),
      lines: [{ name: "线路1", url }],
      play_url: url,
    });
  }
  return tiers;
}

function metaFromRoomData(roomData: DouyinRoomData, webRid: string, sourceUrl: string): DouyinMeta {
  const tiers = tiersFromRoomData(roomData);
  const coverList = roomData.cover?.url_list || [];
  return {
    site: "douyin",
    room_id: webRid,
    source_url: sourceUrl,
    anchor_name: roomData.anchor_name || "",
    title: roomData.title || roomData.anchor_name || "",
    cover: coverList[0] || "",
    available_qualities: tiers.map((tier, index) => ({ name: tier.name, rate: tiers.length - index })),
    m3u8_url: tiers[0]?.lines[0]?.url.includes(".m3u8") ? tiers[0].lines[0].url : "",
    context: { room_data: roomData },
  };
}

export async function loadMeta(url: string): Promise<DouyinMeta> {
  const sourceUrl = normalizeUrl(url);
  const webRid = webRidFromUrl(sourceUrl);
  const roomData = await fetchWebStreamData(webRid);
  if (roomData.status === 4) {
    const meta = metaFromRoomData(roomData, webRid, sourceUrl);
    return {
      ...meta,
      available_qualities: [],
      offline: true,
      context: { room_data: roomData },
    };
  }
  const meta = metaFromRoomData(roomData, webRid, sourceUrl);
  if (!meta.available_qualities.length) {
    throw new Error("未获取到可播放地址");
  }
  return meta;
}

export async function resolveTier(meta: DouyinMeta, qualityName?: string): Promise<DouyinTier> {
  const roomData = meta.context?.room_data;
  if (!roomData) {
    throw new Error("房间未开播");
  }
  const tiers = tiersFromRoomData(roomData);
  if (!tiers.length) {
    throw new Error("未获取到可播放的抖音流地址");
  }
  const quality = pickQualityName(meta.available_qualities, qualityName);
  const tier = tiers.find((item) => item.name === quality.name) || tiers[0];
  return tier;
}

export async function resolveAllTiers(meta: DouyinMeta): Promise<DouyinTier[]> {
  const roomData = meta.context?.room_data;
  if (!roomData) {
    throw new Error("房间未开播");
  }
  const tiers = tiersFromRoomData(roomData);
  if (!tiers.length) {
    throw new Error("未获取到可播放的抖音流地址");
  }
  return tiers;
}

export { normalizeUrl };
