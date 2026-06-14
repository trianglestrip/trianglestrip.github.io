import type { CategoryGroup, RoomsPayload } from "../browse/douyu.js";
import type { MetaLike, TierLike } from "../resolve/schema.js";

export interface ResolveAdapter {
  loadMeta: (url: string) => Promise<MetaLike>;
  resolveTier: (meta: MetaLike, quality?: string) => Promise<TierLike>;
  resolveAllTiers: (meta: MetaLike) => Promise<TierLike[]>;
  normalizeUrl: (roomId: string) => string;
}

export interface BrowseAdapter {
  fetchCategories: () => Promise<CategoryGroup[]>;
  fetchRecommendRooms: (page: number) => Promise<RoomsPayload>;
  fetchCategoryRooms: (cid: string, page: number, pid?: string) => Promise<RoomsPayload>;
  /** 大类聚合房间（如斗鱼 cate1、虎牙 gid） */
  fetchGroupRooms?: (groupId: string, page: number, limit: number) => Promise<RoomsPayload>;
}

export interface DanmakuAdapter {
  fetchSession: (roomId: string) => Promise<Record<string, unknown>>;
}

export interface PlatformDef {
  id: string;
  resolve: ResolveAdapter;
  browse?: BrowseAdapter;
  danmaku?: DanmakuAdapter;
  crossWeight?: number;
  roomIdPattern?: RegExp;
}
