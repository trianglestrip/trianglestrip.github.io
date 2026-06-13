<template>
  <div
    v-if="rooms.length"
    class="follow-preview-grid"
    :class="{ 'follow-preview-grid--compact': compact }"
  >
    <button
      v-for="room in rooms"
      :key="`${room.site}-${room.id}`"
      type="button"
      class="follow-preview-item"
      :class="{
        'follow-preview-item--live': room.state === 'live',
        'follow-preview-item--replay': room.state === 'replay',
        'follow-preview-item--offline': room.state === 'offline',
        'follow-preview-item--super': room.super,
        'follow-preview-item--selectable': selectMode,
        'follow-preview-item--selected': isSelected(room),
      }"
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
        <span
          v-if="selectMode"
          class="follow-preview-check"
          :class="{ 'follow-preview-check--on': isSelected(room) }"
          aria-hidden="true"
        />
        <div v-if="room.state === 'offline'" class="follow-preview-offline">未开播</div>
      </div>
      <p class="follow-preview-anchor">{{ room.anchor || room.id }}</p>
    </button>
  </div>
</template>

<script setup>
import LazyImage from "./LazyImage.vue";
import { followKey } from "../utils/prefStore.js";

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  selectMode: { type: Boolean, default: false },
  selectedKeys: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(["select", "toggle-select"]);

function previewSrc(room) {
  return room.cover || room.avatar || "";
}

function isSelected(room) {
  return props.selectedKeys.includes(followKey(room.site, room.id));
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
  border-color: rgba(229, 57, 53, 0.85);
  animation: follow-preview-live-pulse 2s ease-in-out infinite;
}

.follow-preview-item--replay .follow-preview-cover-wrap {
  border-color: rgba(180, 130, 220, 0.75);
}

.follow-preview-item--offline .follow-preview-cover-wrap {
  filter: grayscale(0.55);
  opacity: 0.82;
}

.follow-preview-item--super {
  border-radius: 8px;
  background: rgba(120, 62, 150, 0.22);
  padding: .2rem;
}

.follow-preview-item--selected .follow-preview-cover-wrap {
  border-color: var(--amber);
  box-shadow: 0 0 0 1px rgba(243, 208, 78, 0.35);
}

.follow-preview-item:hover .follow-preview-cover-wrap {
  border-color: rgba(243, 208, 78, 0.55);
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
  left: .35rem;
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

.follow-preview-anchor {
  margin: .32rem .15rem 0;
  font-size: .82rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.follow-preview-item--offline .follow-preview-anchor {
  color: var(--muted);
}

@keyframes follow-preview-live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.35); }
  50% { box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.12); }
}
</style>
