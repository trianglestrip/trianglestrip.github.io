<template>
  <AppLayout :active-site="site">
    <PlatformTabs :active-site="site">
      <p v-if="!platform?.enabled" class="page-msg">该平台尚未接入</p>
      <template v-else>
        <p v-if="listError && !rooms.length" class="page-msg page-msg--err">{{ listError }}</p>
        <p v-else-if="loadingRooms && !rooms.length" class="page-msg">加载中...</p>
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
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlatformTabs from "../components/PlatformTabs.vue";
import InfiniteScroll from "../components/InfiniteScroll.vue";
import RoomGrid from "../components/RoomGrid.vue";
import { roomKey } from "../api/browse.js";
import { getPlatform } from "../config/platforms";
import { useBrowse } from "../composables/useBrowse.js";

const props = defineProps({
  site: { type: String, required: true },
});

const router = useRouter();
const siteRef = ref(props.site);
const platform = computed(() => getPlatform(props.site));

const {
  rooms,
  loadingRooms,
  hasMore,
  listError,
  loadRecommend,
  loadMore,
} = useBrowse(siteRef);

watch(
  () => props.site,
  (value) => {
    siteRef.value = value;
    if (getPlatform(value)?.enabled) loadRecommend();
  },
  { immediate: true },
);

function onLoad() {
  if (listError.value) {
    loadRecommend();
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
.page-msg {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
}

.page-msg--err {
  color: var(--danger);
}
</style>
