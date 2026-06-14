import { fetchDouyuCategories, fetchDouyuGroupRooms, fetchDouyuRooms } from "../browse/douyu.js";
import {
  fetchDouyinGameCategories,
  fetchDouyinGameRooms,
  fetchDouyinRecommendRooms,
} from "../browse/douyin.js";
import { fetchHuyaCategories, fetchHuyaLiveList } from "../browse/huya.js";
import { fetchDouyinDanmakuSession } from "../danmaku/douyin.js";
import { fetchHuyaDanmakuSession } from "../danmaku/huya.js";
import * as douyinResolve from "../resolve/douyin/index.js";
import * as douyuResolve from "../resolve/douyu/index.js";
import * as huyaResolve from "../resolve/huya/index.js";
import type { MetaLike, TierLike } from "../resolve/schema.js";
import type { BrowseAdapter, DanmakuAdapter, PlatformDef, ResolveAdapter } from "./types.js";

function asResolveAdapter(mod: {
  loadMeta: (url: string) => Promise<unknown>;
  resolveTier: (meta: never, quality?: string) => Promise<unknown>;
  resolveAllTiers: (meta: never) => Promise<unknown[]>;
  normalizeUrl: (roomId: string) => string;
}): ResolveAdapter {
  return {
    loadMeta: (url) => mod.loadMeta(url) as Promise<MetaLike>,
    resolveTier: (meta, quality) => mod.resolveTier(meta as never, quality) as Promise<TierLike>,
    resolveAllTiers: (meta) => mod.resolveAllTiers(meta as never) as Promise<TierLike[]>,
    normalizeUrl: mod.normalizeUrl,
  };
}

const douyuBrowse: BrowseAdapter = {
  fetchCategories: fetchDouyuCategories,
  fetchRecommendRooms: (page) => fetchDouyuRooms(null, page),
  fetchCategoryRooms: (cid, page) => fetchDouyuRooms(cid, page),
  fetchGroupRooms: (groupId, page, limit) => fetchDouyuGroupRooms(groupId, page, limit),
};

const huyaBrowse: BrowseAdapter = {
  fetchCategories: fetchHuyaCategories,
  fetchRecommendRooms: (page) => fetchHuyaLiveList(0, page),
  fetchCategoryRooms: (cid, page) => fetchHuyaLiveList(cid, page),
  fetchGroupRooms: (groupId, page, limit) => fetchHuyaLiveList(groupId, page, limit),
};

const douyinBrowse: BrowseAdapter = {
  fetchCategories: fetchDouyinGameCategories,
  fetchRecommendRooms: fetchDouyinRecommendRooms,
  fetchCategoryRooms: async (cid, page, pid) => {
    const groups = await fetchDouyinGameCategories();
    let partitionName = "";
    for (const group of groups) {
      const hit = group.list.find((item) => String(item.cid) === String(cid));
      if (hit) {
        partitionName = hit.name;
        break;
      }
    }
    return fetchDouyinGameRooms(cid, page, pid || "1", partitionName);
  },
};

const huyaDanmaku: DanmakuAdapter = {
  fetchSession: async (roomId) => fetchHuyaDanmakuSession(roomId) as unknown as Record<string, unknown>,
};

const douyinDanmaku: DanmakuAdapter = {
  fetchSession: async (roomId) => fetchDouyinDanmakuSession(roomId) as unknown as Record<string, unknown>,
};

export const PLATFORMS: Record<string, PlatformDef> = {
  douyu: {
    id: "douyu",
    resolve: asResolveAdapter(douyuResolve as never),
    browse: douyuBrowse,
    crossWeight: 2,
    roomIdPattern: /(?:douyu\.com\/)?(\d+)$/,
  },
  huya: {
    id: "huya",
    resolve: asResolveAdapter(huyaResolve as never),
    browse: huyaBrowse,
    danmaku: huyaDanmaku,
    crossWeight: 2,
    roomIdPattern: /(?:huya\.com\/)?(\d+)$/,
  },
  douyin: {
    id: "douyin",
    resolve: asResolveAdapter(douyinResolve as never),
    browse: douyinBrowse,
    danmaku: douyinDanmaku,
    crossWeight: 1,
    roomIdPattern: /(?:(?:live\.)?douyin\.com\/)?(\d+)$/,
  },
};

export function getPlatform(id: string): PlatformDef | undefined {
  return PLATFORMS[id];
}

export const BROWSE_SITE_IDS = (Object.values(PLATFORMS) as PlatformDef[])
  .filter((p) => p.browse)
  .map((p) => p.id);

export const CROSS_SITE_WEIGHTS: Record<string, number> = Object.fromEntries(
  BROWSE_SITE_IDS.map((id) => [id, PLATFORMS[id]?.crossWeight ?? 1]),
);

export const ROOM_ID_PATTERNS: Record<string, RegExp> = Object.fromEntries(
  Object.values(PLATFORMS)
    .filter((p) => p.roomIdPattern)
    .map((p) => [p.id, p.roomIdPattern!]),
);
