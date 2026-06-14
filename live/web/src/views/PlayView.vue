<template>
  <AppLayout :active-site="site">
    <div
      ref="layoutRef"
      class="play-layout"
      :class="{ 'play-layout--webscreen': webscreen }"
    >
      <section class="play-main">
        <header v-if="headerReady && !webscreen" class="play-header">
          <RouterLink :to="playBackTo" class="play-back" title="返回">
            <Icon name="arrow-left" />
          </RouterLink>
          <span
            v-if="displayCategory"
            class="play-header-category"
            :style="categoryHeaderStyle"
          >{{ displayCategory }}</span>
          <div class="play-header-main">
            <h1 class="play-title">{{ displayTitle }}</h1>
          </div>
          <div
            v-if="showRoomStats"
            class="play-stats-inline"
            :class="{ 'play-stats-inline--live': roomState === 'live' }"
          >
            <span
              v-for="item in roomStatItems"
              :key="item.label"
              class="play-stat-item"
              :class="`play-stat-item--${item.tone}`"
            >
              {{ item.label }}：{{ item.value }}
            </span>
          </div>
        </header>

        <div
          ref="frameRef"
          class="play-frame"
          :class="{
            'play-frame--landscape-fallback': fullscreenLandscapeFallback,
          }"
        >
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
              :fullscreen="isFullscreen || webscreen"
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
              @interact="revealControls"
            />
            <button
              v-if="showPauseOverlay"
              type="button"
              class="play-pause-overlay on-video-surface"
              aria-label="播放"
              @click.stop="onPauseOverlayClick"
            >
              <Icon name="play" class="play-pause-overlay__icon" />
            </button>
            <button
              v-if="showMuteHint"
              type="button"
              class="mute-hint on-video-surface"
              aria-label="点击解除静音"
              @pointerdown.stop.prevent="onMuteHintClick"
              @click.stop.prevent
            >
              <Icon name="volume-off" class="mute-hint__icon" />
              <span>点击解除静音</span>
            </button>
          </div>
        </div>
      </section>

      <PlaySidePanel
        v-if="sideReady"
        ref="sidePanelRef"
        v-model:chat-settings="chatSettings"
        :webscreen="webscreen"
        :site="site"
        :room-id="id"
        :status-text="statusText"
        :payload="payload"
        :danmaku-messages="danmakuMessages"
        :danmaku-status="danmakuStatus"
        :follow-list="follows"
        :room-category="displayCategory"
        :room-cid="browseRoomCid"
        :room-pid="browseRoomPid"
        :is-super-followed="isSuperFollowed(site, id)"
        :secondary-ready="secondaryApiReady"
        :room-side-meta="roomSideMeta"
        @play-room="onPlayFollow"
        @unfollow="onUnfollow"
        @toggle-super-follow="onToggleSuperFollow"
        @trim-chat="trimDanmakuFromStart"
        @refresh-danmaku="onRefreshDanmaku"
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
import { fetchFollowStatus } from "../api/follow.js";
import { followKey } from "../utils/prefStore.js";
import { displayCategoryName } from "../utils/categoryDisplay.js";
import { briefPlayStatus } from "../utils/chatStatus.js";
import { getCategoryStyle } from "../utils/categoryColor.js";
import { compactMediaQuery } from "../utils/breakpoints.js";
import { browseBackTarget, loadBrowseContext } from "../utils/browseContext.js";
import { formatDouyinOnline } from "../utils/followDisplay.js";
import { isSoundUnlocked, unlockSound, resetSoundSession } from "../utils/soundSession.js";
import { runIdle } from "../utils/runIdle.js";

