<template>
  <AppLayout :active-site="site">
    <div class="play-layout" :class="{ 'play-layout--webscreen': webscreen }">
      <section class="play-main">
        <header v-if="headerReady" class="play-header">
          <RouterLink :to="`/${site}`" class="play-back" title="返回">
          <Icon name="arrow-left" />
        </RouterLink>
          <h1 class="play-title">{{ displayTitle }}</h1>
        </header>

        <div ref="frameRef" class="play-frame" :class="{ 'play-frame--webscreen': webscreen }">
          <div class="video-shell" @click="onVideoShellClick">
            <PlayerPanel
              ref="playerPanelRef"
              :stream-active="streamActive"
              :placeholder="notice || '加载中...'"
            />
            <DanmakuOverlay
              v-if="danmakuReady && payload"
              :messages="danmakuMessages"
              :settings="overlaySettings"
              :stream-active="streamActive"
              :playing="playing"
            />
            <PlayerControls
              v-if="controlsReady"
              overlay
              :show="showControls"
              :playing="playing"
              :qualities="qualityOpts"
              :lines="lineOpts"
              :quality-index="qualityIndex"
              :line-index="lineIndex"
              :notice="controlNotice"
              :is-followed="isFollowed(site, id)"
              :danmaku-on="overlaySettings.show"
              :webscreen="webscreen"
              :fullscreen="isFullscreen"
              :picture-in-picture="pictureInPicture"
              :volume="volume"
              :muted="muted"
              @toggle-play="togglePlay"
              @webscreen="toggleWebscreen"
              @fullscreen="toggleFullscreen"
              @quality-change="onQualityChange"
              @line-change="onLineChange"
              @toggle-follow="onToggleFollow"
              @refresh="onRefresh"
              @toggle-danmaku="onToggleDanmaku"
              @toggle-pip="onTogglePiP"
              @volume-change="onVolumeChange"
              @toggle-mute="onToggleMute"
            />
            <div v-if="notice && !streamActive" class="play-overlay">{{ notice }}</div>
          </div>
        </div>
      </section>

      <PlaySidePanel
        v-if="sideReady && !webscreen"
        v-model:overlay-settings="overlaySettings"
        v-model:chat-settings="chatSettings"
        :status-text="statusText"
        :payload="payload"
        :danmaku-messages="danmakuMessages"
        :danmaku-status="danmakuStatus"
        :follow-list="follows"
        :is-followed="isFollowed(site, id)"
        @play-room="onPlayFollow"
        @unfollow="onUnfollow"
        @toggle-follow="onToggleFollow"
      />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, onMounted, nextTick, defineAsyncComponent } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlayerPanel from "../components/PlayerPanel.vue";
import Icon from "../components/Icon.vue";
import { getPlatform } from "../config/platforms";
import { useRoom, usePlayer } from "../composables/useLive.js";
import { useDanmaku } from "../composables/useDanmaku.js";
import { useFollow } from "../composables/useFollow.js";
import { followKey } from "../utils/prefStore.js";
import { isSoundUnlocked, unlockSound, resetSoundSession } from "../utils/soundSession.js";

const PlayerControls = defineAsyncComponent(() => import("../components/PlayerControls.vue"));
const PlaySidePanel = defineAsyncComponent(() => import("../components/PlaySidePanel.vue"));
const DanmakuOverlay = defineAsyncComponent(() => import("../components/DanmakuOverlay.vue"));

const props = defineProps({
  site: { type: String, required: true },
  id: { type: String, required: true },
});

const router = useRouter();
const siteRef = ref(props.site);
const roomInput = ref(props.id);
const playerPanelRef = ref(null);
const frameRef = ref(null);
const webscreen = ref(false);
const showControls = ref(true);
const controlNotice = ref("");
const isFullscreen = ref(false);
const pictureInPicture = ref(false);
const hideControlsTimer = ref(null);
const lastPlayedRoom = ref("");
const playUrl = ref("");
const headerReady = ref(false);
const controlsReady = ref(false);
const sideReady = ref(false);
const danmakuReady = ref(false);
let chromeRaf = 0;
let playRaf = 0;
let unmuteGestureBound = false;
const ENTRY_UNMUTE_EVENTS = ["pointerdown", "keydown"];
let playRetrying = false;

const platform = computed(() => getPlatform(props.site));
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
  refetchRoom,
  resolvePlayUrl,
  qualityOptions,
  lineOptions,
  onQualityChange: setQuality,
  onLineChange: setLine,
  buildMetaText,
} = useRoom(siteRef);

const qualityOpts = computed(() => qualityOptions());
const lineOpts = computed(() => lineOptions());

const {
  playing,
  streamActive,
  muted,
  volume,
  destroy,
  playFlv,
  startPlay,
  togglePlay,
  unmutePlayback,
  setVolume,
  toggleMute,
} = usePlayer(siteRef);
const {
  messages: danmakuMessages,
  status: danmakuStatus,
  overlaySettings,
  chatSettings,
  connect: connectDm,
  disconnect: disconnectDm,
} = useDanmaku(siteRef, roomInput);
const { follows, isFollowed, toggleFollow, unfollow } = useFollow();

