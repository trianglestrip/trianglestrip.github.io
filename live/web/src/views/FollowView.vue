<template>
  <AppLayout active-site="douyu">
    <div class="follow-page">
      <header class="follow-header">
        <h1>我的关注</h1>
      </header>

      <div v-if="!follows.length" class="empty-tip">暂无关注，在播放页点击 ♥ 添加</div>

      <div v-else class="follow-list scrolly">
        <button
          v-for="room in follows"
          :key="`${room.site}-${room.id}`"
          type="button"
          class="follow-item"
          @click="goPlay(room)"
        >
          <LazyImage v-if="room.cover" :src="room.cover" image-class="follow-cover" />
          <div v-else class="follow-cover follow-cover--empty"></div>
          <div class="follow-info">
            <p class="follow-title">{{ room.title || `房间 ${room.id}` }}</p>
            <p class="follow-meta">{{ platformLabel(room.site) }} · {{ room.anchor || room.id }}</p>
          </div>
          <Icon name="delete" class="delete-btn" title="取消关注" @click.stop="onUnfollow(room)" />
        </button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import Icon from "../components/Icon.vue";
import LazyImage from "../components/LazyImage.vue";
import { getPlatform } from "../config/platforms";
import { useFollow } from "../composables/useFollow.js";

const router = useRouter();
const { follows, unfollow } = useFollow();

function platformLabel(site) {
  return getPlatform(site)?.label || site;
}

function goPlay(room) {
  router.push({ name: "play", params: { site: room.site, id: room.id } });
}

function onUnfollow(room) {
  unfollow(room.site, room.id);
}
</script>

<style scoped>
.follow-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  max-width: 720px;
}

.follow-header {
  padding: .75rem 1rem .5rem;
}

.follow-header h1 {
  margin: 0;
  font-size: 1.15rem;
}

.follow-list {
  flex: 1;
  min-height: 0;
}

.follow-item {
  display: flex;
  gap: .55rem;
  width: 100%;
  padding: .65rem 1rem;
  border: none;
  border-bottom: 1px solid var(--gray-7);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  align-items: center;
}

.follow-item:hover {
  background: rgba(255, 255, 255, .03);
}

.follow-cover {
  width: 72px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  background: #000;
}

.follow-cover--empty {
  border: 1px dashed var(--border);
}

.follow-info {
  min-width: 0;
  flex: 1;
}

.follow-title {
  margin: 0;
  font-size: .9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-meta {
  margin: .2rem 0 0;
  font-size: .78rem;
  color: var(--muted);
}

.delete-btn {
  color: var(--danger);
  font-size: 1.15rem;
  opacity: .5;
  padding: .25rem;
  cursor: pointer;
}

.delete-btn:hover {
  opacity: 1;
}

.empty-tip {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
}
</style>