const PlayerControls = defineAsyncComponent(() => import("../components/PlayerControls.vue"));
const DanmakuOverlay = defineAsyncComponent(() => import("../components/DanmakuOverlay.vue"));
const PlaySidePanel = defineAsyncComponent(() => import("../components/PlaySidePanel.vue"));

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
const layoutRef = ref(null);
const webscreen = ref(false);
const showControls = ref(true);
const controlNotice = ref("");
const isFullscreen = ref(false);
const fullscreenLandscapeFallback = ref(false);
const pictureInPicture = ref(false);
const hideControlsTimer = ref(null);
const lastPlayedRoom = ref("");
const playUrl = ref("");
const headerReady = ref(false);
const controlsReady = ref(false);
const sideReady = ref(false);
const danmakuReady = ref(false);
const secondaryApiReady = ref(false);
const roomSideMeta = ref(null);
let playRaf = 0;
let unmuteGestureBound = false;
const ENTRY_UNMUTE_EVENTS = ["pointerdown", "keydown"];
/** 解除静音后短暂忽略画面点击，避免按钮消失时误触暂停 */
let videoShellActionLockUntil = 0;
const VIDEO_SHELL_ACTION_LOCK_MS = 480;
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

function cachedFollowRoom() {
  const rid = String(roomInput.value || props.id || "").trim();
  if (!rid) return null;
  const key = followKey(props.site, rid);
  return follows.value.find((r) => followKey(r.site, r.id) === key) || null;
}

const displayCategory = computed(() => {
  const fromApi = String(roomCategory.value || "").trim();
  const cached = cachedFollowRoom();
  const raw = fromApi || String(cached?.category || "").trim();
  return displayCategoryName(props.site, raw, cached?.cid);
});

const browseContext = computed(() => loadBrowseContext(props.site));
const playBackTo = computed(() => browseBackTarget(props.site));
const browseRoomCid = computed(() => {
  const ctx = browseContext.value;
  if (ctx?.type === "category" && ctx.cid != null && String(ctx.cid) !== "") {
    return String(ctx.cid);
  }
  return "";
});
const browseRoomPid = computed(() => {
  const ctx = browseContext.value;
  if (ctx?.type === "category" && ctx.pid != null && String(ctx.pid) !== "") {
    return String(ctx.pid);
  }
  return "";
});

const categoryHeaderStyle = computed(() =>
  getCategoryStyle(displayCategory.value, props.site, "", { opaque: true }) || {},
);

const roomState = ref("offline");
const roomCategory = ref("");
const roomStatsReady = ref(false);
const roomStats = ref({
  online: "",
  fans: "",
  diamondFans: "",
  fanGroup: "",
  guard: "",
  vip: "",
});

function statDisplay(value) {
  const text = String(value || "").trim();
  return text || "—";
}

const roomStatItems = computed(() => {
  if (props.site === "douyu") {
    return [
      { label: "观众", value: statDisplay(roomStats.value.online), tone: "audience" },
      { label: "钻粉", value: statDisplay(roomStats.value.diamondFans), tone: "diamond" },
      { label: "粉丝团", value: statDisplay(roomStats.value.fanGroup), tone: "fangroup" },
    ];
  }
  if (props.site === "huya") {
    return [
      { label: "观众", value: statDisplay(roomStats.value.online), tone: "audience" },
      { label: "守护", value: statDisplay(roomStats.value.guard), tone: "guard" },
      { label: "贵宾", value: statDisplay(roomStats.value.vip), tone: "vip" },
    ];
  }
  if (props.site === "douyin") {
    return [
      { label: "观众", value: statDisplay(roomStats.value.online), tone: "audience" },
      { label: "粉丝团", value: statDisplay(roomStats.value.fanGroup), tone: "fangroup" },
      { label: "贵宾", value: statDisplay(roomStats.value.vip), tone: "vip" },
    ];
  }
  if (props.site === "bilibili") {
    return [
      { label: "观众", value: statDisplay(roomStats.value.online), tone: "audience" },
      { label: "大航海", value: statDisplay(roomStats.value.guard), tone: "guard" },
    ];
  }
  return [{ label: "观众", value: statDisplay(roomStats.value.online), tone: "audience" }];
});

