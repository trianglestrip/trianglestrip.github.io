<template>
  <div v-if="rooms.length" class="room-grid">
    <button
      v-for="room in rooms"
      :key="roomKey(room)"
      type="button"
      class="room-item"
      :class="{
        'room-item--selectable': selectMode,
        'room-item--selected': isSelected(room),
        'room-item--live': room.liveState === 'live' && !hideLiveFrame && !room.super,
        'room-item--replay': room.liveState === 'replay' && !room.super,
        'room-item--super': room.super,
        'room-item--super-live': room.super && room.liveState === 'live' && !hideLiveFrame,
        'room-item--super-replay': room.super && room.liveState === 'replay',
      }"
      @pointerenter="onItemHover(room)"
      @click="onItemClick(room)"
    >
      <div class="room-item-info">
        <div class="room-cover-wrap">
          <LazyImage v-if="room.cover" :src="room.cover" image-class="room-cover" />
          <div v-else class="room-cover room-cover--empty">无封面</div>
          <PlatformCoverBadge
            v-if="roomSite(room) && room.liveState !== 'live' && room.liveState !== 'replay'"
            :site="roomSite(room)"
          />
          <CoverOnlineBadge :online="room.online" :live="room.status !== false && room.liveState !== 'offline'" />
          <span
            v-if="selectMode"
            class="room-check"
            :class="{ 'room-check--on': isSelected(room) }"
            aria-hidden="true"
          />
          <span v-if="room.liveState === 'live'" class="room-badge room-badge--live">LIVE</span>
          <span v-else-if="room.liveState === 'replay'" class="room-badge room-badge--replay">录播</span>
          <span v-if="categoryLabel(room)" class="room-badge room-badge--cat">{{ categoryLabel(room) }}</span>
          <div v-if="room.status === false" class="room-offline">未开播</div>
        </div>
        <p class="room-title">{{ room.title || room.nickname }}</p>
        <div class="room-meta">
          <span class="room-anchor">{{ room.nickname }}</span>
        </div>
      </div>
    </button>
  </div>
</template>

<script setup>
import { roomKey as keyOf } from "../api/browse.js";
import { followKey } from "../utils/prefStore.js";
import { prefetchRoom } from "../utils/roomPrefetch.js";
import { displayCategoryName } from "../utils/categoryDisplay.js";
import LazyImage from "./LazyImage.vue";
import PlatformCoverBadge from "./PlatformCoverBadge.vue";
import CoverOnlineBadge from "./CoverOnlineBadge.vue";

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  site: { type: String, default: "" },
  selectMode: { type: Boolean, default: false },
  selectedKeys: { type: Array, default: () => [] },
  hideLiveFrame: { type: Boolean, default: false },
});

const emit = defineEmits(["select", "toggle-select"]);

function roomKey(room) {
  return keyOf(room);
}

function roomSite(room) {
  return room.site || room.siteId || "";
}

function categoryLabel(room) {
  return displayCategoryName(roomSite(room) || props.site, room.category, room.cid);
}

function selectionKey(room) {
  if (room.site && room.id) return followKey(room.site, room.id);
  return String(room.roomId ?? room.id ?? "");
}

function isSelected(room) {
  return props.selectedKeys.includes(selectionKey(room));
}

function onItemHover(room) {
  if (props.selectMode) return;
  const site = props.site || room.siteId || room.site;
  const id = room.site || room.siteId ? String(room.id ?? "") : roomKey(room);
  if (!site || !id) return;
  prefetchRoom(site, id);
}

function onItemClick(room) {
  if (props.selectMode) {
    emit("toggle-select", room);
    return;
  }
  emit("select", room);
}
</script>

