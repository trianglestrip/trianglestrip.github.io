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
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlatformTabs from "../components/PlatformTabs.vue";
import InfiniteScroll from "../components/InfiniteScroll.vue";
import RoomGrid from "../components/RoomGrid.vue";
import { roomKey } from "../api/browse.js";
import { useCrossBrowse } from "../composables/useCrossBrowse.js";
import { preloadPlayView } from "../utils/preloadPlayView.js";
import { saveBrowseContext } from "../utils/browseContext.js";
import { resolveCrossCategoryKey } from "../utils/categoryDisplay.js";

const props = defineProps({
  crossKey: { type: String, default: "" },
});

const router = useRouter();

const {
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

async function loadForKey(key) {
  const text = resolveCrossCategoryKey(key);
  if (!text) return;
  await loadHotCategories();
  await selectCategory(text);
  saveBrowseContext("all", { type: "cross", key: text });
}

onMounted(async () => {
  preloadPlayView();
  await loadForKey(props.crossKey);
});

watch(
  () => props.crossKey,
  (key) => {
    void loadForKey(key);
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
  if (room.cid != null && String(room.cid) !== "") {
    saveBrowseContext(site, {
      type: "category",
      cid: room.cid,
      pid: room.pid,
      name: room.category || "",
    });
  }
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