const showRoomStats = computed(() => {
  if (!headerReady.value || roomState.value === "offline") return false;
  if (
    props.site !== "douyu" &&
    props.site !== "huya" &&
    props.site !== "douyin" &&
    props.site !== "bilibili"
  ) {
    return false;
  }
  return roomStatsReady.value;
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

function resetRoomStats() {
  roomStatsReady.value = false;
  roomStats.value = {
    online: "",
    fans: "",
    diamondFans: "",
    fanGroup: "",
    guard: "",
    vip: "",
  };
}

function syncOnlineFromPayload() {
  const data = payload.value;
  if (!data) return;
  const declared = data.room_state;
  if (declared === "live" || declared === "replay" || declared === "offline") {
    roomState.value = declared;
    if (declared === "offline") resetRoomStats();
    return;
  }
  const live = Boolean(data.is_live || data.status);
  if (live) {
    roomState.value = "live";
  } else {
    roomState.value = "offline";
    resetRoomStats();
  }
}

function scheduleDeferredOnlineRefresh() {
  if (
    props.site !== "douyu"
    && props.site !== "huya"
    && props.site !== "douyin"
    && props.site !== "bilibili"
  ) {
    return;
  }
  clearTimeout(onlineRefreshTimer);
  roomStatsReady.value = true;
  onlineRefreshTimer = window.setTimeout(() => {
    void refreshRoomStats();
  }, 2000);
}

async function refreshRoomStats() {
  const rid = String(payload.value?.room_id || props.id || "").trim();
  if (!rid) {
    resetRoomStats();
    roomSideMeta.value = null;
    roomState.value = "offline";
    return;
  }
  try {
    const data = await fetchFollowStatus([{ site: props.site, id: rid }]);
    const snap = data.list?.[0];
    roomStats.value = {
      online: props.site === "douyin"
        ? formatDouyinOnline(snap?.online || "")
        : (snap?.online || ""),
      fans: snap?.fans || "",
      diamondFans: snap?.diamondFans || "",
      fanGroup: snap?.fanGroup || "",
      guard: snap?.guard || "",
      vip: snap?.vip || "",
    };
    roomState.value = snap?.state || "offline";
    roomCategory.value = String(snap?.category || "").trim();
    roomSideMeta.value = {
      fans: snap?.fans || "",
      liveStartAt: Number(snap?.liveStartAt) || 0,
      avatar: snap?.avatar || payload.value?.avatar || "",
      state: snap?.state || "offline",
    };
    if (roomState.value === "offline") resetRoomStats();
    else roomStatsReady.value = true;
  } catch {
    /* 保留上次 */
  }
}

watch(
  () => [props.site, props.id, payload.value?.room_id, payload.value?.is_live, payload.value?.status, payload.value?.room_state],
  () => {
    syncOnlineFromPayload();
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
  roomMeta: danmakuRoomMeta,
  overlaySettings,
  chatSettings,
  connect: connectDm,
  disconnect: disconnectDm,
  trimFromStart: trimDanmakuFromStart,
} = useDanmaku(siteRef, roomInput);
const { follows, isSuperFollowed, toggleSuperFollow, unfollow } = useFollow();

watch(
  () => danmakuRoomMeta.value.fanGroup,
  (fanGroup) => {
    if (props.site !== "douyin" || roomState.value !== "live") return;
    const text = String(fanGroup || "").trim();
    if (!text) return;
    roomStats.value.fanGroup = text;
    roomStatsReady.value = true;
  },
);

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
    await startPlayback({ freshUrl: true, forceUrl: true });
  } catch (err) {
    setStatus(`播放失败: ${err.message}`, "err");
  } finally {
    playRetrying = false;
  }
}

function syncPlayingStatus() {
  if (!streamActive.value || !playing.value || statusKind.value === "err") return;
  const brief = briefPlayStatus(statusText.value);
  if (!brief || !/^播放中/.test(brief)) return;
  setStatus(muted.value ? "播放中（静音）" : "播放中", "ok");
}

function onRefreshDanmaku() {
  disconnectDm();
  connectDm();
}

watch(muted, () => {
  syncPlayingStatus();
});

function buildPlayCallbacks(url, { onReadyExtra } = {}) {
  return {
    site: siteRef.value,
    roomId: String(roomInput.value || payload.value?.room_id || "").trim(),
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
          if (ok) {
            markSoundUnlocked();
            syncPlayingStatus();
          }
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
function lockVideoShellAction(ms = VIDEO_SHELL_ACTION_LOCK_MS) {
  videoShellActionLockUntil = Date.now() + ms;
}

function isVideoShellActionLocked() {
  return Date.now() < videoShellActionLockUntil;
}

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
    lockVideoShellAction();
    void unmutePlayback().then((ok) => {
      if (ok) {
        markSoundUnlocked();
        syncPlayingStatus();
      }
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
  syncPlayingStatus();
}

async function onMuteHintClick() {
  if (!streamActive.value || !muted.value) return;
  lockVideoShellAction();
  const ok = await unmutePlayback();
  if (ok) {
    markSoundUnlocked();
    userChoseMute.value = false;
    syncPlayingStatus();
  }
}

function onVolumeChange(value) {
  setVolume(value);
  if (Number(value) > 0 && !muted.value) markSoundUnlocked();
}

async function onVideoShellClick(event) {
  if (!streamActive.value || isVideoShellActionLocked()) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".player-controls, .mute-hint, .play-pause-overlay")) return;
  revealControls();
  if (muted.value) {
    lockVideoShellAction();
    const ok = await unmutePlayback();
    if (ok) {
      markSoundUnlocked();
      syncPlayingStatus();
    }
    return;
  }
  if (isMobilePlayViewport()) return;
  togglePlay();
}

function onPlaybackReady() {
  danmakuReady.value = true;
  runIdle(() => {
    revealSidePanel();
    connectDm();
    scheduleDeferredOnlineRefresh();
    secondaryApiReady.value = true;
  });
}

function revealSidePanel() {
  sideReady.value = true;
  refreshSidePanel();
}

function schedulePlay(room) {
  cancelAnimationFrame(playRaf);
  playRaf = requestAnimationFrame(() => {
    nextTick(() => playRoom(room));
  });
}

function syncRouteState(site, id, { keepSide = false } = {}) {
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
  roomCategory.value = "";
  resetRoomStats();
  roomState.value = "offline";
  document.title = "Lemon live";
  headerReady.value = true;
  controlsReady.value = true;
  if (!keepSide) sideReady.value = false;
  danmakuReady.value = false;
  secondaryApiReady.value = false;
  roomSideMeta.value = null;
}

function refreshSidePanel() {
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

function shouldAutoHideControls() {
  if (!playing.value) return false;
  const immersive = isFullscreen.value || webscreen.value;
  if (isMobilePlayViewport()) return immersive;
  return !immersive;
}

function scheduleHideControls() {
  clearTimeout(hideControlsTimer.value);
  if (!shouldAutoHideControls()) return;
  hideControlsTimer.value = setTimeout(() => {
    if (shouldAutoHideControls()) showControls.value = false;
  }, 3000);
}

function revealControls() {
  showControls.value = true;
  scheduleHideControls();
}

function enterImmersiveControls() {
  clearTimeout(hideControlsTimer.value);
  if (isMobilePlayViewport() && (isFullscreen.value || webscreen.value) && playing.value) {
    showControls.value = false;
    return;
  }
  revealControls();
}

function cachedFollowRoomForFollow() {
  const rid = String(roomInput.value || props.id || "").trim();
  if (!rid) return null;
  const key = followKey(props.site, rid);
  return follows.value.find((r) => followKey(r.site, r.id) === key) || null;
}

function roomInfoForFollow() {
  const cached = cachedFollowRoomForFollow();
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
    refreshSidePanel();
    return;
  }
  router.push({ name: "play", params: { site: room.site, id: room.id } });
}

async function onRefresh() {
  if (!payload.value || loading.value) return;
  captureSoundUnlock();
  destroy();
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
  const urlPromise = freshUrl
    ? prefetchPlayUrl({ force: forceUrl })
    : playUrl.value
      ? Promise.resolve(playUrl.value)
      : prefetchPlayUrl();
  setStatus("缓冲中…");
  const [url, videoEl] = await Promise.all([urlPromise, ensureVideoEl()]);
  const firstReady = !danmakuReady.value;
  await playFlv(videoEl, url, {
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
    if (ok) {
      markSoundUnlocked();
      syncPlayingStatus();
    } else bindEntryUnmuteGesture();
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
    revealSidePanel();
  }
}

function syncWebscreenChrome(on) {
  document.documentElement.classList.toggle("play-webscreen", on);
}

async function exitWebscreen() {
  webscreen.value = false;
  syncWebscreenChrome(false);
  if (getFullscreenElement()) {
    await document.exitFullscreen().catch(() => {});
    unlockLandscapeOrientation();
  }
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function requestElementFullscreen(el, options) {
  if (el.requestFullscreen) {
    try {
      await el.requestFullscreen(options);
    } catch {
      await el.requestFullscreen();
    }
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
  }
}

async function toggleWebscreen() {
  if (webscreen.value) {
    await exitWebscreen();
    revealControls();
    return;
  }

  const layout = layoutRef.value;
  if (!layout) return;

  if (getFullscreenElement() === frameRef.value) {
    await document.exitFullscreen().catch(() => {});
    unlockLandscapeOrientation();
  }

  webscreen.value = true;
  syncWebscreenChrome(true);
  try {
    await requestElementFullscreen(document.documentElement, { navigationUI: "hide" });
    if (isMobilePlayViewport()) {
      await lockLandscapeOrientation();
    }
  } catch {
    webscreen.value = false;
    syncWebscreenChrome(false);
  }
  enterImmersiveControls();
}

function isMobilePlayViewport() {
  return window.matchMedia(compactMediaQuery()).matches
    || window.matchMedia("(pointer: coarse)").matches;
}

function shouldUseLandscapeFallback() {
  return isMobilePlayViewport() && window.matchMedia("(orientation: portrait)").matches;
}

async function lockLandscapeOrientation() {
  if (!getFullscreenElement()) return false;

  const orientation = screen.orientation;
  if (orientation?.lock) {
    for (const mode of ["landscape", "landscape-primary", "landscape-secondary"]) {
      try {
        await orientation.lock(mode);
        fullscreenLandscapeFallback.value = false;
        return true;
      } catch {
        /* try next mode */
      }
    }
  }

  fullscreenLandscapeFallback.value = shouldUseLandscapeFallback();
  return false;
}

function unlockLandscapeOrientation() {
  fullscreenLandscapeFallback.value = false;
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

function onOrientationChange() {
  if (!getFullscreenElement()) return;
  if (window.matchMedia("(orientation: landscape)").matches) {
    fullscreenLandscapeFallback.value = false;
    return;
  }
  void lockLandscapeOrientation();
}

async function toggleFullscreen() {
  const frame = frameRef.value;
  if (!frame) return;

  if (getFullscreenElement()) {
    if (webscreen.value) {
      await exitWebscreen();
    } else {
      await document.exitFullscreen().catch(() => {});
      unlockLandscapeOrientation();
    }
    revealControls();
    return;
  }

  try {
    await requestElementFullscreen(frame);
    await lockLandscapeOrientation();
  } catch {
    /* ignore */
  }
  enterImmersiveControls();
}

function onFullscreenChange() {
  const fsEl = getFullscreenElement();
  const fs = !!fsEl;
  isFullscreen.value = fs;

  if (!fs) {
    unlockLandscapeOrientation();
    if (webscreen.value) {
      webscreen.value = false;
      syncWebscreenChrome(false);
    }
    revealControls();
    return;
  }

  enterImmersiveControls();

  if (fsEl === frameRef.value) {
    void lockLandscapeOrientation();
  }
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

let playRouteReady = false;

watch(
  () => [props.site, props.id],
  ([site, id]) => {
    const keepSide = playRouteReady && sideReady.value;
    syncRouteState(site, id, { keepSide });
    if (keepSide) refreshSidePanel();
    playRouteReady = true;
    if (!getPlatform(site)?.enabled) return;
    schedulePlay(id);
  },
);

watch(playing, (isPlaying) => {
  if (isPlaying) {
    scheduleHideControls();
  } else {
    clearTimeout(hideControlsTimer.value);
    showControls.value = true;
  }
});

let frameMouseMoveHandler = null;

onMounted(() => {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "reload") resetSoundSession();
  } catch {
    /* ignore */
  }
  syncRouteState(props.site, props.id);
  playRouteReady = true;
  if (getPlatform(props.site)?.enabled) {
    schedulePlay(props.id);
  }
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    frameMouseMoveHandler = revealControls;
    frameRef.value?.addEventListener("mousemove", frameMouseMoveHandler);
  }
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("orientationchange", onOrientationChange);
  if (screen.orientation) {
    screen.orientation.addEventListener("change", onOrientationChange);
  }
  document.addEventListener("enterpictureinpicture", onPiPChange);
  document.addEventListener("leavepictureinpicture", onPiPChange);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(playRaf);
  clearTimeout(onlineRefreshTimer);
  destroy();
  disconnectDm();
  clearTimeout(hideControlsTimer.value);
  unlockLandscapeOrientation();
  if (frameMouseMoveHandler) {
    frameRef.value?.removeEventListener("mousemove", frameMouseMoveHandler);
    frameMouseMoveHandler = null;
  }
  unbindEntryUnmuteGesture();
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("orientationchange", onOrientationChange);
  if (screen.orientation) {
    screen.orientation.removeEventListener("change", onOrientationChange);
  }
  document.removeEventListener("enterpictureinpicture", onPiPChange);
  document.removeEventListener("leavepictureinpicture", onPiPChange);
  syncWebscreenChrome(false);
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
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

@media (min-width: 1024px) {
  .play-layout {
    flex-direction: row;
  }
}

@media (max-width: 1024px) {
  .play-layout:has(.play-side--flow) {
    height: auto;
    min-height: 0;
    flex: 0 0 auto;
    overflow-x: hidden;
  }

  .play-layout:has(.play-side--flow) .play-main {
    flex: 0 0 auto;
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
  gap: .45rem;
  min-height: 2.5rem;
  padding: .35rem .5rem .45rem 2.75rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--chrome-border);
}

.play-header-category {
  flex-shrink: 0;
  max-width: 30%;
  padding: .26rem .52rem;
  border-radius: 5px;
  font-size: .9rem;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

@media (hover: hover) and (pointer: fine) {
  .play-back:hover {
    color: var(--amber);
  }
}

.play-header-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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
  max-width: 100%;
}

.play-stats-inline {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: .34rem;
  max-width: min(52vw, 24rem);
  font-size: .9rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: .01em;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .play-stats-inline .play-stat-item:not(.play-stat-item--audience) {
    display: none;
  }

  .play-stats-inline {
    max-width: none;
    flex-wrap: nowrap;
  }
}

.play-stat-item {
  white-space: nowrap;
  padding: .3rem .55rem;
  border-radius: 6px;
}

.play-stat-item--audience {
  color: var(--play-stat-audience-text);
  background: var(--play-stat-audience-bg);
}

.play-stat-item--diamond {
  color: var(--play-stat-diamond-text);
  background: var(--play-stat-diamond-bg);
}

.play-stat-item--fangroup {
  color: var(--play-stat-fangroup-text);
  background: var(--play-stat-fangroup-bg);
}

.play-stat-item--fans {
  color: var(--play-stat-fangroup-text);
  background: var(--play-stat-fangroup-bg);
}

.play-stat-item--guard {
  color: var(--play-stat-guard-text);
  background: var(--play-stat-guard-bg);
}

.play-stat-item--vip {
  color: var(--play-stat-vip-text);
  background: var(--play-stat-vip-bg);
}

.play-stats-inline--live .play-stat-item--audience {
  color: var(--play-stat-audience-text);
  background: var(--play-stat-audience-bg);
}

.play-stats-inline--live .play-stat-item--diamond {
  color: var(--play-stat-diamond-text);
  background: var(--play-stat-diamond-bg);
}

.play-stats-inline--live .play-stat-item--fangroup {
  color: var(--play-stat-fangroup-text);
  background: var(--play-stat-fangroup-bg);
}

.play-stats-inline--live .play-stat-item--fans {
  color: var(--play-stat-fangroup-text);
  background: var(--play-stat-fangroup-bg);
}

.play-stats-inline--live .play-stat-item--guard {
  color: var(--play-stat-guard-text);
  background: var(--play-stat-guard-bg);
}

.play-stats-inline--live .play-stat-item--vip {
  color: var(--play-stat-vip-text);
  background: var(--play-stat-vip-bg);
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

.play-layout--webscreen {
  flex-direction: row !important;
  height: 100% !important;
  min-height: 0 !important;
  max-width: none;
  overflow: hidden;
  background: var(--bg);
}

.play-layout:fullscreen,
.play-layout:-webkit-full-screen {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  flex-direction: row !important;
  overflow: hidden;
  background: var(--bg);
  box-sizing: border-box;
}

.play-layout:fullscreen .play-main,
.play-layout:-webkit-full-screen .play-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.play-layout:fullscreen .play-frame,
.play-layout:-webkit-full-screen .play-frame {
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 0;
}

.play-layout--webscreen .play-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.play-layout--webscreen .play-frame {
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 0;
}

.play-frame:fullscreen,
.play-frame:-webkit-full-screen {
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: 0;
  background: #000;
  overflow: visible;
}

.play-frame:fullscreen .video-shell,
.play-frame:-webkit-full-screen .video-shell {
  flex: 1;
  width: 100%;
  height: 100%;
  max-height: none;
  aspect-ratio: unset;
  overflow: visible;
}

.play-frame:fullscreen :deep(.player-controls--overlay),
.play-frame:-webkit-full-screen :deep(.player-controls--overlay) {
  z-index: 12;
}

.play-frame:fullscreen :deep(.player-controls--overlay .controls-bar),
.play-frame:-webkit-full-screen :deep(.player-controls--overlay .controls-bar) {
  overflow: visible;
}

.play-frame--landscape-fallback:fullscreen,
.play-frame--landscape-fallback:-webkit-full-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100dvh !important;
  height: 100vw !important;
  max-width: none;
  max-height: none;
  transform: rotate(90deg) translateY(-100vw);
  transform-origin: top left;
}

.play-frame:fullscreen :deep(.player-panel),
.play-frame:fullscreen :deep(.player-frame),
.play-frame:-webkit-full-screen :deep(.player-panel),
.play-frame:-webkit-full-screen :deep(.player-frame) {
  width: 100%;
  height: 100%;
}

.play-frame video:fullscreen,
.play-frame video:-webkit-full-screen {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
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
  background: var(--on-video-bg-hint);
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
  border: 1px solid var(--primary-border-strong);
  border-radius: 999px;
  background: var(--on-video-bg-hint);
  color: var(--on-video-text);
  font: inherit;
  font-size: .9rem;
  line-height: 1.2;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .35);
  transition: border-color .15s, background .15s, transform .15s;
}

@media (hover: hover) and (pointer: fine) {
  .mute-hint:hover {
    border-color: var(--amber);
    background: var(--on-video-bg-chip);
    transform: translate(-50%, -50%) scale(1.02);
  }
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
  background: var(--on-video-bg-hint);
  color: var(--on-video-text);
  cursor: pointer;
  box-shadow: 0 6px 24px rgba(0, 0, 0, .35);
  transition: background .15s, transform .15s;
}

@media (hover: hover) and (pointer: fine) {
  .play-pause-overlay:hover {
    background: var(--on-video-bg-chip);
    transform: translate(-50%, -50%) scale(1.04);
  }
}

.play-pause-overlay__icon {
  font-size: 2rem;
  color: var(--amber);
}

.play-layout--webscreen .play-main {
  width: auto;
  flex: 1;
}

@media (max-width: 640px) {
  .play-header {
    flex-wrap: wrap;
    align-items: center;
    gap: .22rem .35rem;
    min-height: 0;
    padding: .3rem .4rem .35rem 2.35rem;
  }

  .play-back {
    left: .35rem;
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1rem;
  }

  .play-header-category {
    flex: 0 0 auto;
    max-width: 32%;
    padding: .18rem .38rem;
    font-size: .72rem;
  }

  .play-header-main {
    flex: 1 1 0;
    min-width: 0;
    justify-content: flex-start;
  }

  .play-title {
    font-size: .88rem;
    text-align: left;
  }

  .play-stats-inline {
    flex: 1 1 100%;
    width: 100%;
    max-width: 100%;
    justify-content: flex-end;
    gap: .22rem;
    font-size: .72rem;
  }

  .play-stat-item {
    padding: .18rem .38rem;
  }

  .play-frame {
    border-radius: 0;
    overflow: visible;
  }

  .video-shell {
    aspect-ratio: 16 / 9;
    width: 100%;
    max-width: 100%;
    overflow: visible;
  }

  .mute-hint {
    padding: .72rem 1.05rem;
    font-size: 1rem;
    gap: .5rem;
  }

  .mute-hint__icon {
    font-size: 1.2rem;
  }
}
</style>
