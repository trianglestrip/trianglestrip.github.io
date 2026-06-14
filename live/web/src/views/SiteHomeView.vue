<template>
  <AppLayout :active-site="site">
    <PlatformTabs :active-site="site" hide-headers class="platform-tabs--home">
      <p v-if="!platform?.enabled" class="page-msg">该平台尚未接入</p>
      <section v-else-if="!browseEnabled" class="direct-page">
        <p class="direct-lead">{{ platform.description }}</p>
        <p class="direct-hint">
          该平台暂不支持推荐列表，请粘贴直播间链接或输入房间号。
          <template v-if="platform.defaultRoom">也可打开下方示例房间。</template>
        </p>
        <form class="direct-form" @submit.prevent="goRoom">
          <input
            v-model="roomInput"
            type="text"
            inputmode="numeric"
            placeholder="房间号或 live.douyin.com/xxx 链接"
            autocomplete="off"
          >
          <button type="submit" class="btn btn-primary">进入直播间</button>
        </form>
        <RouterLink
          v-if="platform.defaultRoom"
          :to="{ name: 'play', params: { site, id: platform.defaultRoom } }"
          class="direct-sample"
        >
          打开示例房间 {{ platform.defaultRoom }}
        </RouterLink>
      </section>
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
          <RoomGrid :site="site" :rooms="rooms" @select="onSelectRoom" />
        </InfiniteScroll>
      </template>
    </PlatformTabs>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlatformTabs from "../components/PlatformTabs.vue";
import InfiniteScroll from "../components/InfiniteScroll.vue";
import RoomGrid from "../components/RoomGrid.vue";
import { roomKey } from "../api/browse.js";
import { parseRoomId } from "../api/room.js";
import { getPlatform, supportsBrowse } from "../config/platforms";
import { useBrowse } from "../composables/useBrowse.js";
import { preloadPlayView } from "../utils/preloadPlayView.js";
import { saveBrowseContext } from "../utils/browseContext.js";

const props = defineProps({
  site: { type: String, required: true },
});

const router = useRouter();
const siteRef = ref(props.site);
const roomInput = ref("");
const platform = computed(() => getPlatform(props.site));
const browseEnabled = computed(() => supportsBrowse(props.site));

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
    roomInput.value = "";
    if (getPlatform(value)?.enabled && supportsBrowse(value)) {
      saveBrowseContext(value, { type: "home" });
      loadRecommend();
    }
    preloadPlayView();
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

function goRoom() {
  const id = parseRoomId(roomInput.value);
  if (!id) return;
  router.push({ name: "play", params: { site: props.site, id } });
}

function onSelectRoom(room) {
  const id = roomKey(room);
  if (!id) return;
  router.push({ name: "play", params: { site: props.site, id } });
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

.direct-page {
  max-width: 28rem;
  margin: 2rem auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.direct-lead {
  margin: 0;
  color: var(--text);
  font-size: .95rem;
}

.direct-hint {
  margin: 0;
  color: var(--muted);
  font-size: .88rem;
}

.direct-form {
  display: flex;
  flex-direction: column;
  gap: .65rem;
}

.direct-form input {
  width: 100%;
}

.direct-sample {
  font-size: .88rem;
  color: var(--amber);
}
</style>
