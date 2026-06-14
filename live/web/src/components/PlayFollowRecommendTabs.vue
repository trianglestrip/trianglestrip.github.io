<template>
  <div class="follow-recommend" :class="{ 'follow-recommend--sheet': showTabBar }">
    <div v-if="showTabBar" class="follow-recommend__tabs">
      <button type="button" :class="{ active: innerTab === 'follow' }" @click="innerTab = 'follow'">
        关注
      </button>
      <button type="button" :class="{ active: innerTab === 'recommend' }" @click="innerTab = 'recommend'">
        推荐
      </button>
    </div>

    <div
      v-show="effectiveTab === 'follow'"
      class="follow-recommend__panel follow-recommend__panel--follow scrolly"
    >
      <div class="follow-tab-toolbar">
        <div class="follow-tab-toolbar__actions">
          <button
            type="button"
            class="follow-toolbar-btn follow-list-mode-btn"
            :class="{ 'follow-list-mode-btn--active': !previewCover }"
            title="列表视图"
            @click="togglePreviewCover"
          >
            <Icon name="list" />
          </button>
        </div>
        <FollowPlatformFilter
          v-model="followSiteFilter"
          class="follow-tab-toolbar__filter"
        />
      </div>
      <FollowPreviewGrid
        v-if="previewCover"
        sidebar
        compact
        hide-live-frame
        :show-stats="false"
        :rooms="filteredFollows"
        @select="$emit('play-room', $event)"
      />
      <FollowRoomList
        v-else
        layout="grid"
        hide-live-frame
        :rooms="filteredFollows"
        :loading="followStatusLoading"
        :show-delete="false"
        compact
        @select="$emit('play-room', $event)"
      />
    </div>

    <div
      v-show="effectiveTab === 'recommend'"
      class="follow-recommend__panel follow-recommend__panel--recommend scrolly"
    >
      <p v-if="recommendLoading" class="recommend-hint">加载中…</p>
      <p v-else-if="recommendError" class="recommend-hint recommend-hint--err">{{ recommendError }}</p>
      <p v-else-if="!recommendPreviewRooms.length" class="recommend-hint">暂无推荐</p>
      <FollowPreviewGrid
        v-else
        sidebar
        compact
        :show-stats="false"
        :rooms="recommendPreviewRooms"
        @select="onRecommendSelect"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, toRef } from "vue";
import Icon from "./Icon.vue";
import FollowRoomList from "./FollowRoomList.vue";
import FollowPreviewGrid from "./FollowPreviewGrid.vue";
import FollowPlatformFilter from "./FollowPlatformFilter.vue";
import { fetchFollowStatus } from "../api/follow.js";
import { fetchCategoryRooms, fetchRelatedRecommendRooms, fetchMixedRecommendRooms, roomKey } from "../api/browse.js";
import { useFollowStatus } from "../composables/useFollowStatus.js";
import { loadGlobalPref, saveGlobalPref } from "../utils/prefStore.js";
import { displayCategoryName } from "../utils/categoryDisplay.js";

const props = defineProps({
  site: { type: String, default: "" },
  roomId: { type: String, default: "" },
  roomCategory: { type: String, default: "" },
  roomCid: { type: String, default: "" },
  roomPid: { type: String, default: "" },
  followList: { type: Array, default: () => [] },
  secondaryReady: { type: Boolean, default: true },
  /** 自带 Tab 栏（全屏浮层）；否则由 activePanel 指定单页 */
  showTabBar: { type: Boolean, default: false },
  activePanel: {
    type: String,
    default: "",
    validator: (v) => !v || v === "follow" || v === "recommend",
  },
  /** 父级控制关注轮询（侧栏 v-show 时为 false） */
  followPollActive: { type: Boolean, default: true },
});

const emit = defineEmits(["play-room"]);

const innerTab = ref("follow");

const effectiveTab = computed(() => {
  if (props.showTabBar) return innerTab.value;
  return props.activePanel || "follow";
});

