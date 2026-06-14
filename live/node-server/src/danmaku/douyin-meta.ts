export interface DouyinRoomMeta {
  liveStartAt: number;
  fanGroup: string;
  updatedAt: number;
}

const cache = new Map<string, DouyinRoomMeta>();

export function getDouyinRoomMeta(webRid: string): DouyinRoomMeta | null {
  const rid = String(webRid || "").trim();
  if (!rid) return null;
  return cache.get(rid) || null;
}

export function patchDouyinRoomMeta(
  webRid: string,
  patch: Partial<Pick<DouyinRoomMeta, "liveStartAt" | "fanGroup">>,
): DouyinRoomMeta {
  const rid = String(webRid || "").trim();
  const prev = cache.get(rid) || { liveStartAt: 0, fanGroup: "", updatedAt: 0 };
  const next: DouyinRoomMeta = {
    liveStartAt: patch.liveStartAt || prev.liveStartAt || 0,
    fanGroup: patch.fanGroup || prev.fanGroup || "",
    updatedAt: Date.now(),
  };
  cache.set(rid, next);
  return next;
}
