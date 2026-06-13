import { ref, watch } from "vue";
import {
  applyPendingFollowImport,
  followKey,
  loadFollows,
  mergeFollows,
  normalizeFollows,
  saveFollows,
} from "../utils/prefStore.js";

const follows = ref(loadFollows());

watch(
  follows,
  (val) => {
    saveFollows(val, { touchUpdatedAt: true });
  },
  { deep: true },
);

export function useFollow() {
  function isFollowed(site, id) {
    const key = followKey(site, id);
    return follows.value.some((r) => followKey(r.site, r.id) === key);
  }

  function isSuperFollowed(site, id) {
    const key = followKey(site, id);
    const room = follows.value.find((r) => followKey(r.site, r.id) === key);
    return Boolean(room?.super);
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

  function toggleSuperFollow(roomInfo) {
    const site = String(roomInfo.site || "").trim();
    const id = String(roomInfo.id || "").trim();
    if (!site || !id) return;

    const key = followKey(site, id);
    const idx = follows.value.findIndex((r) => followKey(r.site, r.id) === key);
    if (idx >= 0) {
      follows.value[idx].super = !follows.value[idx].super;
      return;
    }
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
          super: true,
        },
      ])[0],
    );
  }

  function unfollow(site, id) {
    const key = followKey(site, id);
    const idx = follows.value.findIndex((r) => followKey(r.site, r.id) === key);
    if (idx >= 0) follows.value.splice(idx, 1);
  }

  function unfollowMany(rooms) {
    const keys = new Set(
      (rooms || []).map((r) => followKey(String(r.site || "").trim(), String(r.id || "").trim())),
    );
    if (!keys.size) return 0;
    const before = follows.value.length;
    follows.value = follows.value.filter((r) => !keys.has(followKey(r.site, r.id)));
    return before - follows.value.length;
  }

  function importFollows(items) {
    const incoming = normalizeFollows(items);
    const beforeKeys = new Set(follows.value.map((r) => followKey(r.site, r.id)));
    const merged = mergeFollows(follows.value, incoming);
    const added = merged.filter((r) => !beforeKeys.has(followKey(r.site, r.id))).length;
    follows.value = merged;
    return added;
  }

  function syncFromPending() {
    const added = applyPendingFollowImport();
    if (added > 0) follows.value = loadFollows();
    return added;
  }

  return {
    follows,
    isFollowed,
    isSuperFollowed,
    toggleFollow,
    toggleSuperFollow,
    unfollow,
    unfollowMany,
    importFollows,
    syncFromPending,
  };
}
