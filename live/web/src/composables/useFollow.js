import { ref, watch } from "vue";
import { followKey, loadFollows, normalizeFollows, saveFollows } from "../utils/prefStore.js";

export function useFollow() {
  const follows = ref(loadFollows());

  watch(
    follows,
    (val) => {
      saveFollows(val);
    },
    { deep: true },
  );

  function isFollowed(site, id) {
    const key = followKey(site, id);
    return follows.value.some((r) => followKey(r.site, r.id) === key);
  }

  function toggleFollow(roomInfo) {
    const site = String(roomInfo.site || "").trim();
    const id = String(roomInfo.id || "").trim();
    if (!site || !id) return;

    const key = followKey(site, id);
    const idx = follows.value.findIndex((r) => followKey(r.site, r.id) === key);
    if (idx >= 0) {
      follows.value.splice(idx, 1);
    } else {
      follows.value.push(
        normalizeFollows([
          {
            site,
            id,
            title: roomInfo.title,
            anchor: roomInfo.anchor,
            cover: roomInfo.cover,
            avatar: roomInfo.avatar,
            addedAt: Date.now(),
          },
        ])[0],
      );
    }
  }

  function unfollow(site, id) {
    const key = followKey(site, id);
    const idx = follows.value.findIndex((r) => followKey(r.site, r.id) === key);
    if (idx >= 0) follows.value.splice(idx, 1);
  }

  return { follows, isFollowed, toggleFollow, unfollow };
}
