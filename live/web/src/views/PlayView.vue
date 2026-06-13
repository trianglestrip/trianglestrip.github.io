<template>
  <AppLayout :active-site="site">
    <div class="play-layout" :class="{ 'play-layout--webscreen': webscreen }">
      <section class="play-main">
        <header v-if="headerReady" class="play-header">
          <RouterLink :to="`/${site}`" class="play-back" title="返回">
            <Icon name="arrow-left" />
          </RouterLink>
          <div class="play-header-main">
            <h1 class="play-title">{{ displayTitle }}</h1>
          </div>
          <div
            v-if="showOnlineStat"
            class="play-online-inline"
            :class="{ 'play-online-inline--live': roomState === 'live' }"
            :title="`观看 ${onlineText}`"
          >
            <Icon name="users" class="play-online-fa" />
            <span>{{ onlineText }}</span>
          </div>
        </header>

        <div ref="frameRef" class="play-frame" :class="{ 'play-frame--webscreen': webscreen }">
          <div class="video-shell" @click="onVideoShellClick">
            <PlayerPanel
              ref="playerPanelRef"
              :stream-active="streamActive"
              :loading="panelLoading"
              :placeholder="panelMessage"
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
              v-model:overlay-settings="overlaySettings"
              overlay
              :show="showControls"
              :playing="playing"
              :qualities="qualityOpts"
              :lines="lineOpts"
              :quality-index="qualityIndex"
              :line-index="lineIndex"
              :notice="controlNotice"
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
              @refresh="onRefresh"
              @toggle-danmaku="onToggleDanmaku"
              @toggle-pip="onTogglePiP"
              @volume-change="onVolumeChange"
              @toggle-mute="onToggleMute"
            />
            <button
              v-if="showPauseOverlay"
              type="button"
              class="play-pause-overlay"
              aria-label="播放"
              @click.stop="onPauseOverlayClick"
            >
              <Icon name="play" class="play-pause-overlay__icon" />
            </button>
            <button
              v-if="showMuteHint"
              type="button"
              class="mute-hint"
              aria-label="点击解除静音"
              @click.stop="onMuteHintClick"
            >
              <Icon name="volume-off" class="mute-hint__icon" />
              <span>点击解除静音</span>
            </button>
          </div>
        </div>
      </section>

      <PlaySidePanel
        v-if="sideReady && !webscreen"
        ref="sidePanelRef"
        v-model:chat-settings="chatSettings"
        :site="site"
        :room-id="id"
        :status-text="statusText"
        :payload="payload"
        :danmaku-messages="danmakuMessages"
        :danmaku-status="danmakuStatus"
        :follow-list="follows"
        :is-super-followed="isSuperFollowed(site, id)"
        @play-room="onPlayFollow"
        @unfollow="onUnfollow"
        @toggle-super-follow="onToggleSuperFollow"
      />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, onMounted, nextTick, defineAsyncComponent } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlayerPanel from "../components/PlayerPanel.vue";
import PlaySidePanel from "../components/PlaySidePanel.vue";
import Icon from "../components/Icon.vue";
import { getPlatform } from "../config/platforms";
import { useRoom, usePlayer } from "../composables/useLive.js";
import { useDanmaku } from "../composables/useDanmaku.js";
import { useFollow } from "../composables/useFollow.js";
import { fetchFollowStatus } from "../api/follow.js";
import { followKey } from "../utils/prefStore.js";
import { isSoundUnlocked, unlockSound, resetSoundSession } from "../utils/soundSession.js";

const PlayerControls = defineAsyncComponent(() => import("../components/PlayerControls.vue"));
const DanmakuOverlay = defineAsyncComponent(() => import("../components/DanmakuOverlay.vue"));

const props = defineProps({
  site: { type: String, required: true },
  id: { type: String, required: true },
});

const router = useRouter();
const siteRef = ref(props.site);
const roomInput = ref(props.id);
const playerPanelRef = ref(null);
const sidePanelRef = ref(null);
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
/** 侧栏点切房：保留「已开声」意图，避免 loadRoom 异步后丢失 session 解锁 */
let roomSwitchKeepSound = false;
/** 用户主动点了控制条静音，不展示解除静音提示 */
const userChoseMute = ref(false);

const platform = computed(() => getPlatform(props.site));

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
} = useRoom(siteRef);

const displayTitle = computed(() => {
  const title = String(payload.value?.title || payload.value?.meta?.title || "").trim();
  if (title) return title;
  return `房间 ${props.id}`;
});

const roomOnline = ref("");
const roomState = ref("offline");
const onlineText = computed(() => roomOnline.value || "—");

const showOnlineStat = computed(() => {
  if (roomState.value === "offline") return false;
  const online = String(roomOnline.value || "").trim();
  return Boolean(online && online !== "—" && online !== "-");
});

const showMuteHint = computed(
  () => streamActive.value && muted.value && !userChoseMute.value,
);

const panelLoading = computed(() => loading.value && !streamActive.value);

