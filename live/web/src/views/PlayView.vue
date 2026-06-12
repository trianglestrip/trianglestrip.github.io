<template>
  <AppLayout :active-site="site">
    <div class="play-layout" :class="{ 'play-layout--webscreen': webscreen }">
      <section class="play-main">
        <header class="play-header">
          <RouterLink :to="`/${site}`" class="play-back" title="返回">
            <i class="ri-arrow-left-line"></i>
          </RouterLink>
          <h1 class="play-title">{{ displayTitle }}</h1>
        </header>

        <div ref="frameRef" class="play-frame" :class="{ 'play-frame--webscreen': webscreen }">
          <div class="video-shell">
            <PlayerPanel
              ref="playerPanelRef"
              :playing="playing"
              :placeholder="notice || '加载中...'"
            />
            <div v-if="notice && !playing" class="play-overlay">{{ notice }}</div>
          </div>
          <PlayerControls
            :show="showControls"
            :playing="playing"
            :qualities="qualityOptions()"
            :lines="lineOptions()"
            :quality-index="qualityIndex"
            :line-index="lineIndex"
            :notice="controlNotice"
            @toggle-play="togglePlay"
            @stop="onStop"
            @webscreen="toggleWebscreen"
            @fullscreen="toggleFullscreen"
            @quality-change="onQualityChange"
            @line-change="onLineChange"
          />
        </div>
      </section>

      <PlaySidePanel
        v-if="!webscreen"
        v-model:room-input="roomInput"
        :placeholder="inputPlaceholder"
        :loading="loading"
        :status-text="statusText"
        :status-kind="statusKind"
        :payload="payload"
        :follow-rooms="followRooms"
        @play="onPlay"
        @select-room="onSelectFollow"
      />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, onMounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlayerPanel from "../components/PlayerPanel.vue";
import PlayerControls from "../components/PlayerControls.vue";
import PlaySidePanel from "../components/PlaySidePanel.vue";
import { roomKey, fetchRecommendRooms } from "../api/browse.js";
import { getPlatform } from "../config/platforms";
import { useRoom, usePlayer } from "../composables/useLive.js";

const props = defineProps({
  site: { type: String, required: true },
  id: { type: String, required: true },
});

const router = useRouter();
const siteRef = ref(props.site);
const roomInput = ref(props.id);
const playerPanelRef = ref(null);
const frameRef = ref(null);
const followRooms = ref([]);
const webscreen = ref(false);
const showControls = ref(true);
const controlNotice = ref("");
const lastPlayedRoom = ref("");

const platform = computed(() => getPlatform(props.site));
const inputPlaceholder = computed(() =>
  platform.value?.defaultRoom ? `例如 ${platform.value.defaultRoom}` : "房间号",
);
const displayTitle = computed(
  () => payload.value?.title || payload.value?.anchor_name || `房间 ${props.id}`,
);

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
const notice = computed(() => (loading.value ? "加载中..." : statusKind.value === "err" ? statusText.value : ""));

async function loadFollowList() {
  try {
    const data = await fetchRecommendRooms(props.site, 1);
    followRooms.value = (data.list || []).filter((r) => roomKey(r) !== props.id).slice(0, 12);
  } catch {
    followRooms.value = [];
  }
}

async function startPlayback() {
  const { url } = await resolvePlayUrl();
  const videoEl = playerPanelRef.value?.videoEl;
  if (!videoEl) throw new Error("播放器未就绪");
  playFlv(videoEl, url, {
    onError: () => setStatus(`${buildMetaText(url)}\n播放中断，可尝试切换线路`, "err"),
    onReady: () => {
      setStatus(`${buildMetaText(url)}\n播放中`, "ok");
      document.title = displayTitle.value;
    },
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
    if (roomId && roomId !== props.id) {
      router.replace({ name: "play", params: { site: props.site, id: roomId } });
    }
  } catch {
    /* setStatus done */
  }
}

function onStop() {
  destroy();
  lastPlayedRoom.value = "";
  setStatus("已停止");
}

function togglePlay() {
  const video = playerPanelRef.value?.videoEl;
  if (!video) return;
  if (video.paused) video.play();
  else video.pause();
}

function toggleWebscreen() {
  webscreen.value = !webscreen.value;
}

function toggleFullscreen() {
  const el = frameRef.value;
  if (!el) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen?.();
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

function onSelectFollow(room) {
  const id = roomKey(room);
  if (!id) return;
  router.push({ name: "play", params: { site: props.site, id } });
}

watch(
  () => [props.site, props.id],
  async ([site, id]) => {
    siteRef.value = site;
    roomInput.value = id;
    destroy();
    payload.value = null;
    lastPlayedRoom.value = "";
    document.title = "Lemon live";
    if (platform.value?.enabled) {
      await playRoom(id);
      loadFollowList();
    }
  },
  { immediate: true },
);

onMounted(() => {
  frameRef.value?.addEventListener("mousemove", () => {
    showControls.value = true;
  });
});

onBeforeUnmount(() => {
  destroy();
  document.title = "Lemon live";
});
</script>

<style scoped>
.play-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 0;
}

@media (min-width: 1024px) {
  .play-layout {
    flex-direction: row;
  }
}

.play-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.play-header {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .25rem .5rem .5rem;
  flex-shrink: 0;
}

.play-back {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 1.15rem;
}

.play-back:hover { color: var(--amber); }

.play-title {
  flex: 1;
  margin: 0;
  font-size: clamp(.95rem, 2vw, 1.15rem);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}

.play-frame--webscreen {
  position: fixed;
  inset: var(--nav-height) 0 0 0;
  z-index: 20;
  border-radius: 0;
}

@media (min-width: 768px) {
  .play-frame--webscreen {
    inset: 0 0 0 var(--nav-width);
  }
}

.video-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  aspect-ratio: 16 / 9;
  max-height: 100%;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, .55);
  color: var(--amber);
  font-size: .95rem;
  pointer-events: none;
}

.play-layout--webscreen .play-main {
  width: 100%;
}
</style>