const followUiPref = loadGlobalPref("play_follow_ui", { previewCover: true });
const previewCover = ref(followUiPref.previewCover !== false);
const followSiteFilter = ref("");

const followStatusActive = computed(
  () => props.followPollActive && effectiveTab.value === "follow" && props.secondaryReady,
);

const PLAY_FOLLOW_POLL_MS = 180000;
const PLAY_FOLLOW_MIN_REFRESH_MS = 60000;

const { sortedFollows, loading: followStatusLoading, refresh: refreshFollowStatus } = useFollowStatus(
  toRef(props, "followList"),
  {
    active: followStatusActive,
    pollInterval: PLAY_FOLLOW_POLL_MS,
    minRefreshMs: PLAY_FOLLOW_MIN_REFRESH_MS,
    shallowWatch: true,
    getFocusCategory(merged) {
      const room = merged.find(
        (item) => item.site === props.site && String(item.id) === String(props.roomId),
      );
      return displayCategoryName(props.site, room?.category, room?.cid);
    },
  },
);

const filteredFollows = computed(() => {
  const site = followSiteFilter.value;
  if (!site) return sortedFollows.value;
  return sortedFollows.value.filter((room) => room.site === site);
});

function togglePreviewCover() {
  previewCover.value = !previewCover.value;
  saveGlobalPref("play_follow_ui", { previewCover: previewCover.value });
}

const RECOMMEND_LIMIT = 20;
const RECOMMEND_PER_SITE = 10;

const recommendRooms = ref([]);
const recommendLoading = ref(false);
const recommendError = ref("");
const recommendLoaded = ref(false);

const recommendPreviewRooms = computed(() =>
  recommendRooms.value.map((room) => {
    const site = room.siteId || room.site || props.site;
    const offline = room.status === false || room.liveState === "offline";
    return {
      site,
      id: roomKey(room),
      anchor: room.nickname || room.title || roomKey(room),
      cover: room.cover || "",
      state: room.liveState || (room.status ? "live" : "offline"),
      online: offline ? "" : room.online || "",
      category: room.category || "",
      cid: room.cid || "",
    };
  }),
);

function findCurrentFollowRoom() {
  return (
    sortedFollows.value.find(
      (item) => item.site === props.site && String(item.id) === String(props.roomId),
    ) ||
    props.followList?.find(
      (item) => item.site === props.site && String(item.id) === String(props.roomId),
    ) ||
    null
  );
}

function excludeCurrentRoom(list) {
  return (list || []).filter(
    (room) =>
      String(room.siteId || room.site) !== props.site ||
      String(roomKey(room)) !== String(props.roomId),
  );
}

