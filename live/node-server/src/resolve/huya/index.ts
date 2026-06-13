import { pickQualityName } from "../schema.js";
import type { HuyaRoomState } from "../../follow/huya-state.js";
import {
  fetchAppStreamData,
  fetchHuyaProfileBrief,
  fetchWebStreamData,
  qualityItems,
  streamLines,
  type HuyaWebData,
} from "./web-stream.js";
import { normalizeUrl } from "./normalize.js";

export interface HuyaTier {
  name: string;
  lines: Array<{ name: string; url: string }>;
  play_url: string;
}

export interface HuyaMeta {
  site: string;
  room_id: string;
  source_url: string;
  anchor_name: string;
  title: string;
  cover: string;
  avatar: string;
  available_qualities: Array<{ name: string; rate: number }>;
  offline?: boolean;
  room_state?: HuyaRoomState;
  context?: {
    web_data: HuyaWebData;
    app_fallback_tier?: HuyaTier;
  };
}

async function loadPlayContext(url: string) {
  const roomId = url.replace(/\/$/, "").split("/").pop() || "";
  const [webData, profileBrief] = await Promise.all([
    fetchWebStreamData(url),
    fetchHuyaProfileBrief(roomId),
  ]);
  const gameInfo = webData.data?.[0]?.gameLiveInfo || {};
  const streamList = webData.data?.[0]?.gameStreamInfoList || [];
  const avatar = profileBrief.avatar;
  const roomState = profileBrief.roomState;

  if (!streamList.length) {
    let appData: Awaited<ReturnType<typeof fetchAppStreamData>> = {};
    try {
      appData = await fetchAppStreamData(url);
    } catch {
      appData = {};
    }
    if (appData.is_live === false) {
      return {
        url,
        room_id: roomId,
        anchor_name: appData.anchor_name || String(gameInfo.nick || ""),
        title: appData.title || String(gameInfo.introduction || gameInfo.roomName || ""),
        cover: String(gameInfo.screenshot || ""),
        avatar,
        room_state: roomState,
        web_data: webData,
        qualities: [],
        offline: true,
      };
    }
    if (appData.flv_url) {
      const flvUrl = appData.flv_url.replace("http://", "https://");
      const tier: HuyaTier = {
        name: "默认",
        lines: [{ name: "线路1", url: flvUrl }],
        play_url: flvUrl,
      };
      return {
        url,
        room_id: roomId,
        anchor_name: appData.anchor_name || String(gameInfo.nick || ""),
        title: appData.title || String(gameInfo.introduction || ""),
        cover: String(gameInfo.screenshot || ""),
        avatar,
        room_state: roomState,
        web_data: webData,
        qualities: [{ name: "默认", rate: 0 }],
        app_fallback_tier: tier,
      };
    }
    throw new Error("房间未开播或解析失败");
  }

  return {
    url,
    room_id: roomId,
    anchor_name: String(gameInfo.nick || ""),
    title: String(gameInfo.introduction || gameInfo.roomName || ""),
    cover: String(gameInfo.screenshot || ""),
    avatar,
    room_state: roomState,
    web_data: webData,
    qualities: qualityItems(webData),
  };
}

function metaFromContext(ctx: Awaited<ReturnType<typeof loadPlayContext>>): HuyaMeta {
  const context: HuyaMeta["context"] = ctx.web_data ? { web_data: ctx.web_data } : undefined;
  if (ctx.app_fallback_tier && context) {
    context.app_fallback_tier = ctx.app_fallback_tier;
  }
  return {
    site: "huya",
    room_id: ctx.room_id,
    source_url: ctx.url,
    anchor_name: ctx.anchor_name,
    title: ctx.title || ctx.anchor_name,
    cover: ctx.cover,
    avatar: ctx.avatar,
    available_qualities: ctx.qualities,
    offline: Boolean(ctx.offline),
    room_state: ctx.room_state,
    context,
  };
}

function tierFromQuality(webData: HuyaWebData, quality: { name?: string; rate?: number }): HuyaTier | null {
  const lines = streamLines(webData, quality.rate ?? 0);
  if (!lines.length) {
    return null;
  }
  return {
    name: String(quality.name || "默认"),
    lines,
    play_url: lines[0].url,
  };
}

export async function loadMeta(url: string): Promise<HuyaMeta> {
  const ctx = await loadPlayContext(url);
  return metaFromContext(ctx);
}

export async function resolveTier(meta: HuyaMeta, qualityName?: string): Promise<HuyaTier> {
  const ctx = meta.context;
  if (!ctx) {
    throw new Error("房间未开播");
  }
  const fallback = ctx.app_fallback_tier;
  if (fallback) {
    return fallback;
  }
  const webData = ctx.web_data;
  const quality = pickQualityName(meta.available_qualities, qualityName);
  const tier = tierFromQuality(webData, quality);
  if (!tier) {
    throw new Error(`未获取到档位 ${quality.name || qualityName} 的播放地址`);
  }
  return tier;
}

export async function resolveAllTiers(meta: HuyaMeta): Promise<HuyaTier[]> {
  const ctx = meta.context;
  if (!ctx) {
    throw new Error("房间未开播");
  }
  const fallback = ctx.app_fallback_tier;
  if (fallback) {
    return [fallback];
  }
  const webData = ctx.web_data;
  const streams: HuyaTier[] = [];
  for (const quality of meta.available_qualities) {
    const tier = tierFromQuality(webData, quality);
    if (tier) {
      streams.push(tier);
    }
  }
  if (!streams.length) {
    throw new Error("未获取到可播放的虎牙 FLV 地址");
  }
  return streams;
}

export { normalizeUrl };
