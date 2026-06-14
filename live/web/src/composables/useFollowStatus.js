import { computed, isRef, onBeforeUnmount, ref, unref, watch } from "vue";
import { fetchFollowStatus } from "../api/follow.js";
import { followKey } from "../utils/prefStore.js";
import { mergeFollowRoom, sortFollowRooms, formatDouyinOnline } from "../utils/followDisplay.js";

export function useFollowStatus(followsRef, {
  active = true,
  getFocusCategory,
  pollInterval = 0,
  minRefreshMs = 0,
  shallowWatch = false,
  refreshDebounceMs = 120,
} = {}) {
  const statusMap = ref({});
  const loading = ref(false);
  const activeRef = isRef(active) ? active : ref(active);
  let refreshTimer = 0;
  let pollTimer = 0;
  let lastRefreshAt = 0;

  function applySnapshots(list = []) {
    const next = { ...statusMap.value };
    for (const item of list) {
      const key = followKey(item.site, item.id);
      if (!key.endsWith(":")) next[key] = item;
    }
    statusMap.value = next;
  }

  function persistSnapshots(list = []) {
    const rooms = followsRef.value;
    if (!rooms?.length) return;
    const byKey = new Map(list.map((item) => [followKey(item.site, item.id), item]));
    for (const room of rooms) {
      const snap = byKey.get(followKey(room.site, room.id));
      if (!snap) continue;
      if (snap.avatar) room.avatar = snap.avatar;
      if (snap.cover) room.cover = snap.cover;
      if (snap.title) room.title = snap.title;
      if (snap.anchor) room.anchor = snap.anchor;
      if (snap.category) room.category = snap.category;
      if (snap.state) room.state = snap.state;
      if (snap.fans) room.fans = snap.fans;
      if (snap.online) {
        room.online = snap.site === "douyin" ? formatDouyinOnline(snap.online) : snap.online;
      }
      if (snap.diamondFans) room.diamondFans = snap.diamondFans;
      if (snap.fanGroup) room.fanGroup = snap.fanGroup;
      if (snap.guard) room.guard = snap.guard;
      if (snap.vip) room.vip = snap.vip;
      if (snap.guardNormal != null) room.guardNormal = snap.guardNormal;
      if (snap.guardSuper != null) room.guardSuper = snap.guardSuper;
      if (snap.lastLiveAt) room.lastLiveAt = snap.lastLiveAt;
      if (snap.liveStartAt) room.liveStartAt = snap.liveStartAt;
    }
  }

  async function refresh({ force = false } = {}) {
    const rooms = followsRef.value || [];
    if (!rooms.length) {
      statusMap.value = {};
      return;
    }
    if (!force && minRefreshMs > 0 && Date.now() - lastRefreshAt < minRefreshMs) return;
    loading.value = true;
    try {
      const data = await fetchFollowStatus(
        rooms.map((room) => ({ site: room.site, id: room.id })),
      );
      applySnapshots(data.list || []);
      persistSnapshots(data.list || []);
      lastRefreshAt = Date.now();
    } catch {
      /* 保留上次状态 */
    } finally {
      loading.value = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (unref(activeRef)) refresh();
    }, refreshDebounceMs);
  }

  function followWatchSignature() {
    return (followsRef.value || [])
      .map((room) => `${followKey(room.site, room.id)}:${room.super ? 1 : 0}`)
      .join("|");
  }

  const sortedFollows = computed(() => {
    const merged = (followsRef.value || []).map((room) => {
      const snap = statusMap.value[followKey(room.site, room.id)] || {};
      return mergeFollowRoom(room, snap);
    });
    const statusEntries = Object.fromEntries(
      merged.map((room) => [followKey(room.site, room.id), room]),
    );
    const focusCategory = typeof getFocusCategory === "function"
      ? getFocusCategory(merged, statusMap.value)
      : "";
    return sortFollowRooms(merged, statusEntries, { focusCategory });
  });

  if (shallowWatch) {
    watch(followWatchSignature, () => {
      scheduleRefresh();
    }, { immediate: true });
  } else {
    watch(
      followsRef,
      () => {
        scheduleRefresh();
      },
      { deep: true, immediate: true },
    );
  }

  onBeforeUnmount(() => {
    clearTimeout(refreshTimer);
    if (pollTimer) clearInterval(pollTimer);
  });

  if (pollInterval > 0) {
    pollTimer = setInterval(() => {
      if (unref(activeRef)) refresh();
    }, pollInterval);
  }

  return { sortedFollows, statusMap, loading, refresh };
}
