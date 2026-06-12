<template>
  <AppLayout :active-site="site">
    <div class="category-rooms-page">
      <header class="page-header">
        <RouterLink :to="`/${site}/category`" class="back-link" title="返回分类">
          <i class="ri-arrow-left-line"></i>
        </RouterLink>
        <h1 class="page-title">{{ listTitle }}</h1>
        <button type="button" class="refresh-btn" :disabled="loadingRooms" title="刷新" @click="refresh">
          <i class="ri-refresh-line"></i>
        </button>
      </header>

      <div class="page-body scrolly">
        <p v-if="listError && !rooms.length" class="page-msg page-msg--err">{{ listError }}</p>
        <p v-else-if="loadingRooms && !rooms.length" class="page-msg">加载中...</p>
        <InfiniteScroll
          v-else
          :loading="loadingRooms"
          :finished="!hasMore"
          :error="!!listError"
          @load="onLoad"
        >
          <RoomGrid :rooms="rooms" @select="onSelectRoom" />
        </InfiniteScroll>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import InfiniteScroll from "../components/InfiniteScroll.vue";
import RoomGrid from "../components/RoomGrid.vue";
import { roomKey } from "../api/browse.js";
import { getPlatform } from "../config/platforms";
import { useBrowse } from "../composables/useBrowse.js";

const props = defineProps({
  site: { type: String, required: true },
  cid: { type: String, required: true },
  pid: { type: String, default: "" },
});

const router = useRouter();
const siteRef = ref(props.site);

const {
  categories,
  rooms,
  listTitle,
  loadingRooms,
  hasMore,
  listError,
  loadCategories,
  loadCategoryRooms,
  loadMore,
  findCategory,
} = useBrowse(siteRef);

async function loadPage(reset = true) {
  if (!categories.value.length) await loadCategories();
  const category = findCategory(props.cid, props.pid);
  await loadCategoryRooms(category, reset);
}

watch(
  () => [props.site, props.cid, props.pid],
  ([site]) => {
    siteRef.value = site;
    if (getPlatform(site)?.enabled) loadPage();
  },
  { immediate: true },
);

function refresh() {
  loadPage(true);
}

function onLoad() {
  if (listError.value) {
    loadPage(true);
    return;
  }
  loadMore();
}

function onSelectRoom(room) {
  const id = roomKey(room);
  if (!id) return;
  router.push({ name: "play", params: { site: props.site, id } });
}
</script>

<style scoped>
.category-rooms-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.page-header {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .35rem .5rem .65rem;
  border-bottom: 1px solid var(--gray-7);
  flex-shrink: 0;
}

.back-link, .refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
}

.back-link:hover, .refresh-btn:hover:not(:disabled) {
  color: var(--amber);
}

.page-title {
  flex: 1;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
}

.page-body {
  flex: 1;
  min-height: 0;
  height: calc(100% - 3.25rem);
}

.page-msg {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
}

.page-msg--err {
  color: var(--danger);
}
</style>
