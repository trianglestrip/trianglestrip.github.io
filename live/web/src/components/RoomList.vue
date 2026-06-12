<template>
  <section class="room-list scrolly" @scroll="onScroll">
    <header class="room-list-header">
      <h2 class="room-list-title">{{ title }}</h2>
      <span v-if="loading && rooms.length" class="room-list-meta">加载中…</span>
    </header>

    <p v-if="error" class="room-list-error">{{ error }}</p>
    <p v-else-if="loading && !rooms.length" class="room-list-empty">加载直播间…</p>
    <p v-else-if="!rooms.length" class="room-list-empty">暂无直播</p>

    <div v-else class="room-grid">
      <button
        v-for="room in rooms"
        :key="roomKey(room)"
        type="button"
        class="room-card"
        :class="{ active: roomKey(room) === activeRoom }"
        @click="$emit('select', room)"
      >
        <div class="room-cover-wrap">
          <img v-if="room.cover" :src="room.cover" class="room-cover" alt="">
          <div v-else class="room-cover room-cover--empty">无封面</div>
          <span v-if="room.online" class="room-online">{{ room.online }}</span>
        </div>
        <div class="room-info">
          <p class="room-title">{{ room.title || room.nickname }}</p>
          <p class="room-anchor">{{ room.nickname }}</p>
          <p v-if="room.category" class="room-category">{{ room.category }}</p>
        </div>
      </button>
    </div>

    <div v-if="hasMore" class="room-list-more">
      <button class="btn" type="button" :disabled="loading" @click="$emit('load-more')">
        {{ loading ? "加载中…" : "加载更多" }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { roomKey as keyOf } from "../api/browse.js";

defineProps({
  rooms: { type: Array, default: () => [] },
  title: { type: String, default: "推荐" },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  error: { type: String, default: "" },
  activeRoom: { type: String, default: "" },
});

const emit = defineEmits(["select", "load-more"]);

function roomKey(room) {
  return keyOf(room);
}

function onScroll(event) {
  const el = event.target;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
    emit("load-more");
  }
}
</script>

<style scoped>
.room-list {
  width: var(--roomlist-width);
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-elevated);
  padding: .65rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.room-list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .5rem;
  margin-bottom: .55rem;
  flex-shrink: 0;
}

.room-list-title {
  margin: 0;
  font-size: .95rem;
  font-weight: 600;
}

.room-list-meta {
  font-size: .75rem;
  color: var(--muted);
}

.room-list-error,
.room-list-empty {
  margin: .5rem 0;
  font-size: .84rem;
  color: var(--muted);
}

.room-list-error {
  color: var(--danger);
}

.room-grid {
  display: flex;
  flex-direction: column;
  gap: .55rem;
}

.room-card {
  display: flex;
  gap: .55rem;
  width: 100%;
  padding: .45rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .12s, background .12s;
}

.room-card:hover {
  border-color: rgba(243, 208, 78, .45);
}

.room-card.active {
  border-color: var(--lemon);
  background: rgba(243, 208, 78, .08);
}

.room-cover-wrap {
  position: relative;
  width: 96px;
  height: 54px;
  flex-shrink: 0;
}

.room-cover {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
  background: #000;
}

.room-cover--empty {
  display: grid;
  place-items: center;
  font-size: .65rem;
  color: var(--muted);
  border: 1px dashed var(--border);
}

.room-online {
  position: absolute;
  right: 4px;
  bottom: 4px;
  font-size: .65rem;
  padding: .05rem .3rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, .72);
  color: var(--live);
}

.room-info {
  min-width: 0;
  flex: 1;
}

.room-title {
  margin: 0 0 .2rem;
  font-size: .82rem;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.room-anchor {
  margin: 0;
  font-size: .75rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-category {
  margin: .15rem 0 0;
  font-size: .68rem;
  color: var(--lemon);
  opacity: .85;
}

.room-list-more {
  margin-top: .65rem;
  text-align: center;
  flex-shrink: 0;
}

.room-list-more .btn {
  width: 100%;
}

@media (max-width: 1200px) {
  .room-list {
    width: 260px;
  }
}

@media (max-width: 960px) {
  .room-list {
    width: 100%;
    max-height: 38vh;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
</style>
