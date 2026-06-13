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

function normalizeCategory(category) {
  return String(category || "").trim();
}

export function sortFollowRooms(rooms, statusMap = {}, options = {}) {
  const order = FOLLOW_STATE_ORDER;
  const focusCategory = normalizeCategory(options.focusCategory);

  return [...rooms].sort((a, b) => {
    const aState = statusMap[`${a.site}:${a.id}`]?.state || a.state || "offline";
    const bState = statusMap[`${b.site}:${b.id}`]?.state || b.state || "offline";
    const byState = (order[aState] ?? 9) - (order[bState] ?? 9);
    if (byState !== 0) return byState;

    const bySuper = Number(Boolean(b.super)) - Number(Boolean(a.super));
    if (bySuper !== 0) return bySuper;

    if (focusCategory) {
      const aFocus = normalizeCategory(a.category) === focusCategory;
      const bFocus = normalizeCategory(b.category) === focusCategory;
      const byFocus = Number(bFocus) - Number(aFocus);
      if (byFocus !== 0) return byFocus;
    }

    return (Number(b.addedAt) || 0) - (Number(a.addedAt) || 0);
  });
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