watch(payload, (data) => {
  if (!data) return;
  const key = followKey(props.site, roomInput.value);
  const idx = follows.value.findIndex((r) => followKey(r.site, r.id) === key);
  if (idx < 0) return;
  const room = follows.value[idx];
  if (data.cover && !room.cover) room.cover = data.cover;
  if (data.avatar && !room.avatar) room.avatar = data.avatar;
});

const notice = computed(() =>
  loading.value ? "加载中..." : statusKind.value === "err" ? statusText.value : "",
);

async function retryPlaybackAfterError() {
  if (playRetrying || loading.value) return;
  playRetrying = true;
  setStatus("播放地址失效，正在重新解析…", "info");
  try {
    playUrl.value = "";
    destroy();
    await refetchRoom({ force: true });
    await startPlayback();
  } catch (err) {
    setStatus(`播放失败: ${err.message}`, "err");
  } finally {
    playRetrying = false;
  }
}

function buildPlayCallbacks(url, { onReadyExtra } = {}) {
  return {
    site: siteRef.value,
    onError: () => {
      if (playRetrying) {
        setStatus(`${buildMetaText(url)}\n播放出错`, "err");
        return;
      }
      retryPlaybackAfterError();
    },
    onReady: () => {
      if (!playing.value) startPlay();
      if (isSoundUnlocked() && muted.value) unmutePlayback();
      const suffix = muted.value ? "（静音）" : "";
      setStatus(`${buildMetaText(url)}\n播放中${suffix}`, "ok");
      document.title = displayTitle.value;
      onReadyExtra?.();
    },
  };
}

function bindEntryUnmuteGesture() {
  if (unmuteGestureBound) return;
  for (const eventName of ENTRY_UNMUTE_EVENTS) {
    document.addEventListener(eventName, onEntryUnmuteGesture, true);
  }
  unmuteGestureBound = true;
}

function unbindEntryUnmuteGesture() {
  if (!unmuteGestureBound) return;
  for (const eventName of ENTRY_UNMUTE_EVENTS) {
    document.removeEventListener(eventName, onEntryUnmuteGesture, true);
  }
  unmuteGestureBound = false;
}

function markSoundUnlocked() {
  unlockSound();
  unbindEntryUnmuteGesture();
}

/** destroy 前记下用户已开声，避免切房后丢失解锁状态 */
function captureSoundUnlock() {
  if (isSoundUnlocked()) return;
  const video = resolveVideoEl(playerPanelRef.value?.videoEl);
  if (!streamActive.value || !video) return;
  if (!video.muted) {
    unlockSound();
  }
}

/** 首次静音进房：pointerdown / keydown 才算有效手势（mousemove 无法解除自动播放静音） */
async function onEntryUnmuteGesture(event) {
  if (event.type === "keydown") {
    const key = event.key;
    if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta" || key === "Tab") {
      return;
    }
  }
  if (muted.value) {
    const ok = await unmutePlayback();
    if (ok) markSoundUnlocked();
    return;
  }
  markSoundUnlocked();
  if (!playing.value) startPlay();
}

function onToggleMute() {
  const wasMuted = muted.value;
  toggleMute();
  if (wasMuted && !muted.value) markSoundUnlocked();
}

function onVolumeChange(value) {
  setVolume(value);
  if (Number(value) > 0 && !muted.value) markSoundUnlocked();
}

async function onVideoShellClick(event) {
  if (!streamActive.value) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".player-controls, .play-overlay")) return;
  revealControls();
  if (muted.value) {
    const ok = await unmutePlayback();
    if (ok) markSoundUnlocked();
    return;
  }
  if (!playing.value) startPlay();
}

function scheduleDeferredChrome() {
  headerReady.value = false;
  controlsReady.value = false;
  sideReady.value = false;
  danmakuReady.value = false;
  cancelAnimationFrame(chromeRaf);
  chromeRaf = requestAnimationFrame(() => {
    headerReady.value = true;
    controlsReady.value = true;
  });
}

function runIdle(fn) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(fn, { timeout: 2500 });
  } else {
    setTimeout(fn, 48);
  }
}

function onPlaybackReady() {
  danmakuReady.value = true;
  runIdle(() => {
    sideReady.value = true;
    connectDm();
  });
}

function schedulePlay(room) {
  cancelAnimationFrame(playRaf);
  playRaf = requestAnimationFrame(() => {
    nextTick(() => playRoom(room));
  });
}

function syncRouteState(site, id) {
  captureSoundUnlock();
  siteRef.value = site;
  roomInput.value = id;
  unbindEntryUnmuteGesture();
  destroy();
  disconnectDm();
  payload.value = null;
  playUrl.value = "";
  lastPlayedRoom.value = "";
  document.title = "Lemon live";
  scheduleDeferredChrome();
}

function resolveVideoEl(raw) {
  if (!raw) return null;
  if (raw instanceof HTMLVideoElement) return raw;
  if (typeof raw === "object" && raw.value instanceof HTMLVideoElement) return raw.value;
  return raw;
}

