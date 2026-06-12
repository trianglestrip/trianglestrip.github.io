<template>
  <div v-if="rooms.length" class="room-grid">
    <button
      v-for="room in rooms"
      :key="roomKey(room)"
      type="button"
      class="room-item"
      @click="$emit('select', room)"
    >
      <div class="room-item-info">
        <div class="room-cover-wrap">
          <LazyImage v-if="room.cover" :src="room.cover" image-class="room-cover" />
          <div v-else class="room-cover room-cover--empty">无封面</div>
          <span v-if="room.category" class="room-badge room-badge--cat">{{ room.category }}</span>
          <span v-if="room.online" class="room-badge room-badge--online">{{ room.online }}</span>
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
import LazyImage from "./LazyImage.vue";

defineProps({
  rooms: { type: Array, default: () => [] },
});

defineEmits(["select"]);

function roomKey(room) {
  return keyOf(room);
}
</script>

<style scoped>
.room-grid {
  display: grid;
  gap: 1rem;
  padding: .5rem;
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

.room-item {
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.room-item-info {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .25);
  transition: border-color .15s, transform .12s;
}

.room-item:hover .room-item-info {
  border-color: rgba(243, 208, 78, .55);
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

.room-badge {
  position: absolute;
  padding: .15rem .45rem;
  font-size: .72rem;
  line-height: 1.2;
  background: var(--dark-6);
}

.room-badge--online {
  right: 0;
  bottom: 0;
  border-top-left-radius: 8px;
  color: var(--live);
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
</style>
