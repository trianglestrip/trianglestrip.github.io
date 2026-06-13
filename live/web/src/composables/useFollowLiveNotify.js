import { onBeforeUnmount, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { fetchFollowStatus } from "../api/follow.js";
import { getPlatform } from "../config/platforms.js";
import { followKey } from "../utils/prefStore.js";
import { useFollow } from "./useFollow.js";
import { useToast } from "./useToast.js";

const POLL_MS = 90000;

function roomLabel(snap, room) {
  return String(snap.anchor || room?.anchor || snap.title || room?.title || room?.id || snap.id || "").trim();
}

export function useFollowLiveNotify() {
  const { follows } = useFollow();
  const { notify } = useToast();
  const router = useRouter();

  const prevState = {};
  let baselineReady = false;
  let pollTimer = 0;
  let debounceTimer = 0;

  function emitChange(snap, room, prev, next) {
    const label = roomLabel(snap, room);
    const platform = getPlatform(snap.site)?.label || snap.site;
    const payload = {
      site: snap.site,
      roomId: String(snap.id || room?.id || ""),
      platform,
      message: label,
    };

    if (prev === "offline" && next === "live") {
      notify({
        kind: "live",
        title: "开播提醒",
        ...payload,
        text: `${label} 开播了`,
      });
      return;
    }

    if (prev === "live" && next === "offline") {
      notify({
        kind: "offline",
        title: "下播提醒",
        ...payload,
        text: `${label} 下播了`,
      });
    }
  }

  function applySnapshots(list = [], rooms = []) {
    const roomByKey = new Map((rooms || []).map((room) => [followKey(room.site, room.id), room]));

    for (const snap of list) {
      const key = followKey(snap.site, snap.id);
      const next = snap.state || "offline";
      const prev = prevState[key];
      if (baselineReady && prev !== undefined && prev !== next) {
        emitChange(snap, roomByKey.get(key), prev, next);
      }
      prevState[key] = next;
    }

    baselineReady = true;
  }

  async function poll() {
    const rooms = follows.value || [];
    if (!rooms.length) {
      for (const key of Object.keys(prevState)) delete prevState[key];
      baselineReady = false;
      return;
    }

    const activeKeys = new Set(rooms.map((room) => followKey(room.site, room.id)));
    for (const key of Object.keys(prevState)) {
      if (!activeKeys.has(key)) delete prevState[key];
    }

    try {
      const data = await fetchFollowStatus(
        rooms.map((room) => ({ site: room.site, id: room.id })),
      );
      applySnapshots(data.list || [], rooms);
    } catch {
      /* 保留上次状态 */
    }
  }

  function schedulePoll() {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      poll();
    }, 200);
  }

  function onToastClick(toast) {
    if (!toast?.site || !toast?.roomId) return;
    router.push({ name: "play", params: { site: toast.site, id: toast.roomId } });
  }

  onMounted(() => {
    poll();
    pollTimer = window.setInterval(poll, POLL_MS);
  });

  watch(follows, schedulePoll, { deep: true });

  onBeforeUnmount(() => {
    clearInterval(pollTimer);
    clearTimeout(debounceTimer);
  });

  return { onToastClick };
}
