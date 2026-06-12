import { ref, watch } from "vue";

const FOLLOW_KEY = "lemon_follow_list";

export function useFollow() {
  const follows = ref([]);

  try {
    follows.value = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
  } catch {
    follows.value = [];
  }

  watch(
    follows,
    (val) => {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(val));
    },
    { deep: true },
  );

  function isFollowed(site, id) {
    return follows.value.some((r) => r.site === site && String(r.id) === String(id));
  }

  function toggleFollow(roomInfo) {
    const idx = follows.value.findIndex(
      (r) => r.site === roomInfo.site && String(r.id) === String(roomInfo.id),
    );
    if (idx >= 0) {
      follows.value.splice(idx, 1);
    } else {
      follows.value.push({ ...roomInfo, addedAt: Date.now() });
    }
  }

  function unfollow(site, id) {
    const idx = follows.value.findIndex((r) => r.site === site && String(r.id) === String(id));
    if (idx >= 0) follows.value.splice(idx, 1);
  }

  return { follows, isFollowed, toggleFollow, unfollow };
}