const panelMessage = computed(() => {
  if (loading.value) return "";
  if (statusKind.value === "err") return statusText.value;
  return "";
});

const showPauseOverlay = computed(
  () => streamActive.value && !playing.value && !muted.value && !showMuteHint.value,
);

let onlineRefreshTimer = 0;

function syncOnlineFromPayload() {
  const data = payload.value;
  if (!data) return;
  if (data.is_live) {
    roomState.value = "live";
  } else {
    roomState.value = "offline";
    roomOnline.value = "";
  }
}

function scheduleDeferredOnlineRefresh() {
  clearTimeout(onlineRefreshTimer);
  onlineRefreshTimer = window.setTimeout(() => {
    void refreshRoomOnline();
  }, 2000);
}

async function refreshRoomOnline() {
  const rid = String(payload.value?.room_id || props.id || "").trim();
  if (!rid) {
    roomOnline.value = "";
    roomState.value = "offline";
    return;
  }
  try {
    const data = await fetchFollowStatus([{ site: props.site, id: rid }]);
    const snap = data.list?.[0];
    roomOnline.value = snap?.online || "";
    roomState.value = snap?.state || "offline";
  } catch {
    /* 保留上次 */
  }
}

watch(
  () => [props.site, props.id, payload.value?.room_id, payload.value?.is_live],
  () => {
    syncOnlineFromPayload();
    scheduleDeferredOnlineRefresh();
  },
  { immediate: true },
);

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
const { follows, isSuperFollowed, toggleSuperFollow, unfollow } = useFollow();

watch(payload, (data) => {
  if (!data) return;
  const key = followKey(props.site, roomInput.value);
  const idx = follows.value.findIndex((r) => followKey(r.site, r.id) === key);
  if (idx < 0) return;
  const room = follows.value[idx];
  if (data.cover && !room.cover) room.cover = data.cover;
  if (data.avatar && !room.avatar) room.avatar = data.avatar;
});

async function onPauseOverlayClick() {
  if (!streamActive.value) return;
  revealControls();
  togglePlay();
}

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
        setStatus("播放出错", "err");
        return;
      }
      retryPlaybackAfterError();
    },
    onReady: () => {
      if (!playing.value) startPlay();
      if (isSoundUnlocked() && muted.value) {
        void unmutePlayback({ soft: true }).then((ok) => {
          if (ok) markSoundUnlocked();
        });
      }
      const suffix = muted.value ? "（静音）" : "";
      setStatus(`播放中${suffix}`, "ok");
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
  const video = resolveVideoEl(playerPanelRef.value?.videoEl);
  if (!streamActive.value || !video) return;
  if (!video.muted) unlockSound();
}

function shouldSkipEntryUnmute(event) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    ".follow-room-list, .follow-tab, .follow-batch, .follow-tab-toolbar, .play-side",
  );
}

/** 首次静音进房：pointerdown / keydown 才算有效手势（mousemove 无法解除自动播放静音） */
function onEntryUnmuteGesture(event) {
  if (shouldSkipEntryUnmute(event)) return;
  if (event.type === "keydown") {
    const key = event.key;
    if (key === "Shift" || key === "Control" || key === "Alt" || key === "Meta" || key === "Tab") {
      return;
    }
  }
  if (muted.value) {
    void unmutePlayback().then((ok) => {
      if (ok) markSoundUnlocked();
    });
    return;
  }
  markSoundUnlocked();
  if (!playing.value) startPlay();
}

function onToggleMute() {
  const wasMuted = muted.value;
  toggleMute();
  if (wasMuted && !muted.value) {
    markSoundUnlocked();
    userChoseMute.value = false;
  } else if (!wasMuted && muted.value) {
    userChoseMute.value = true;
  }
}

async function onMuteHintClick() {
  if (!streamActive.value || !muted.value) return;
  const ok = await unmutePlayback();
  if (ok) {
    markSoundUnlocked();
    userChoseMute.value = false;
  }
}

function onVolumeChange(value) {
  setVolume(value);
  if (Number(value) > 0 && !muted.value) markSoundUnlocked();
}

async function onVideoShellClick(event) {
  if (!streamActive.value) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".player-controls, .mute-hint, .play-pause-overlay")) return;
  revealControls();
  if (muted.value) {
    const ok = await unmutePlayback();
    if (ok) markSoundUnlocked();
    return;
  }
  togglePlay();
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
  userChoseMute.value = false;
  siteRef.value = site;
  roomInput.value = id;
  unbindEntryUnmuteGesture();
  destroy();
  disconnectDm();
  payload.value = null;
  playUrl.value = "";
  lastPlayedRoom.value = "";
  roomOnline.value = "";
  document.title = "Lemon live";
  headerReady.value = true;
  controlsReady.value = true;
  sideReady.value = true;
  danmakuReady.value = false;
  nextTick(() => sidePanelRef.value?.refreshSide?.());
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

function cachedFollowRoom() {
  const rid = String(roomInput.value || props.id || "").trim();
  if (!rid) return null;
  const key = followKey(props.site, rid);
  return follows.value.find((r) => followKey(r.site, r.id) === key) || null;
}

