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

export function sortFollowRooms(rooms, statusMap = {}) {
  const order = FOLLOW_STATE_ORDER;
  return [...rooms].sort((a, b) => {
    const aState = statusMap[`${a.site}:${a.id}`]?.state || "offline";
    const bState = statusMap[`${b.site}:${b.id}`]?.state || "offline";
    const byState = (order[aState] ?? 9) - (order[bState] ?? 9);
    if (byState !== 0) return byState;
    return (Number(b.addedAt) || 0) - (Number(a.addedAt) || 0);
  });
}

export function mergeFollowRoom(room, snapshot = {}) {
  return {
    ...room,
    title: snapshot.title || room.title,
    anchor: snapshot.anchor || room.anchor,
    cover: snapshot.cover || room.cover,
    avatar: snapshot.avatar || room.avatar,
    state: snapshot.state || room.state || "offline",
  };
}
