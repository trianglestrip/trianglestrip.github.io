<template>
  <AppLayout active-site="douyu">
    <div class="follow-page">
      <header class="follow-header">
        <h1>我的关注</h1>
        <div class="follow-header__actions">
          <FollowPlatformFilter v-model="followSiteFilter" compact class="follow-header__filter" />
          <button
            type="button"
            class="btn btn-sm btn-refresh"
            title="刷新封面与状态"
            :disabled="followStatusLoading"
            @click="refreshFollowStatus"
          >
            <Icon name="refresh" :class="{ 'fa-spin': followStatusLoading }" />
          </button>
          <button
            type="button"
            class="btn btn-sm btn-list-mode"
            :class="{ 'btn-list-mode--active': !previewCover }"
            title="列表视图"
            @click="togglePreviewCover"
          >
            <Icon name="list" />
          </button>
          <FollowBatchImport inline />
          <template v-if="batchMode">
            <button type="button" class="btn btn-sm" @click="exitBatchMode">取消</button>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              :disabled="selectedKeys.length === 0"
              @click="confirmBatchDelete"
            >
              删除选中 ({{ selectedKeys.length }})
            </button>
          </template>
          <button v-else type="button" class="btn btn-sm" @click="enterBatchMode">批量删除</button>
        </div>
      </header>

      <div class="follow-list scrolly">
        <p v-if="!filteredFollows.length" class="page-msg">暂无关注，可使用批量加入</p>
        <RoomGrid
          v-else-if="previewCover"
          :rooms="gridRooms"
          :select-mode="batchMode"
          :selected-keys="selectedKeys"
          @select="goPlay"
          @toggle-select="toggleSelect"
        />
        <FollowRoomList
          v-else
          layout="grid"
          :rooms="filteredFollows"
          :loading="followStatusLoading"
          :show-delete="false"
          :select-mode="batchMode"
          :selected-keys="selectedKeys"
          empty-text="暂无关注，可使用批量加入"
          @select="goPlay"
          @toggle-select="toggleSelect"
        />
        <p v-if="filteredFollows.length && followStatusLoading" class="follow-sync-hint">
          {{ previewCover ? "更新封面中…" : "更新状态中…" }}
        </p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import FollowPlatformFilter from "../components/FollowPlatformFilter.vue";
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import FollowBatchImport from "../components/FollowBatchImport.vue";
import FollowRoomList from "../components/FollowRoomList.vue";
import RoomGrid from "../components/RoomGrid.vue";
import Icon from "../components/Icon.vue";
import { useFollow } from "../composables/useFollow.js";
import { useFollowStatus } from "../composables/useFollowStatus.js";
import { followRoomToGrid } from "../utils/followDisplay.js";
import { followKey, loadGlobalPref, saveGlobalPref } from "../utils/prefStore.js";
import { preloadPlayView } from "../utils/preloadPlayView.js";

const router = useRouter();
const { follows, unfollowMany } = useFollow();
const { sortedFollows, loading: followStatusLoading, refresh: refreshFollowStatus } = useFollowStatus(
  follows,
  { pollInterval: 90000 },
);

const followUiPref = loadGlobalPref("follow_ui", { previewCover: true });
const previewCover = ref(followUiPref.previewCover !== false);

const followSiteFilter = ref("");
const filteredFollows = computed(() => {
  const site = followSiteFilter.value;
  if (!site) return sortedFollows.value;
  return sortedFollows.value.filter((room) => room.site === site);
});

const gridRooms = computed(() => filteredFollows.value.map(followRoomToGrid));

onMounted(() => {
  preloadPlayView();
});

function togglePreviewCover() {
  previewCover.value = !previewCover.value;
  saveGlobalPref("follow_ui", { previewCover: previewCover.value });
}

const batchMode = ref(false);
const selectedKeys = ref([]);

function goPlay(room) {
  const site = room.site || followSiteFilter.value;
  const id = room.id || String(room.roomId || "").split(":").pop();
  if (!site || !id) return;
  router.push({ name: "play", params: { site, id } });
}

function enterBatchMode() {
  batchMode.value = true;
  selectedKeys.value = [];
}

function exitBatchMode() {
  batchMode.value = false;
  selectedKeys.value = [];
}

function toggleSelect(room) {
  const site = room.site;
  const id = room.id;
  if (!site || !id) return;
  const key = followKey(site, id);
  const idx = selectedKeys.value.indexOf(key);
  if (idx >= 0) {
    selectedKeys.value.splice(idx, 1);
  } else {
    selectedKeys.value.push(key);
  }
}

function confirmBatchDelete() {
  if (!selectedKeys.value.length) return;
  const keys = new Set(selectedKeys.value);
  const toRemove = sortedFollows.value.filter((r) => keys.has(followKey(r.site, r.id)));
  if (!toRemove.length) {
    exitBatchMode();
    return;
  }
  unfollowMany(toRemove);
  exitBatchMode();
}
</script>

<style scoped>
.follow-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  max-width: none;
}

.follow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  padding: .75rem 1rem .35rem;
}

.follow-header h1 {
  margin: 0;
  font-size: 1.15rem;
}

.follow-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .4rem;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
}

.follow-header__filter {
  flex: 1;
  min-width: 0;
}

.btn-sm {
  padding: .38rem .65rem;
  font-size: .82rem;
}

.btn-danger {
  border-color: rgba(255, 107, 107, .55);
  color: var(--danger);
}

.btn-danger:hover:not(:disabled) {
  border-color: var(--danger);
  color: #fff;
  background: rgba(255, 107, 107, .18);
}

.btn-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .38rem .5rem;
  line-height: 1;
}

.btn-refresh :deep(.ui-icon) {
  font-size: .88rem;
  line-height: 1;
}

.btn-list-mode {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .38rem .5rem;
  line-height: 1;
  color: var(--muted);
}

.btn-list-mode :deep(.ui-icon) {
  font-size: .88rem;
  line-height: 1;
}

.btn-list-mode--active {
  color: var(--amber);
  border-color: rgba(243, 208, 78, 0.45);
  background: rgba(243, 208, 78, 0.1);
}

.follow-list {
  flex: 1;
  min-height: 0;
}

.page-msg {
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--muted);
  font-size: .9rem;
}

.follow-sync-hint {
  margin: 0;
  padding: .35rem 1rem .75rem;
  text-align: center;
  font-size: .78rem;
  color: var(--muted);
}
</style>
