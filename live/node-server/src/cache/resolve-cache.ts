export const PAYLOAD_TTL = 60;
export const TIER_TTL = 60;
export const META_TTL = 180;
export const DEFAULT_TTL = PAYLOAD_TTL;
export const MAX_ENTRIES = 100;

interface CacheEntry {
  data: unknown;
  expires: number;
}

function now(): number {
  return performance.now() / 1000;
}

function metaKey(site: string, roomId: string): string {
  return `meta:${site}:${roomId}`;
}

function tierKey(site: string, roomId: string, qualityName: string): string {
  return `tier:${site}:${roomId}:${qualityName}`;
}

function payloadKey(site: string, roomId: string, mode: string, qualityKey: string): string {
  return `payload:${site}:${roomId}:${mode}:${qualityKey}`;
}

export class ResolveCache {
  private entries = new Map<string, CacheEntry>();
  private order: string[] = [];

  private purgeExpired(): void {
    const t = now();
    for (const key of [...this.order]) {
      const entry = this.entries.get(key);
      if (!entry || t >= entry.expires) {
        this.entries.delete(key);
        this.order = this.order.filter((k) => k !== key);
      }
    }
  }

  private evictIfNeeded(): void {
    while (this.order.length > MAX_ENTRIES) {
      const oldest = this.order.shift();
      if (oldest) {
        this.entries.delete(oldest);
      }
    }
  }

  get(key: string): unknown | null {
    this.purgeExpired();
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (now() >= entry.expires) {
      this.entries.delete(key);
      this.order = this.order.filter((k) => k !== key);
      return null;
    }
    this.order = this.order.filter((k) => k !== key);
    this.order.push(key);
    return structuredClone(entry.data);
  }

  set(key: string, data: unknown, opts?: { ttl?: number }): void {
    const ttl = opts?.ttl ?? DEFAULT_TTL;
    this.purgeExpired();
    this.entries.delete(key);
    this.order = this.order.filter((k) => k !== key);
    this.entries.set(key, { data: structuredClone(data), expires: now() + ttl });
    this.order.push(key);
    this.evictIfNeeded();
  }

  stats(): {
    entries: number;
    max_entries: number;
    ttl_sec: { meta: number; tier: number; payload: number };
  } {
    this.purgeExpired();
    return {
      entries: this.entries.size,
      max_entries: MAX_ENTRIES,
      ttl_sec: {
        meta: META_TTL,
        tier: TIER_TTL,
        payload: PAYLOAD_TTL,
      },
    };
  }

  getMeta(site: string, roomId: string): Record<string, unknown> | null {
    const data = this.get(metaKey(site, roomId));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  }

  setMeta(site: string, roomId: string, meta: Record<string, unknown>): void {
    this.set(metaKey(site, roomId), meta, { ttl: META_TTL });
  }

  getTier(site: string, roomId: string, qualityName: string): Record<string, unknown> | null {
    const data = this.get(tierKey(site, roomId, qualityName));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  }

  setTier(
    site: string,
    roomId: string,
    qualityName: string,
    tier: Record<string, unknown>,
    opts?: { ttl?: number },
  ): void {
    this.set(tierKey(site, roomId, qualityName), tier, { ttl: opts?.ttl ?? TIER_TTL });
  }

  getPayload(
    site: string,
    roomId: string,
    mode: string,
    qualityKey: string,
  ): Record<string, unknown> | null {
    const data = this.get(payloadKey(site, roomId, mode, qualityKey));
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  }

  setPayload(
    site: string,
    roomId: string,
    mode: string,
    qualityKey: string,
    payload: Record<string, unknown>,
  ): void {
    this.set(payloadKey(site, roomId, mode, qualityKey), payload, { ttl: PAYLOAD_TTL });
  }
}
