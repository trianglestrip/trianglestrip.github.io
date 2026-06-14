<template>
  <div
    v-if="rooms.length"
    class="follow-preview-grid"
    :class="{
      'follow-preview-grid--compact': compact && !drawer,
      'follow-preview-grid--drawer': drawer,
    }"
  >
    <button
      v-for="room in rooms"
      :key="`${room.site}-${room.id}`"
      type="button"
      class="follow-preview-item"
      :class="[
        drawer ? drawerItemClass(room) : {
          'follow-preview-item--live': room.state === 'live' && !hideLiveFrame,
          'follow-preview-item--replay': room.state === 'replay',
          'follow-preview-item--offline': room.state === 'offline',
          'follow-preview-item--super': room.super,
        },
        {
          'follow-preview-item--selectable': selectMode,
          'follow-preview-item--selected': isSelected(room),
        },
      ]"
      @pointerenter="onItemHover(room)"
      @click="onItemClick(room)"
    >
      <div class="follow-preview-cover-wrap">
        <LazyImage
          v-if="previewSrc(room)"
          :src="previewSrc(room)"
          image-class="follow-preview-cover"
          root-margin="160px"
        />
        <div v-else class="follow-preview-cover follow-preview-cover--empty">无画面</div>
        <PlatformCoverBadge v-if="room.site && !drawer" :site="room.site" />
        <CoverOnlineBadge
          v-if="!drawer"
          :online="room.online"
          :live="room.state !== 'offline'"
        />
        <span
          v-if="!drawer && categoryLabel(room)"
          class="follow-preview-cat"
          :title="categoryLabel(room)"
        >{{ categoryLabel(room) }}</span>
        <span
          v-if="selectMode"
          class="follow-preview-check"
          :class="{ 'follow-preview-check--on': isSelected(room) }"
          aria-hidden="true"
        />
        <div v-if="!drawer && room.state === 'offline'" class="follow-preview-offline">未开播</div>
      </div>
      <p class="follow-preview-anchor">
        <span class="follow-preview-anchor-name">{{ room.anchor || room.id }}</span>
        <span
          v-if="showStats && room.state === 'offline' && lastLiveLabel(room)"
          class="follow-preview-last-live"
        >{{ lastLiveLabel(room) }}</span>
      </p>
      <p v-if="showStats && showPreviewStats(room)" class="follow-preview-stats">
        <span
          v-if="showOnlineStat(room)"
          class="follow-preview-stat"
          :title="`观看 ${room.online}`"
        >
          <Icon name="users" class="follow-preview-stat-fa" />
          <span>{{ room.online }}</span>
        </span>
        <span
          v-if="liveStartLabel(room)"
          class="follow-preview-stat follow-preview-stat--live-start"
          :title="`开播 ${liveStartLabel(room)}`"
        >
          <Icon name="timer-outline" class="follow-preview-stat-fa" />
          <span>{{ liveStartLabel(room) }}</span>
        </span>
      </p>
    </button>
  </div>
</template>

<script setup>
import LazyImage from "./LazyImage.vue";
import Icon from "./Icon.vue";
import PlatformCoverBadge from "./PlatformCoverBadge.vue";
import CoverOnlineBadge from "./CoverOnlineBadge.vue";
import { followKey } from "../utils/prefStore.js";
import { prefetchRoom } from "../utils/roomPrefetch.js";
import { formatLastLiveAt } from "../utils/followDisplay.js";
import { displayCategoryName } from "../utils/categoryDisplay.js";

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  selectMode: { type: Boolean, default: false },
  selectedKeys: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
  showStats: { type: Boolean, default: true },
  hideLiveFrame: { type: Boolean, default: false },
  drawer: { type: Boolean, default: false },
});

const emit = defineEmits(["select", "toggle-select"]);

function previewSrc(room) {
  return room.cover || room.avatar || "";
}

function isSelected(room) {
  return props.selectedKeys.includes(followKey(room.site, room.id));
}

function onItemHover(room) {
  if (props.selectMode) return;
  if (!room.site || !room.id) return;
  prefetchRoom(room.site, room.id);
}

function onItemClick(room) {
  if (props.selectMode) {
    emit("toggle-select", room);
    return;
  }
  emit("select", room);
}

