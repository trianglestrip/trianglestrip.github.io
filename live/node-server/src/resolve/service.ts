import type { ResolveCache } from "../cache/resolve-cache.js";
import { getPlatform } from "../platforms/registry.js";
import { buildRoomPayload, buildOfflineRoomPayload, isOfflineMeta, pickQualityName, type MetaLike, type TierLike } from "./schema.js";

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
    const adapter = getPlatform(site)?.resolve;
    if (!adapter) {
      throw new Error(`暂不支持平台: ${site}`);
    }
    return adapter.normalizeUrl(roomId);
  }

  async function fetchMeta(site: string, roomId: string, force = false): Promise<MetaLike & Record<string, unknown>> {
    if (!force) {
      const cached = cache.getMeta(site, roomId);
      if (cached) {
        const anchorName = String(cached.anchor_name || "").trim();
        const needsAnchorRefresh = site === "bilibili" && !anchorName && !cached.offline;
        if (!needsAnchorRefresh) {
          cached.cached_meta = true;
          return cached as MetaLike & Record<string, unknown>;
        }
      }
    }
    const adapter = getPlatform(site)?.resolve;
    if (!adapter) {
      throw new Error(`暂不支持平台: ${site}`);
    }
    const url = normalizeRoomUrl(site, roomId);
    const meta = await adapter.loadMeta(url);
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
    const adapter = getPlatform(site)?.resolve;
    if (!adapter) {
      throw new Error(`暂不支持平台: ${site}`);
    }
    const tier = await adapter.resolveTier(meta, qualityName);
    const tierTtl = site === "bilibili" ? 30 : undefined;
    cache.setTier(site, roomId, qualityName, tier as unknown as Record<string, unknown>, { ttl: tierTtl });
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
        const adapter = getPlatform(site)?.resolve;
        if (!adapter) {
          throw new Error(`暂不支持平台: ${site}`);
        }
        const tiers = await adapter.resolveAllTiers(meta);
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
