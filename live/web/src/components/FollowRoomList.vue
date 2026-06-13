<template>
  <div class="follow-room-list">
    <button
      v-for="room in rooms"
      :key="`${room.site}-${room.id}`"
      type="button"
      class="follow-item"
      :class="followStateClass(room.state)"
      @click="$emit('select', room)"
    >
      <LazyImage
        v-if="room.avatar"
        :src="room.avatar"
        image-class="follow-avatar"
        root-margin="120px"
      />
      <div v-else class="follow-avatar follow-avatar--empty">{{ room.anchor?.slice(0, 1) || "?" }}</div>
      <div class="follow-info">
        <p class="follow-title">{{ room.title || `房间 ${room.id}` }}</p>
        <p class="follow-meta">{{ platformLabel(room.site) }} · {{ room.anchor || room.id }}</p>
      </div>
      <span class="follow-state">{{ followStateLabel(room.state) }}</span>
      <Icon
        v-if="showDelete"
        name="delete"
        class="delete-btn"
        title="取消关注"
        @click.stop="$emit('unfollow', room)"
      />
    </button>
    <div v-if="!rooms.length" class="empty-tip">{{ emptyText }}</div>
    <p v-else-if="loading" class="follow-loading">更新状态中…</p>
  </div>
</template>

<script setup>
import Icon from "./Icon.vue";
import LazyImage from "./LazyImage.vue";
import { getPlatform } from "../config/platforms";
import { FOLLOW_STATE_LABEL, followStateClass } from "../utils/followDisplay.js";

defineProps({
  rooms: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showDelete: { type: Boolean, default: true },
  emptyText: { type: String, default: "暂无关注，点击播放器控制条 ♥ 添加" },
});

defineEmits(["select", "unfollow"]);

function platformLabel(site) {
  return getPlatform(site)?.label || site;
}

function followStateLabel(state) {
  return FOLLOW_STATE_LABEL[state] || FOLLOW_STATE_LABEL.offline;
}
</script>

<style scoped>
.follow-room-list {
  min-height: 0;
}

.follow-item {
  display: flex;
  gap: .45rem;
  width: 100%;
  padding: .5rem;
  border: none;
  border-bottom: 1px solid var(--gray-7);
  color: inherit;
  text-align: left;
  cursor: pointer;
  align-items: center;
  transition: background-color .15s ease;
}

.follow-item:hover {
  filter: brightness(1.08);
}

.follow-item--live {
  background: rgba(46, 160, 67, 0.16);
}

.follow-item--replay {
  background: rgba(243, 208, 78, 0.14);
}

.follow-item--offline {
  background: rgba(255, 255, 255, 0.03);
}

.follow-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #1a1a1a;
}

.follow-avatar--empty {
  display: grid;
  place-items: center;
  font-size: .85rem;
  color: var(--muted);
  border: 1px dashed var(--border);
}

.follow-info {
  min-width: 0;
  flex: 1;
}

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

.follow-state {
  flex-shrink: 0;
  font-size: .68rem;
  padding: .12rem .38rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.22);
  color: var(--text);
}

.follow-item--live .follow-state {
  color: #7dffb0;
}

.follow-item--replay .follow-state {
  color: var(--amber);
}

.follow-item--offline .follow-state {
  color: var(--muted);
}

.delete-btn {
  color: var(--danger);
  font-size: 1.1rem;
  opacity: .5;
  padding: .25rem;
  cursor: pointer;
}

.delete-btn:hover {
  opacity: 1;
}

.empty-tip,
.follow-loading {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
  font-size: .85rem;
  line-height: 1.5;
}

.follow-loading {
  padding: .5rem 1rem 1rem;
  font-size: .75rem;
}
</style>
