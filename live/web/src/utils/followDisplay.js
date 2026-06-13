export const FOLLOW_STATE_ORDER = { live: 0, replay: 1, offline: 2 };

export const FOLLOW_STATE_LABEL = {
  live: "直播中",
  replay: "重播中",
  offline: "未直播",
};

export function followStateClass(state) {
  if (state === "live") return "follow-item--live";
  if (state === "replay") return "follow-item--replay";
  return "follow-item--offline";
}

export function guardSortScore(room = {}) {
  const superCount = Number(room.guardSuper) || 0;
  const normal = Number(room.guardNormal) || 0;
  const parsedGuard = Number(String(room.guard || "").replace(/[^\d]/g, "")) || 0;
  const total = parsedGuard || superCount + normal;
  // 总数优先，同总数时超关/至尊权重更高
  return total * 10_000 + superCount * 100 + normal;
}

export function sortFollowRooms(rooms, statusMap = {}, options = {}) {
  const order = FOLLOW_STATE_ORDER;
  const indexed = rooms.map((room, index) => ({ room, index }));

  return indexed
    .sort((a, b) => {
      const aState = statusMap[`${a.room.site}:${a.room.id}`]?.state || a.room.state || "offline";
      const bState = statusMap[`${b.room.site}:${b.room.id}`]?.state || b.room.state || "offline";
      const byState = (order[aState] ?? 9) - (order[bState] ?? 9);
      if (byState !== 0) return byState;

      if (aState === "live" && bState === "live") {
        const byGuard = guardSortScore(b.room) - guardSortScore(a.room);
        if (byGuard !== 0) return byGuard;
      }

      // replay / offline 组内保持原顺序
      return a.index - b.index;
    })
    .map((entry) => entry.room);
}

export function formatLastLiveAt(ts) {
  const sec = Number(ts || 0);
  if (!sec) return "";
  const date = new Date(sec * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

export function mergeFollowRoom(room, snapshot = {}) {
  return {
    ...room,
    super: Boolean(room.super),
    title: snapshot.title || room.title,
    anchor: snapshot.anchor || room.anchor,
    category: snapshot.category || room.category || "",
    cover: snapshot.cover || room.cover,
    avatar: snapshot.avatar || room.avatar,
    state: snapshot.state || room.state || "offline",
    fans: snapshot.fans || room.fans || "",
    online: snapshot.online || room.online || "",
    diamondFans: snapshot.diamondFans || room.diamondFans || "",
    fanGroup: snapshot.fanGroup || room.fanGroup || "",
    guard: snapshot.guard || room.guard || "",
    vip: snapshot.vip || room.vip || "",
    guardNormal: Number(snapshot.guardNormal ?? room.guardNormal) || 0,
    guardSuper: Number(snapshot.guardSuper ?? room.guardSuper) || 0,
    lastLiveAt: Number(snapshot.lastLiveAt ?? room.lastLiveAt) || 0,
    liveStartAt: Number(snapshot.liveStartAt ?? room.liveStartAt) || 0,
  };
}

/** 关注页封面网格（与 browse RoomGrid 字段对齐） */
export function followRoomToGrid(room) {
  const offline = room.state === "offline";
  return {
    roomId: `${room.site}:${room.id}`,
    site: room.site,
    id: room.id,
    title: room.title || `房间 ${room.id}`,
    nickname: room.anchor || room.id,
    cover: room.cover || "",
    category: room.category || "",
    online: offline ? "" : room.online || "",
    status: !offline,
    liveState: room.state || "offline",
  };
}