async function resolveRecommendContext() {
  const browseCid = String(props.roomCid || "").trim();
  const browsePid = String(props.roomPid || "").trim();
  if (browseCid) {
    return {
      category: props.roomCategory || "",
      cid: browseCid,
      pid: browsePid,
      fromBrowse: true,
    };
  }

  const room = findCurrentFollowRoom();
  const roomCid = props.roomCid || (room?.cid ? String(room.cid).trim() : "");

  if (props.roomCategory) {
    return { category: props.roomCategory, cid: roomCid };
  }

  const raw = room?.category ? String(room.category).trim() : "";
  if (raw || roomCid) {
    return {
      category: displayCategoryName(props.site, raw, roomCid),
      cid: roomCid,
    };
  }

  if (props.site && props.roomId) {
    try {
      const data = await fetchFollowStatus([{ site: props.site, id: props.roomId }]);
      const snap = data.list?.[0];
      const cat = String(snap?.category || "").trim();
      if (cat) {
        return {
          category: displayCategoryName(props.site, cat, roomCid),
          cid: roomCid,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return { category: "", cid: roomCid };
}

async function loadRecommend() {
  if (recommendLoaded.value || recommendLoading.value) return;
  recommendLoading.value = true;
  recommendError.value = "";
  try {
    const { category, cid, pid, fromBrowse } = await resolveRecommendContext();
    if (fromBrowse && cid && props.site === "douyin") {
      const data = await fetchCategoryRooms(props.site, { cid, pid, page: 1 });
      recommendRooms.value = excludeCurrentRoom(data.list).slice(0, RECOMMEND_LIMIT);
    } else if (category) {
      const data = await fetchRelatedRecommendRooms({
        site: props.site,
        category,
        cid,
        page: 1,
        perSite: RECOMMEND_PER_SITE,
        limit: RECOMMEND_LIMIT,
      });
      recommendRooms.value = excludeCurrentRoom(data.list).slice(0, RECOMMEND_LIMIT);
    } else {
      const mixed = await fetchMixedRecommendRooms({ page: 1, perSite: RECOMMEND_PER_SITE });
      recommendRooms.value = excludeCurrentRoom(mixed).slice(0, RECOMMEND_LIMIT);
    }
    if (!recommendRooms.value.length) throw new Error("暂无推荐直播");
    recommendLoaded.value = true;
  } catch (err) {
    recommendError.value = err.message;
  } finally {
    recommendLoading.value = false;
  }
}

function onRecommendSelect(room) {
  emit("play-room", room);
}

watch(effectiveTab, (value) => {
  if (value === "recommend") loadRecommend();
}, { immediate: true });

watch(followStatusActive, (active) => {
  if (active) refreshFollowStatus();
});

watch(
  () => [props.site, props.roomId, props.roomCategory, props.roomCid, props.roomPid],
  () => {
    recommendRooms.value = [];
    recommendLoaded.value = false;
    recommendError.value = "";
    if (effectiveTab.value === "recommend") loadRecommend();
  },
);
</script>

<style scoped>
.follow-recommend {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.follow-recommend__tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--chrome-border);
}

.follow-recommend__tabs button {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: .82rem;
  padding: .45rem .5rem;
  cursor: pointer;
  transition: color .15s;
}

.follow-recommend__tabs button.active {
  color: var(--amber);
  box-shadow: inset 0 -2px 0 var(--amber);
}

.follow-recommend__panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.follow-recommend__panel.scrolly {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.follow-tab-toolbar {
  display: flex;
  align-items: center;
  gap: .35rem;
  padding: .28rem .4rem;
  flex-shrink: 0;
}

.follow-tab-toolbar__actions {
  flex-shrink: 0;
}

.follow-tab-toolbar__filter {
  flex: 1;
  min-width: 0;
}

.follow-tab-toolbar__filter :deep(.follow-platform-filter) {
  gap: .28rem;
}

.follow-tab-toolbar__filter :deep(.follow-platform-filter__item) {
  padding: .22rem .44rem;
  border-radius: 4px;
  font-size: .8rem;
}

.follow-recommend--sheet .follow-recommend__tabs button {
  font-size: .96rem;
  padding-top: .34rem;
  padding-bottom: .36rem;
}

.follow-recommend--sheet .follow-tab-toolbar {
  gap: .28rem;
  padding: .22rem .36rem .3rem;
}

.follow-recommend--sheet .follow-tab-toolbar__filter :deep(.follow-platform-filter) {
  gap: .22rem;
}

.follow-recommend--sheet .follow-tab-toolbar__filter :deep(.follow-platform-filter__item) {
  padding: .16rem .38rem;
  border-radius: 4px;
  font-size: .72rem;
  font-weight: 600;
  line-height: 1.25;
}

.follow-recommend--sheet .follow-toolbar-btn {
  width: 1.55rem;
  height: 1.55rem;
  font-size: .82rem;
}

.follow-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  border: 1px solid var(--chrome-border);
  border-radius: 5px;
  background: var(--play-input-bg);
  color: var(--muted);
  cursor: pointer;
}

.follow-list-mode-btn--active {
  color: var(--amber);
  border-color: var(--primary-border-strong);
}

.recommend-hint {
  margin: .65rem .45rem;
  font-size: .82rem;
  color: var(--muted);
}

.recommend-hint--err {
  color: var(--danger);
}
</style>
