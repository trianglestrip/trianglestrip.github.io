<template>
  <AppLayout :active-site="site">
    <main class="watch-stage">
      <div v-if="platform?.enabled" class="browse-panel">
        <CategorySidebar
          :categories="categories"
          :active-cid="activeCategory?.cid ?? ''"
          :active-pid="activeCategory?.pid ?? ''"
          :loading="loadingCategories"
          @select="onSelectCategory"
          @select-recommend="onSelectRecommend"
        />
        <RoomList
          :rooms="rooms"
          :title="listTitle"
          :loading="loadingRooms"
          :has-more="hasMore"
          :error="listError"
          :active-room="props.room || ''"
          @select="onSelectRoom"
          @load-more="loadMore"
        />
      </div>

      <PlayerPanel
        ref="playerPanelRef"
        :playing="playing"
        :placeholder="platform?.enabled ? '从列表选择直播间' : '该平台尚未接入'"
      />
      <ControlPanel
        v-model:room-input="roomInput"
        :platform="platform"
        :payload="payload"
        :placeholder="inputPlaceholder"
        :qualities="qualityOptions()"
        :lines="lineOptions()"
        :quality-index="qualityIndex"
        :line-index="lineIndex"
        :loading="loading"
        :status-text="statusText"
        :status-kind="statusKind"
        @play="onPlay"
        @stop="onStop"
        @quality-change="onQualityChange"
        @line-change="onLineChange"
      />
    </main>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import CategorySidebar from "../components/CategorySidebar.vue";
import RoomList from "../components/RoomList.vue";
import PlayerPanel from "../components/PlayerPanel.vue";
import ControlPanel from "../components/ControlPanel.vue";
import { roomKey } from "../api/browse.js";
import { getPlatform } from "../config/platforms";
import { useBrowse } from "../composables/useBrowse.js";
import { useRoom, usePlayer } from "../composables/useLive.js";

const props = defineProps({
  site: { type: String, required: true },
  room: { type: String, default: "" },
  categoryId: { type: String, default: "" },
  pid: { type: String, default: "" },
});

const router = useRouter();
const siteRef = ref(props.site);
const roomInput = ref(props.room || "");
const playerPanelRef = ref(null);
const lastPlayedRoom = ref("");

const platform = computed(() => getPlatform(props.site));
const inputPlaceholder = computed(() => {
  if (platform.value?.defaultRoom) return `例如 ${platform.value.defaultRoom}`;
  return "房间号";
});

const {
  categories,
  rooms,
  listTitle,
  activeCategory,
  loadingCategories,
  loadingRooms,
  hasMore,
  listError,
  loadCategories,
  loadRecommend,
  loadCategoryRooms,
  loadMore,
  findCategory,
} = useBrowse(siteRef);

const {
  payload,
  loading,
  statusText,
  statusKind,
  qualityIndex,
  lineIndex,
  setStatus,
  loadRoom,
  resolvePlayUrl,
  qualityOptions,
  lineOptions,
  onQualityChange: setQuality,
  onLineChange: setLine,
  buildMetaText,
} = useRoom(siteRef);

const { playing, destroy, playFlv } = usePlayer();

function onSelectRecommend() {
  destroy();
  lastPlayedRoom.value = "";
  router.push({ name: "watch", params: { site: props.site } });
}

function onSelectCategory(category) {
  router.push({
    name: "browse-category",
    params: { site: props.site, cid: String(category.cid) },
    query: category.pid != null ? { pid: String(category.pid) } : {},
  });
}

function onSelectRoom(room) {
  const id = roomKey(room);
  if (!id) return;
  router.push({ name: "watch", params: { site: props.site, room: id } });
}

async function startPlayback() {
  const { url } = await resolvePlayUrl();
  const videoEl = playerPanelRef.value?.videoEl;
  if (!videoEl) throw new Error("播放器未就绪");
  playFlv(videoEl, url, {
    onError: () => setStatus(`${buildMetaText(url)}\n播放中断，可尝试切换线路`, "err"),
    onReady: () => setStatus(`${buildMetaText(url)}\n播放中`, "ok"),
  });
}

async function playRoom(room) {
  if (!room || lastPlayedRoom.value === room) return;
  roomInput.value = room;
  destroy();
  payload.value = null;
  try {
    await loadRoom(room, { autoPlay: true, playFn: startPlayback });
    lastPlayedRoom.value = room;
  } catch {
    lastPlayedRoom.value = "";
  }
}

async function onPlay() {
  if (!platform.value?.enabled) {
    setStatus("该平台尚未接入", "err");
    return;
  }
  destroy();
  payload.value = null;
  lastPlayedRoom.value = "";
  try {
    const roomId = await loadRoom(roomInput.value, { autoPlay: true, playFn: startPlayback });
    if (roomId) {
      lastPlayedRoom.value = roomId;
      if (roomId !== props.room) {
        router.replace({ name: "watch", params: { site: props.site, room: roomId } });
      }
    }
  } catch {
    /* status already set */
  }
}

function onStop() {
  destroy();
  lastPlayedRoom.value = "";
  setStatus("已停止");
}

async function onQualityChange(index) {
  if (!payload.value || loading.value) return;
  setQuality(index);
  destroy();
  try {
    await startPlayback();
  } catch (err) {
    setStatus(`切换失败: ${err.message}`, "err");
  }
}

async function onLineChange(index) {
  if (!payload.value) return;
  setLine(index);
  destroy();
  try {
    await startPlayback();
  } catch (err) {
    setStatus(`切换线路失败: ${err.message}`, "err");
  }
}

watch(
  () => [props.site, props.categoryId, props.pid, props.room],
  async ([site, categoryId, , room], prev) => {
    const prevSite = prev?.[0];
    const siteChanged = prevSite != null && prevSite !== site;
    siteRef.value = site;

    if (siteChanged) {
      destroy();
      payload.value = null;
      lastPlayedRoom.value = "";
      const p = getPlatform(site);
      if (p?.defaultRoom && !room) roomInput.value = p.defaultRoom;
      setStatus(`${p?.tabLabel || site} · 选择分类或直播间`);
    }

    if (!platform.value?.enabled) return;

    if (siteChanged || !categories.value.length) {
      await loadCategories();
    }

    if (categoryId) {
      await loadCategoryRooms(findCategory(categoryId, props.pid));
    } else if (!room) {
      await loadRecommend();
    }

    if (room) {
      await playRoom(room);
    } else if (siteChanged) {
      destroy();
      lastPlayedRoom.value = "";
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  destroy();
});
</script>

<style scoped>
.watch-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.browse-panel {
  display: flex;
  flex-shrink: 0;
  min-height: 0;
}

@media (max-width: 960px) {
  .watch-stage {
    flex-direction: column;
  }

  .browse-panel {
    flex-direction: column;
    width: 100%;
    max-height: 45vh;
  }
}
</style>
