<template>
  <AppLayout active-site="douyu">
    <div class="follow-page">
      <header class="follow-header">
        <h1>我的关注</h1>
        <div class="follow-header__actions">
          <FollowPlatformFilter v-model="followSiteFilter" class="follow-header__filter" />
          <button
            type="button"
            class="btn btn-sm btn-refresh"
            title="刷新状态"
            :disabled="followStatusLoading"
            @click="refreshFollowStatus"
          >
            <Icon
              name="refresh"
              :class="{ 'fa-spin': followStatusLoading }"
            />
          </button>
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

      <FollowBatchImport class="follow-batch-wrap" />

      <div class="follow-list scrolly">
        <FollowRoomList
          :rooms="filteredFollows"
          :loading="followStatusLoading"
          layout="grid"
          :show-delete="false"
          :select-mode="batchMode"
          :selected-keys="selectedKeys"
          empty-text="暂无关注，可使用批量加入"
          @select="goPlay"
          @toggle-select="toggleSelect"
        />
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, ref } from "vue";
import FollowPlatformFilter from "../components/FollowPlatformFilter.vue";
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import FollowBatchImport from "../components/FollowBatchImport.vue";
import FollowRoomList from "../components/FollowRoomList.vue";
import Icon from "../components/Icon.vue";
import { useFollow } from "../composables/useFollow.js";
import { useFollowStatus } from "../composables/useFollowStatus.js";
import { followKey } from "../utils/prefStore.js";

const router = useRouter();
const { follows, unfollowMany } = useFollow();
const { sortedFollows, loading: followStatusLoading, refresh: refreshFollowStatus } = useFollowStatus(follows);

const followSiteFilter = ref("");
const filteredFollows = computed(() => {
  const site = followSiteFilter.value;
  if (!site) return sortedFollows.value;
  return sortedFollows.value.filter((room) => room.site === site);
});

const batchMode = ref(false);
const selectedKeys = ref([]);

function goPlay(room) {
  router.push({ name: "play", params: { site: room.site, id: room.id } });
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
  const key = followKey(room.site, room.id);
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

.follow-batch-wrap {
  border-bottom: none;
  padding: 0 1rem .5rem;
}

.follow-batch-wrap :deep(.follow-batch) {
  padding: 0;
  border-bottom: none;
}

.follow-list {
  flex: 1;
  min-height: 0;
}
</style>