function drawerItemClass(room) {
  if (room.super) return { "follow-preview-item--drawer-super": true };
  const state = room.state || "offline";
  if (state === "live") return { "follow-preview-item--drawer-live": true };
  if (state === "replay") return { "follow-preview-item--drawer-replay": true };
  return { "follow-preview-item--drawer-offline": true };
}

function lastLiveLabel(room) {
  if (room.state !== "offline") return "";
  const text = formatLastLiveAt(room.lastLiveAt);
  return text ? `上次 ${text}` : "";
}

function showOnlineStat(room) {
  if (room.state === "offline") return false;
  const online = String(room.online || "").trim();
  return Boolean(online && online !== "—" && online !== "-");
}

function liveStartLabel(room) {
  if (room.state === "offline") return "";
  return formatLastLiveAt(room.liveStartAt);
}

function showPreviewStats(room) {
  return showOnlineStat(room) || liveStartLabel(room);
}

function categoryLabel(room) {
  return displayCategoryName(room.site, room.category, room.cid);
}
</script>

<style scoped>
.follow-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .65rem;
  padding: .5rem .65rem .75rem;
}

.follow-preview-grid--compact {
  gap: .4rem;
  padding: .35rem .45rem .55rem;
}

.follow-preview-grid--compact .follow-preview-cover-wrap {
  border-radius: 6px;
}

.follow-preview-grid--compact .follow-preview-anchor {
  margin-top: .24rem;
  font-size: .74rem;
}

.follow-preview-grid--compact :deep(.platform-cover-badge) {
  font-size: .66rem;
  padding: .22rem .4rem;
}

.follow-preview-grid--compact :deep(.cover-online-badge) {
  font-size: .66rem;
  padding: .22rem .4rem;
}

.follow-preview-item {
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.follow-preview-cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  border: 2px solid transparent;
  transition: border-color .15s ease, box-shadow .15s ease;
}

.follow-preview-item--live .follow-preview-cover-wrap {
  border-color: rgba(229, 57, 53, 0.88);
  box-shadow:
    inset 0 0 28px 10px rgba(229, 57, 53, 0.38),
    inset 0 0 12px 3px rgba(229, 57, 53, 0.22);
  animation: follow-preview-live-pulse 2.2s ease-in-out infinite;
}

.follow-preview-item--replay .follow-preview-cover-wrap {
  border-color: var(--primary-border-solid);
  box-shadow:
    inset 0 0 28px 10px var(--primary-inset-36),
    inset 0 0 12px 3px var(--primary-inset-22);
}

.follow-preview-item--offline .follow-preview-cover-wrap {
  filter: grayscale(0.55);
  opacity: 0.82;
}