function roomInfoForFollow() {
  const cached = cachedFollowRoom();
  const rid = String(roomInput.value || props.id || "").trim();
  return {
    site: props.site,
    id: rid,
    title: payload.value?.title || displayTitle.value || cached?.title || "",
    anchor: payload.value?.anchor_name || cached?.anchor || "",
    cover: payload.value?.cover || cached?.cover || "",
    avatar: payload.value?.avatar || cached?.avatar || "",
  };
}

function onToggleSuperFollow() {
  const info = roomInfoForFollow();
  if (!info.id) return;
  toggleSuperFollow(info);
}

function onUnfollow(room) {
  unfollow(room.site, room.id);
}

function onPlayFollow(room) {
  captureSoundUnlock();
  const keepSound = isSoundUnlocked() || (!muted.value && streamActive.value);
  if (keepSound) {
    unlockSound();
    roomSwitchKeepSound = true;
  }
  if (room.site === props.site && room.id === props.id) {
    roomSwitchKeepSound = false;
    onRefresh();
    sidePanelRef.value?.refreshSide?.();
    return;
  }
  router.push({ name: "play", params: { site: room.site, id: room.id } });
}

async function onRefresh() {
  if (!payload.value || loading.value) return;
  captureSoundUnlock();
  destroy();
  disconnectDm();
  danmakuReady.value = false;
  playUrl.value = "";
  try {
    await loadRoom(roomInput.value, { force: true });
    await startPlayback({ freshUrl: true, forceUrl: true });
  } catch (err) {
    setStatus(`刷新失败: ${err.message}`, "err");
  }
}

async function startPlayback({ startMuted, freshUrl = false, forceUrl = false } = {}) {
  const wantSound = roomSwitchKeepSound || isSoundUnlocked();
  roomSwitchKeepSound = false;
  const useMuted = startMuted ?? !wantSound;
  const url = freshUrl
    ? await prefetchPlayUrl({ force: forceUrl })
    : playUrl.value || (await prefetchPlayUrl());
  setStatus("缓冲中…");
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
  if (wantSound && muted.value) {
    const ok = await unmutePlayback({ soft: true });
    if (ok) markSoundUnlocked();
    else bindEntryUnmuteGesture();
    return;
  }
  if (useMuted) bindEntryUnmuteGesture();
  else {
    markSoundUnlocked();
    userChoseMute.value = false;
  }
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
    await loadRoom(room, { force: false });
    await startPlayback();
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
  headerReady.value = true;
  controlsReady.value = true;
  sideReady.value = true;
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
  clearTimeout(onlineRefreshTimer);
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: .25rem .5rem .5rem;
  flex-shrink: 0;
}

.play-back {
  position: absolute;
  left: .5rem;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 1.15rem;
}

.play-back:hover { color: var(--amber); }

.play-header-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5.5rem;
  max-width: 100%;
  min-width: 0;
  flex: 1;
}

.play-title {
  margin: 0;
  font-size: clamp(.95rem, 2vw, 1.15rem);
  font-weight: 600;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  width: 100%;
}

.play-online-inline {
  position: absolute;
  right: .5rem;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  gap: .18rem;
  flex-shrink: 0;
  font-size: .82rem;
  font-weight: 700;
  line-height: 1.2;
  padding: .14rem .28rem;
  border-radius: 4px;
  letter-spacing: .02em;
  font-variant-numeric: tabular-nums;
  color: #7eb0e8;
  background: rgba(110, 181, 255, 0.18);
}

.play-online-inline--live {
  color: #8ec0ff;
  background: rgba(110, 181, 255, 0.24);
}

.play-online-inline > span {
  line-height: 1.15;
}

.play-online-fa {
  font-size: .95em;
  line-height: 1;
  flex-shrink: 0;
  opacity: .9;
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

.mute-hint {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  padding: .55rem .85rem;
  border: 1px solid rgba(243, 208, 78, .45);
  border-radius: 999px;
  background: rgba(0, 0, 0, .72);
  color: var(--text);
  font: inherit;
  font-size: .9rem;
  line-height: 1.2;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .35);
  transition: border-color .15s, background .15s, transform .15s;
}

.mute-hint:hover {
  border-color: var(--amber);
  background: rgba(0, 0, 0, .82);
  transform: translate(-50%, -50%) scale(1.02);
}

.mute-hint__icon {
  font-size: 1.05rem;
  color: var(--amber);
}

.play-pause-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4.25rem;
  height: 4.25rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, .55);
  color: var(--text);
  cursor: pointer;
  box-shadow: 0 6px 24px rgba(0, 0, 0, .35);
  transition: background .15s, transform .15s;
}

.play-pause-overlay:hover {
  background: rgba(0, 0, 0, .72);
  transform: translate(-50%, -50%) scale(1.04);
}

.play-pause-overlay__icon {
  font-size: 2rem;
  color: var(--amber);
}

.play-layout--webscreen .play-main {
  width: 100%;
}
</style>
