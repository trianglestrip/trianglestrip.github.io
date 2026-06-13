export interface QualityItem {
  name?: string;
  rate?: number;
}

export function pickQualityName(items: QualityItem[], qualityName?: string | null): QualityItem {
  if (qualityName) {
    for (const item of items) {
      const name = String(item.name || "");
      if (qualityName === name || qualityName.includes(name) || name.includes(qualityName)) {
        return item;
      }
    }
  }
  for (const item of items) {
    const name = String(item.name || "");
    if (["高清", "超清", "蓝光"].some((tag) => name.includes(tag))) {
      return item;
    }
  }
  return items[0];
}

export interface TierLike {
  name: string;
  lines: Array<{ name: string; url: string }>;
  play_url?: string;
}

export interface MetaLike {
  site: string;
  room_id: string;
  source_url: string;
  anchor_name?: string;
  title?: string;
  cover?: string;
  available_qualities?: QualityItem[];
  m3u8_url?: string;
  offline?: boolean;
}

export function buildOfflineRoomPayload(meta: MetaLike, opts?: { source?: string }): Record<string, unknown> {
  return {
    source_url: meta.source_url,
    source: opts?.source || "streamget",
    fetched_at: fetchedAtIso(),
    platform: meta.site,
    site: meta.site,
    room_id: meta.room_id,
    anchor_name: meta.anchor_name || "",
    title: meta.title || meta.anchor_name || "",
    cover: meta.cover || "",
    is_live: false,
    status: false,
    offline: true,
    streams: [],
    available_qualities: [],
    play_url: "",
    flv_url: "",
    m3u8_url: meta.m3u8_url || "",
    backup_urls: [],
    meta: {
      site: meta.site,
      room_id: meta.room_id,
      title: meta.title || "",
      anchor_name: meta.anchor_name || "",
      cover: meta.cover || "",
      is_live: false,
      available_qualities: [],
    },
    ok: true,
  };
}

function isOfflineMeta(meta: MetaLike): boolean {
  return Boolean(meta.offline) || !meta.available_qualities?.length;
}

export { isOfflineMeta };

function fetchedAtIso(): string {
  const d = new Date();
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const tz = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:${s}${tz}`;
}

export function buildRoomPayload(
  meta: MetaLike,
  tiers: TierLike[],
  opts?: { partial?: boolean; activeQuality?: string; source?: string },
): Record<string, unknown> {
  if (!tiers.length) {
    throw new Error("未获取到可播放地址");
  }

  let active = tiers[0];
  if (opts?.activeQuality) {
    const matched = tiers.find((tier) => tier.name === opts.activeQuality);
    if (matched) {
      active = matched;
    }
  }

  const playUrl = active.play_url || active.lines[0]?.url || "";
  const backupUrls = tiers
    .flatMap((tier) => tier.lines || [])
    .map((line) => line.url)
    .filter((url) => url && url !== playUrl);

  const payload: Record<string, unknown> = {
    source_url: meta.source_url,
    source: opts?.source || "streamget",
    fetched_at: fetchedAtIso(),
    platform: meta.site,
    site: meta.site,
    room_id: meta.room_id,
    anchor_name: meta.anchor_name || "",
    title: meta.title || meta.anchor_name || "",
    cover: meta.cover || "",
    is_live: true,
    status: true,
    streams: tiers.map((tier) => ({ name: tier.name, lines: tier.lines })),
    available_qualities: meta.available_qualities || [],
    play_url: playUrl,
    flv_url: playUrl,
    m3u8_url: meta.m3u8_url || "",
    backup_urls: backupUrls,
    meta: {
      site: meta.site,
      room_id: meta.room_id,
      title: meta.title || "",
      anchor_name: meta.anchor_name || "",
      cover: meta.cover || "",
      is_live: true,
      available_qualities: meta.available_qualities || [],
    },
    ok: true,
  };

  if (opts?.partial) {
    payload.partial = true;
    payload.quality = active.name;
  }

  return payload;
}