.follow-preview-item--super {
  border-radius: 8px;
  background: var(--follow-preview-super-bg, var(--follow-state-super-bg, #3a2048));
  padding: .2rem;
}

.follow-preview-item--selected .follow-preview-cover-wrap {
  border-color: var(--amber);
  box-shadow: 0 0 0 1px var(--primary-ring);
}

.follow-preview-item:hover .follow-preview-cover-wrap {
  border-color: var(--primary-border-mid);
}

.follow-preview-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.follow-preview-cover--empty {
  display: grid;
  place-items: center;
  font-size: .72rem;
  color: var(--muted);
}

.follow-preview-check {
  position: absolute;
  top: .35rem;
  right: .35rem;
  left: auto;
  z-index: 2;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 3px;
  border: 2px solid rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.45);
}

.follow-preview-check--on {
  background: var(--amber);
  border-color: var(--amber);
  box-shadow: inset 0 0 0 2px #1a1a1a;
}

.follow-preview-offline {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: .78rem;
}

.follow-preview-cat {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  padding: .15rem .45rem;
  font-size: .72rem;
  line-height: 1.2;
  background: var(--dark-6);
  border-bottom-left-radius: 8px;
  color: var(--text);
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-preview-grid--compact .follow-preview-cat {
  font-size: .66rem;
  padding: .22rem .4rem;
  border-bottom-left-radius: 6px;
}

.follow-preview-item--offline .follow-preview-cat {
  opacity: 0.72;
}

.follow-preview-anchor {
  margin: .32rem .15rem 0;
  font-size: .82rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  display: flex;
  align-items: baseline;
  gap: .28rem;
}

.follow-preview-last-live {
  flex-shrink: 0;
  font-size: .68rem;
  color: var(--muted);
}

.follow-preview-stats {
  margin: .22rem .15rem 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .2rem;
  flex-wrap: wrap;
}

.follow-preview-stat {
  display: inline-flex;
  align-items: center;
  gap: .1rem;
  flex-shrink: 0;
  font-size: .65rem;
  font-weight: 600;
  line-height: 1.15;
  padding: .08rem .18rem;
  border-radius: 3px;
  color: var(--muted);
  background: var(--follow-meta-chip-bg, rgba(255, 255, 255, 0.06));
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.follow-preview-stat-fa {
  font-size: .72em;
  line-height: 1;
  opacity: 0.88;
}

.follow-preview-grid--compact .follow-preview-stats {
  margin-top: .18rem;
}

.follow-preview-stat--live-start {
  font-size: .74rem;
  gap: .12rem;
  padding: .08rem .2rem;
}

.follow-preview-stat--live-start .follow-preview-stat-fa {
  font-size: .9em;
  opacity: 0.92;
}

.follow-preview-grid--compact .follow-preview-stat--live-start {
  font-size: .68rem;
  padding: .06rem .18rem;
}

.follow-preview-item--offline .follow-preview-anchor {
  color: var(--muted);
}

.follow-preview-grid--drawer {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: .22rem .14rem;
  padding: 0;
  justify-items: stretch;
}

.follow-preview-grid--drawer .follow-preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: .22rem .12rem .26rem;
  border-radius: 6px;
  background: var(--sidebar-chip-bg);
  transition: background .12s, filter .12s;
}

.follow-preview-grid--drawer .follow-preview-item:hover {
  filter: brightness(1.04);
  color: var(--drawer-accent, var(--primary));
}

.follow-preview-grid--drawer .follow-preview-item--drawer-live {
  background: var(--sidebar-follow-live-bg);
  color: var(--follow-state-on-text);
}

.follow-preview-grid--drawer .follow-preview-item--drawer-replay {
  background: var(--sidebar-follow-replay-bg);
  color: var(--follow-state-on-text);
}

.follow-preview-grid--drawer .follow-preview-item--drawer-offline {
  background: var(--sidebar-follow-offline-bg);
  color: var(--follow-state-muted-text);
}

.follow-preview-grid--drawer .follow-preview-item--drawer-super {
  background: var(--sidebar-follow-super-bg);
  color: var(--follow-state-on-text);
}

.follow-preview-grid--drawer .follow-preview-cover-wrap {
  border: none;
  box-shadow: none;
  border-radius: 5px;
  animation: none;
}

.follow-preview-grid--drawer .follow-preview-item--live .follow-preview-cover-wrap,
.follow-preview-grid--drawer .follow-preview-item--replay .follow-preview-cover-wrap {
  border: none;
  box-shadow: none;
  animation: none;
}

.follow-preview-grid--drawer .follow-preview-item--drawer-offline .follow-preview-cover-wrap {
  filter: grayscale(0.55);
  opacity: 0.82;
}

.follow-preview-grid--drawer .follow-preview-item:hover .follow-preview-cover-wrap {
  border-color: transparent;
}

.follow-preview-grid--drawer .follow-preview-cover--empty {
  font-size: .58rem;
}

.follow-preview-grid--drawer .follow-preview-anchor {
  margin: .28rem 0 0;
  padding: 0;
  width: 100%;
  justify-content: center;
  text-align: center;
  font-size: .68rem;
  line-height: 1.25;
}

.follow-preview-grid--drawer .follow-preview-anchor-name {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-preview-grid--drawer .follow-preview-item--drawer-offline .follow-preview-anchor {
  color: var(--follow-state-muted-text);
}

@keyframes follow-preview-live-pulse {
  0%, 100% {
    box-shadow:
      inset 0 0 24px 8px rgba(229, 57, 53, 0.34),
      inset 0 0 10px 2px rgba(229, 57, 53, 0.18);
  }
  50% {
    box-shadow:
      inset 0 0 34px 12px rgba(229, 57, 53, 0.46),
      inset 0 0 14px 4px rgba(229, 57, 53, 0.26);
  }
}
</style>