async function ensureVideoEl() {
  let el = resolveVideoEl(playerPanelRef.value?.videoEl);
  if (el) return el;
  await nextTick();
  el = resolveVideoEl(playerPanelRef.value?.videoEl);
  if (el) return el;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  el = resolveVideoEl(playerPanelRef.value?.videoEl);
  if (!el) throw new Error("播放器未就绪");
  return el;
}

async function prefetchPlayUrl({ force = false } = {}) {
  const { url } = await resolvePlayUrl({ force });
  playUrl.value = url;
  return url;
}

function onToggleDanmaku() {
  overlaySettings.value.show = !overlaySettings.value.show;
}

async function onTogglePiP() {
  const video = playerPanelRef.value?.videoEl;
  if (!video) return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  } catch {
    /* unsupported or denied */
  }
}

function revealControls() {
  showControls.value = true;
  clearTimeout(hideControlsTimer.value);
  if (playing.value) {
    hideControlsTimer.value = setTimeout(() => {
      if (playing.value) showControls.value = false;
    }, 3000);
  }
}

function onToggleFollow() {
  if (!payload.value) return;
  toggleFollow({
    site: props.site,
    id: roomInput.value,
    title: payload.value.title || displayTitle.value,
    anchor: payload.value.anchor_name || "",
    cover: payload.value.cover || "",
    avatar: payload.value.avatar || "",
  });
}

function onUnfollow(room) {
  unfollow(room.site, room.id);
}

function onPlayFollow(room) {
  router.push({ name: "play", params: { site: room.site, id: room.id } });
}

async function onRefresh() {
  if (!payload.value || loading.value) return;
  destroy();
  disconnectDm();
  danmakuReady.value = false;
  sideReady.value = false;
  playUrl.value = "";
  try {
    await loadRoom(roomInput.value, { force: true });
    await startPlayback({ freshUrl: true });
  } catch (err) {
    setStatus(`刷新失败: ${err.message}`, "err");
  }
}

async function startPlayback({ startMuted, freshUrl = false } = {}) {
  const useMuted = startMuted ?? !isSoundUnlocked();
  const url = freshUrl
    ? await prefetchPlayUrl({ force: true })
    : playUrl.value || (await prefetchPlayUrl());
  setStatus(`${buildMetaText(url)}\n正在缓冲…`);
  const videoEl = await ensureVideoEl();
  const firstReady = !danmakuReady.value;
  playFlv(videoEl, url, {
    ...buildPlayCallbacks(url, {
      onReadyExtra: () => {
        if (!firstReady) return;
        onPlaybackReady();
      },
    }),
    startMuted: useMuted,
  });
  await startPlay();
  if (isSoundUnlocked() && muted.value) await unmutePlayback();
  if (useMuted) bindEntryUnmuteGesture();
  else markSoundUnlocked();
}

async function playRoom(room) {
  if (!room || lastPlayedRoom.value === room) return;
  captureSoundUnlock();
  roomInput.value = room;
  destroy();
  disconnectDm();
  payload.value = null;
  playUrl.value = "";
  try {
    await loadRoom(room, { force: true });
    await startPlayback({ freshUrl: true });
    lastPlayedRoom.value = room;
  } catch {
    lastPlayedRoom.value = "";
  }
}

function toggleWebscreen() {
  webscreen.value = !webscreen.value;
  revealControls();
}

function toggleFullscreen() {
  const el = frameRef.value;
  if (!el) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen?.();
  revealControls();
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

function onPiPChange() {
  pictureInPicture.value = document.pictureInPictureElement === playerPanelRef.value?.videoEl;
}

async function onQualityChange(index) {
  if (!payload.value || loading.value) return;
  setQuality(index);
  destroy();
  disconnectDm();
  danmakuReady.value = false;
  try {
    await startPlayback({ freshUrl: true });
  } catch (err) {
    setStatus(`切换失败: ${err.message}`, "err");
  }
}

async function onLineChange(index) {
  if (!payload.value) return;
  setLine(index);
  destroy();
  try {
    await startPlayback({ freshUrl: true });
  } catch (err) {
    setStatus(`切换线路失败: ${err.message}`, "err");
  }
}

watch(
  () => [props.site, props.id],
  ([site, id]) => {
    syncRouteState(site, id);
    if (!getPlatform(site)?.enabled) return;
    schedulePlay(id);
  },
);

onMounted(() => {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "reload") resetSoundSession();
  } catch {
    /* ignore */
  }
  syncRouteState(props.site, props.id);
  if (getPlatform(props.site)?.enabled) {
    schedulePlay(props.id);
  }
  frameRef.value?.addEventListener("mousemove", revealControls);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("enterpictureinpicture", onPiPChange);
  document.addEventListener("leavepictureinpicture", onPiPChange);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(chromeRaf);
  cancelAnimationFrame(playRaf);
  destroy();
  disconnectDm();
  clearTimeout(hideControlsTimer.value);
  unbindEntryUnmuteGesture();
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("enterpictureinpicture", onPiPChange);
  document.removeEventListener("leavepictureinpicture", onPiPChange);
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
  z-index: 3;
}

.play-layout--webscreen .play-main {
  width: 100%;
}
</style>
