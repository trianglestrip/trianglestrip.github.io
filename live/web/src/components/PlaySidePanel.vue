<template>
  <aside class="play-side scrolly">
    <section class="side-block">
      <h3 class="side-title">房间信息</h3>
      <div class="room-card">
        <img v-if="cover" :src="cover" class="room-cover" alt="">
        <div v-else class="room-cover room-cover--empty">无封面</div>
        <div class="room-detail">
          <p class="room-title">{{ title }}</p>
          <p class="room-anchor">{{ anchor || "—" }}</p>
          <span class="live-tag" :class="{ on: isLive }">{{ isLive ? "直播中" : "未开播" }}</span>
        </div>
      </div>
    </section>

    <section class="side-block">
      <h3 class="side-title">快捷跳转</h3>
      <div class="quick-row">
        <input v-model="roomInput" type="text" :placeholder="placeholder" @keydown.enter="$emit('play')">
        <button class="btn btn-primary" type="button" :disabled="loading" @click="$emit('play')">
          {{ loading ? "…" : "播放" }}
        </button>
      </div>
    </section>

    <section v-if="followRooms.length" class="side-block">
      <h3 class="side-title">推荐直播</h3>
      <button
        v-for="room in followRooms"
        :key="roomKey(room)"
        type="button"
        class="follow-item"
        @click="$emit('select-room', room)"
      >
        <img v-if="room.cover" :src="room.cover" class="follow-cover" alt="">
        <div class="follow-info">
          <p class="follow-title">{{ room.title || room.nickname }}</p>
          <p class="follow-meta">{{ room.nickname }} · {{ room.online || "—" }}</p>
        </div>
      </button>
    </section>

    <section class="side-block">
      <p class="status" :class="statusClass">{{ statusText }}</p>
    </section>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { roomKey as keyOf } from "../api/browse.js";

const props = defineProps({
  roomInput: { type: String, default: "" },
  placeholder: { type: String, default: "房间号" },
  loading: { type: Boolean, default: false },
  statusText: { type: String, default: "" },
  statusKind: { type: String, default: "info" },
  payload: { type: Object, default: null },
  followRooms: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:roomInput", "play", "select-room"]);

const roomInput = computed({
  get: () => props.roomInput,
  set: (value) => emit("update:roomInput", value),
});

const statusClass = computed(() => ({
  ok: props.statusKind === "ok",
  err: props.statusKind === "err",
}));

const title = computed(() => props.payload?.title || props.payload?.anchor_name || "等待播放");
const anchor = computed(() => props.payload?.anchor_name || "");
const cover = computed(() => props.payload?.cover || "");
const isLive = computed(() => !!(props.payload?.is_live || props.payload?.status));

function roomKey(room) {
  return keyOf(room);
}
</script>

<style scoped>
.play-side {
  flex-shrink: 0;
  width: var(--play-sidebar-width);
  border-left: 1px solid var(--gray-7);
  padding: .75rem .65rem;
  min-height: 0;
}

.side-block {
  margin-bottom: .85rem;
  padding-bottom: .85rem;
  border-bottom: 1px solid var(--gray-7);
}

.side-block:last-child {
  border-bottom: none;
}

.side-title {
  margin: 0 0 .5rem;
  font-size: .78rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .04em;
}

.room-card {
  display: flex;
  gap: .55rem;
}

.room-cover {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  background: #000;
  flex-shrink: 0;
}

.room-cover--empty {
  display: grid;
  place-items: center;
  font-size: .7rem;
  color: var(--muted);
  border: 1px dashed var(--border);
}

.room-detail { min-width: 0; flex: 1; }

.room-title {
  margin: 0 0 .25rem;
  font-size: .88rem;
  line-height: 1.35;
}

.room-anchor {
  margin: 0 0 .35rem;
  font-size: .8rem;
  color: var(--muted);
}

.live-tag {
  display: inline-block;
  font-size: .72rem;
  padding: .1rem .45rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  color: var(--muted);
}

.live-tag.on {
  border-color: rgba(61, 220, 132, .45);
  color: var(--live);
}

.quick-row {
  display: flex;
  gap: .4rem;
}

.quick-row input { flex: 1; min-width: 0; }

.follow-item {
  display: flex;
  gap: .45rem;
  width: 100%;
  padding: .4rem;
  margin-bottom: .35rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-soft);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.follow-item:hover {
  border-color: rgba(243, 208, 78, .45);
}

.follow-cover {
  width: 56px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.follow-info { min-width: 0; flex: 1; }

.follow-title {
  margin: 0;
  font-size: .8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-meta {
  margin: .15rem 0 0;
  font-size: .72rem;
  color: var(--muted);
}

.status {
  margin: 0;
  font-size: .82rem;
  line-height: 1.5;
  color: var(--muted);
}

.status.ok { color: var(--live); }
.status.err { color: var(--danger); }

@media (max-width: 1024px) {
  .play-side {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--gray-7);
    max-height: 40vh;
  }
}
</style>
