import type { ResolveCache } from "../cache/resolve-cache.js";
import * as douyuAdapter from "./douyu/index.js";
import * as douyinAdapter from "./douyin/index.js";
import * as huyaAdapter from "./huya/index.js";
import { buildRoomPayload, buildOfflineRoomPayload, isOfflineMeta, pickQualityName, type MetaLike, type TierLike } from "./schema.js";

const SITE_LOAD_META: Record<string, (url: string) => Promise<MetaLike>> = {
  douyu: (url) => douyuAdapter.loadMeta(url) as Promise<MetaLike>,
  douyin: (url) => douyinAdapter.loadMeta(url) as Promise<MetaLike>,
  huya: (url) => huyaAdapter.loadMeta(url) as Promise<MetaLike>,
};

const SITE_RESOLVE_TIER: Record<string, (meta: MetaLike, quality?: string) => Promise<TierLike>> = {
  douyu: (meta, quality) => douyuAdapter.resolveTier(meta as never, quality) as Promise<TierLike>,
  douyin: (meta, quality) => douyinAdapter.resolveTier(meta as never, quality) as Promise<TierLike>,
  huya: (meta, quality) => huyaAdapter.resolveTier(meta as never, quality) as Promise<TierLike>,
};

const SITE_RESOLVE_ALL_TIERS: Record<string, (meta: MetaLike) => Promise<TierLike[]>> = {
  douyu: (meta) => douyuAdapter.resolveAllTiers(meta as never) as Promise<TierLike[]>,
  douyin: (meta) => douyinAdapter.resolveAllTiers(meta as never) as Promise<TierLike[]>,
  huya: (meta) => huyaAdapter.resolveAllTiers(meta as never) as Promise<TierLike[]>,
};

const SITE_NORMALIZE_URL: Record<string, (roomId: string) => string> = {
  douyu: douyuAdapter.normalizeUrl,
  douyin: douyinAdapter.normalizeUrl,
  huya: huyaAdapter.normalizeUrl,
};

function msSince(start: number): number {
  return Math.trunc(performance.now() - start);
}

export interface ResolveOptions {
  site: string;
  roomId: string;
  mode?: string;
  quality?: string | null;
  force?: boolean;
}

export interface ResolveService {
  resolveRoom(opts: ResolveOptions): Promise<Record<string, unknown>>;
}

export function createResolveService(cache: ResolveCache): ResolveService {
  function normalizeRoomUrl(site: string, roomId: string): string {
    const normalizer = SITE_NORMALIZE_URL[site];
    if (!normalizer) {
      throw new Error(`暂不支持平台: ${site}`);
    }
    return normalizer(roomId);
  }

  async function fetchMeta(site: string, roomId: string, force = false): Promise<MetaLike & Record<string, unknown>> {
    if (!force) {
      const cached = cache.getMeta(site, roomId);
      if (cached) {
        cached.cached_meta = true;
        return cached as MetaLike & Record<string, unknown>;
      }
    }
    const loader = SITE_LOAD_META[site];
    if (!loader) {
      throw new Error(`暂不支持平台: ${site}`);
    }
    const url = normalizeRoomUrl(site, roomId);
    const meta = await loader(url);
    cache.setMeta(site, roomId, meta as unknown as Record<string, unknown>);
    return meta as MetaLike & Record<string, unknown>;
  }

  async function fetchTier(
    site: string,
    roomId: string,
    meta: MetaLike,
    qualityName: string,
    force = false,
  ): Promise<TierLike & Record<string, unknown>> {
    if (!force) {
      const cached = cache.getTier(site, roomId, qualityName);
      if (cached) {
        cached.cached_tier = true;
        return cached as TierLike & Record<string, unknown>;
      }
    }
    const resolver = SITE_RESOLVE_TIER[site];
    if (!resolver) {
      throw new Error(`暂不支持平台: ${site}`);
    }
    const tier = await resolver(meta, qualityName);
    cache.setTier(site, roomId, qualityName, tier as unknown as Record<string, unknown>);
    return tier as TierLike & Record<string, unknown>;
  }

  return {
    async resolveRoom({ site, roomId, mode = "lazy", quality = null, force = false }) {
      const t0 = performance.now();
      const timing: Record<string, unknown> = {
        total_ms: 0,
        meta_ms: 0,
        tier_ms: 0,
        payload_cached: false,
        meta_cached: false,
        tier_cached: false,
      };

      const qualityKey = (quality || "").trim() || "*";
      if (!force) {
        const cached = cache.getPayload(site, roomId, mode, qualityKey);
        if (cached) {
          cached.cached = true;
          timing.payload_cached = true;
          timing.total_ms = msSince(t0);
          cached._timing = timing;
          return cached;
        }
      }

      const tMeta = performance.now();
      const meta = await fetchMeta(site, roomId, force);
      timing.meta_ms = msSince(tMeta);
      timing.meta_cached = Boolean(meta.cached_meta);

      let payload: Record<string, unknown>;
      if (isOfflineMeta(meta)) {
        payload = buildOfflineRoomPayload(meta, { source: "streamget" });
      } else if (mode === "full") {
        const tTier = performance.now();
        const resolver = SITE_RESOLVE_ALL_TIERS[site];
        if (!resolver) {
          throw new Error(`暂不支持平台: ${site}`);
        }
        const tiers = await resolver(meta);
        timing.tier_ms = msSince(tTier);
        payload = buildRoomPayload(meta, tiers, { source: "streamget" });
      } else {
        const qualityItem = pickQualityName(meta.available_qualities || [], quality);
        const tierName = String(qualityItem.name || quality || "默认");
        const tTier = performance.now();
        const tier = await fetchTier(site, roomId, meta, tierName, force);
        timing.tier_ms = msSince(tTier);
        timing.tier_cached = Boolean(tier.cached_tier);
        payload = buildRoomPayload(meta, [tier], {
          partial: true,
          activeQuality: tierName,
          source: "streamget",
        });
      }

      payload.source = "streamget";
      cache.setPayload(site, roomId, mode, qualityKey, payload);
      timing.total_ms = msSince(t0);
      payload._timing = timing;
      return payload;
    },
  };
}
