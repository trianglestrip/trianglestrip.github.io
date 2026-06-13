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

export function parseOnlineCount(text) {
  const s = String(text || "").trim();
  if (!s) return 0;
  if (s.endsWith("万")) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? Math.round(n * 10_000) : 0;
  }
  if (s.endsWith("千")) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? Math.round(n * 1_000) : 0;
  }
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 排序档位：超关开播 → 普通开播 → 重播 → 离线 */
export function followSortTier(room = {}) {
  const state = room.state || "offline";
  if (state === "live") return room.super ? 0 : 1;
  if (state === "replay") return 2;
  return 3;
}

/** 重播/离线按「上次直播」先后；重播优先用本场开播时间 */
export function recentLiveTimestamp(room = {}) {
  const last = Number(room.lastLiveAt) || 0;
  const start = Number(room.liveStartAt) || 0;
  if (room.state === "replay") return start || last;
  return last;
}

export function sortFollowRooms(rooms, statusMap = {}, options = {}) {
  void options;
  const indexed = rooms.map((room, index) => ({ room, index }));

  return indexed
    .sort((a, b) => {
      const aRoom = statusMap[`${a.room.site}:${a.room.id}`] || a.room;
      const bRoom = statusMap[`${b.room.site}:${b.room.id}`] || b.room;

      const tierA = followSortTier(aRoom);
      const tierB = followSortTier(bRoom);
      if (tierA !== tierB) return tierA - tierB;

      if (tierA === 0 || tierA === 1) {
        const byOnline = parseOnlineCount(bRoom.online) - parseOnlineCount(aRoom.online);
        if (byOnline !== 0) return byOnline;
      }

      if (tierA === 2 || tierA === 3) {
        const byRecent = recentLiveTimestamp(bRoom) - recentLiveTimestamp(aRoom);
        if (byRecent !== 0) return byRecent;
      }

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