<style scoped>
.room-grid {
  display: grid;
  gap: .85rem 1rem;
  padding: 0 .35rem .35rem;
  justify-content: space-evenly;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 768px) {
  .room-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .room-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .room-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (min-width: 1920px) {
  .room-grid {
    grid-template-columns: repeat(var(--room-grid-cols-wide, 6), minmax(0, 1fr));
  }
}

.room-item {
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.room-item--selectable .room-item-info {
  cursor: pointer;
}

.room-item--selected .room-item-info {
  border-color: var(--amber);
  box-shadow: 0 0 0 1px var(--primary-ring);
}

.room-item-info {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .25);
  transition: border-color .15s, box-shadow .15s ease, transform .12s;
}

.room-item--live .room-item-info {
  border-color: var(--danger-border);
  box-shadow:
    inset 0 0 28px 10px var(--danger-glow-38),
    inset 0 0 12px 3px var(--danger-glow-22),
    0 2px 8px rgba(0, 0, 0, 0.25);
  animation: room-cover-live-pulse 2.2s ease-in-out infinite;
}

.room-item--replay .room-item-info {
  border-color: var(--primary-border-solid);
  box-shadow:
    inset 0 0 28px 10px var(--primary-inset-36),
    inset 0 0 12px 3px var(--primary-inset-22),
    0 2px 8px rgba(0, 0, 0, 0.25);
}

.room-item--live:hover .room-item-info {
  border-color: color-mix(in srgb, var(--danger) 95%, transparent);
}

.room-item--replay:hover .room-item-info {
  border-color: var(--primary-border-hover);
}

.room-item--super .room-item-info {
  border-color: color-mix(in srgb, var(--follow-state-super-accent) 78%, #fff);
  box-shadow:
    inset 0 0 24px 8px color-mix(in srgb, var(--follow-state-super-accent) 18%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.25);
}

.room-item--super-live .room-item-info {
  border-color: var(--follow-state-super-accent);
  box-shadow:
    inset 0 0 28px 10px color-mix(in srgb, var(--follow-state-super-accent) 28%, transparent),
    inset 0 0 12px 3px color-mix(in srgb, var(--follow-state-super-accent) 16%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.25);
  animation: room-cover-super-live-pulse 2.2s ease-in-out infinite;
}

.room-item--super-replay .room-item-info {
  border-color: color-mix(in srgb, var(--follow-state-super-accent) 72%, var(--primary-border-solid));
  box-shadow:
    inset 0 0 28px 10px color-mix(in srgb, var(--follow-state-super-accent) 22%, transparent),
    inset 0 0 12px 3px color-mix(in srgb, var(--follow-state-super-accent) 12%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.25);
}

.room-item--super:hover .room-item-info,
.room-item--super-live:hover .room-item-info,
.room-item--super-replay:hover .room-item-info {
  border-color: color-mix(in srgb, var(--follow-state-super-accent) 92%, #fff);
}

.room-item:hover .room-item-info {
  border-color: var(--primary-border-mid);
}

.room-cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 10px 10px 0 0;
  overflow: hidden;
}

.room-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.room-cover--empty {
  display: grid;
  place-items: center;
  font-size: .75rem;
  color: var(--muted);
}

.room-check {
  position: absolute;
  top: .35rem;
  right: .35rem;
  left: auto;
  z-index: 3;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 3px;
  border: 2px solid rgba(255, 255, 255, .75);
  background: rgba(0, 0, 0, .45);
}

.room-check--on {
  background: var(--amber);
  border-color: var(--amber);
  box-shadow: inset 0 0 0 2px var(--primary-on);
}

.room-badge {
  position: absolute;
  padding: .15rem .45rem;
  font-size: .72rem;
  line-height: 1.2;
  background: var(--dark-6);
}

.room-badge--live {
  top: 0;
  left: 0;
  border-bottom-right-radius: 8px;
  color: #fff;
  background: var(--danger);
  font-weight: 700;
  letter-spacing: .04em;
}

.room-badge--replay {
  top: 0;
  left: 0;
  border-bottom-right-radius: 8px;
  color: var(--primary-on);
  background: var(--amber);
  font-weight: 600;
}

.room-badge--cat {
  top: 0;
  right: 0;
  border-bottom-left-radius: 8px;
  color: var(--text);
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-cover-wrap :deep(.cover-online-badge) {
  font-size: .78rem;
  padding: .3rem .52rem;
}

.room-offline {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, .72);
  color: #fff;
  font-size: 1rem;
}

.room-title {
  margin: 0;
  padding: .35rem .5rem 0;
  font-size: .88rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .25rem .5rem .45rem;
}

.room-anchor {
  font-size: .78rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes room-cover-live-pulse {
  0%, 100% {
    box-shadow:
      inset 0 0 24px 8px var(--danger-glow-34),
      inset 0 0 10px 2px var(--danger-glow-22),
      0 2px 8px rgba(0, 0, 0, 0.25);
  }
  50% {
    box-shadow:
      inset 0 0 34px 12px var(--danger-glow-46),
      inset 0 0 14px 4px color-mix(in srgb, var(--danger) 26%, transparent),
      0 2px 8px rgba(0, 0, 0, 0.25);
  }
}

@keyframes room-cover-super-live-pulse {
  0%, 100% {
    box-shadow:
      inset 0 0 24px 8px color-mix(in srgb, var(--follow-state-super-accent) 24%, transparent),
      inset 0 0 10px 2px color-mix(in srgb, var(--follow-state-super-accent) 14%, transparent),
      0 2px 8px rgba(0, 0, 0, 0.25);
  }
  50% {
    box-shadow:
      inset 0 0 34px 12px color-mix(in srgb, var(--follow-state-super-accent) 34%, transparent),
      inset 0 0 14px 4px color-mix(in srgb, var(--follow-state-super-accent) 20%, transparent),
      0 2px 8px rgba(0, 0, 0, 0.25);
  }
}
</style>
