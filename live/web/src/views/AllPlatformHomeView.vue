<template>
  <AppLayout active-site="all">
    <PlatformTabs active-site="all" hide-headers class="platform-tabs--home">
      <p v-if="loadingCategories && !rooms.length" class="page-msg">加载热门分类…</p>
      <p v-else-if="listError && !rooms.length" class="page-msg page-msg--err">{{ listError }}</p>
      <template v-else>
        <p v-if="loadingRooms && !rooms.length" class="page-msg">加载中…</p>
        <p v-else-if="!rooms.length && !loadingRooms" class="page-msg">暂无直播</p>
        <InfiniteScroll
          v-else
          :loading="loadingRooms"
          :finished="!hasMore"
          :error="!!listError"
          @load="onLoad"
        >
          <RoomGrid :rooms="rooms" @select="onSelectRoom" />
        </InfiniteScroll>
      </template>
    </PlatformTabs>
  </AppLayout>
</template>

<script setup>
import { onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlatformTabs from "../components/PlatformTabs.vue";
import InfiniteScroll from "../components/InfiniteScroll.vue";
import RoomGrid from "../components/RoomGrid.vue";
import { roomKey } from "../api/browse.js";
import { useCrossBrowse } from "../composables/useCrossBrowse.js";
import { preloadPlayView } from "../utils/preloadPlayView.js";

const router = useRouter();
const route = useRoute();

const {
  activeKey,
  rooms,
  loadingCategories,
  loadingRooms,
  hasMore,
  listError,
  loadHotCategories,
  loadCrossRooms,
  loadMore,
  selectCategory,
} = useCrossBrowse();

onMounted(async () => {
  preloadPlayView();
  await loadHotCategories();
  const queryKey = String(route.query.key || "").trim();
  if (queryKey) {
    await selectCategory(queryKey);
    return;
  }
  if (activeKey.value) await loadCrossRooms(true);
});

watch(
  () => route.query.key,
  async (key) => {
    const text = String(key || "").trim();
    if (!text || text === activeKey.value) return;
    await selectCategory(text);
  },
);

function onLoad() {
  if (listError.value) {
    void loadCrossRooms(true);
    return;
  }
  void loadMore();
}

function onSelectRoom(room) {
  const site = room.siteId || room.site;
  const id = roomKey(room);
  if (!site || !id) return;
  router.push({ name: "play", params: { site, id } });
}
</script>

<style scoped>
.page-msg {
  padding: 1rem;
  text-align: center;
  color: var(--muted);
}

.page-msg--err {
  color: var(--danger);
}
</style>
