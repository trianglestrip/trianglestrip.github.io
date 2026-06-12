<template>
  <AppLayout :active-site="site">
    <main class="stage">
      <PlayerPanel
        ref="playerPanelRef"
        :playing="playing"
        :payload="payload"
        :placeholder="platform?.enabled ? '输入房间号并点击播放' : '该平台尚未接入'"
      />
      <ControlPanel
        v-model:room-input="roomInput"
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
import PlayerPanel from "../components/PlayerPanel.vue";
import ControlPanel from "../components/ControlPanel.vue";
import { getPlatform } from "../config/platforms";
import { useRoom, usePlayer } from "../composables/useLive.js";

const props = defineProps({
  site: { type: String, required: true },
  room: { type: String, default: "" },
});

const router = useRouter();
const siteRef = ref(props.site);
const roomInput = ref(props.room || "");
const playerPanelRef = ref(null);

const platform = computed(() => getPlatform(props.site));
const inputPlaceholder = computed(() => {
  if (platform.value?.defaultRoom) return `例如 ${platform.value.defaultRoom}`;
  return "例如 5720533";
});

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

watch(
  () => props.site,
  (value) => {
    siteRef.value = value;
    destroy();
    payload.value = null;
  },
);

watch(
  () => props.room,
  (value) => {
    if (value) roomInput.value = value;
  },
  { immediate: true },
);

async function startPlayback() {
  const { url } = await resolvePlayUrl();
  const videoEl = playerPanelRef.value?.videoEl;
  if (!videoEl) throw new Error("播放器未就绪");
  playFlv(videoEl, url, {
    onError: () => setStatus(`${buildMetaText(url)}\n播放中断，可尝试切换线路`, "err"),
    onReady: () => setStatus(`${buildMetaText(url)}\n播放中`, "ok"),
  });
}

async function onPlay() {
  if (!platform.value?.enabled) {
    setStatus("该平台尚未接入", "err");
    return;
  }
  destroy();
  payload.value = null;
  try {
    const roomId = await loadRoom(roomInput.value, { autoPlay: true, playFn: startPlayback });
    if (roomId && roomId !== props.room) {
      router.replace({ name: "watch", params: { site: props.site, room: roomId } });
    }
  } catch {
    /* status already set */
  }
}

function onStop() {
  destroy();
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

onBeforeUnmount(() => {
  destroy();
});
</script>
