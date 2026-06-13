import { computed, onBeforeUnmount, ref, watch } from "vue";
import { fetchFollowStatus } from "../api/follow.js";
import { followKey } from "../utils/prefStore.js";
import { mergeFollowRoom, sortFollowRooms } from "../utils/followDisplay.js";

export function useFollowStatus(followsRef, { active = true } = {}) {
  const statusMap = ref({});
  const loading = ref(false);
  let refreshTimer = 0;

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
    }
  }

  async function refresh() {
    const rooms = followsRef.value || [];
    if (!rooms.length) {
      statusMap.value = {};
      return;
    }
    loading.value = true;
    try {
      const data = await fetchFollowStatus(
        rooms.map((room) => ({ site: room.site, id: room.id })),
      );
      applySnapshots(data.list || []);
      persistSnapshots(data.list || []);
    } catch {
      /* 保留上次状态 */
    } finally {
      loading.value = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (active) refresh();
    }, 120);
  }

  const sortedFollows = computed(() => {
    const merged = (followsRef.value || []).map((room) => {
      const snap = statusMap.value[followKey(room.site, room.id)] || {};
      return mergeFollowRoom(room, snap);
    });
    return sortFollowRooms(merged, Object.fromEntries(
      merged.map((room) => [followKey(room.site, room.id), room]),
    ));
  });

  watch(
    followsRef,
    () => {
      scheduleRefresh();
    },
    { deep: true, immediate: true },
  );

  onBeforeUnmount(() => {
    clearTimeout(refreshTimer);
  });

  return { sortedFollows, statusMap, loading, refresh };
}
