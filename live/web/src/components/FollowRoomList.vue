<template>
  <div
    class="follow-room-list"
    :class="{
      'follow-room-list--grid': layout === 'grid',
      'follow-room-list--compact': compact,
    }"
  >
    <button
      v-for="room in rooms"
      :key="`${room.site}-${room.id}`"
      type="button"
      class="follow-item"
      :class="[
        followStateClass(room.state),
        {
          'follow-item--selected': isSelected(room),
          'follow-item--selectable': selectMode,
          'follow-item--super': room.super,
        },
      ]"
      @pointerenter="onItemHover(room)"
      @click="onItemClick(room)"
    >
      <span
        v-if="selectMode"
        class="follow-check"
        :class="{ 'follow-check--on': isSelected(room) }"
        aria-hidden="true"
      />
      <div
        class="follow-avatar-wrap"
        :class="avatarWrapClass(room)"
        :aria-label="selectMode ? undefined : followStateLabel(room.state)"
      >
        <LazyImage
          v-if="room.avatar"
          :src="room.avatar"
          image-class="follow-avatar"
          root-margin="120px"
        />
        <div v-else class="follow-avatar follow-avatar--empty">{{ room.anchor?.slice(0, 1) || "?" }}</div>
      </div>
      <div class="follow-main" :class="{ 'follow-main--compact': compact }">
        <div class="follow-body">
          <div class="follow-title-row">
            <span
              class="follow-platform-tag"
              :class="`follow-platform-tag--${room.site}`"
              :title="platformLabel(room.site)"
            >{{ platformLabel(room.site) }}</span>
            <p class="follow-title">{{ displayRoomTitle(room) }}</p>
          </div>
          <div v-if="compact" class="follow-anchor-row follow-anchor-row--compact">
            <span
              v-if="room.category"
              class="follow-category-tag"
              :style="categoryStyle(room.category)"
              :title="room.category"
            >{{ room.category }}</span>
            <span class="follow-anchor">{{ room.anchor || room.id }}</span>
            <span
              v-if="showOnlineStat(room)"
              class="follow-online-inline"
              :class="{ 'follow-online-inline--live': room.state === 'live' }"
              :title="`观看 ${room.online}`"
            >
              <Icon
                name="users"
                class="follow-online-fa"
                :class="{ 'fa-bounce': room.state === 'live' }"
              />
              <span>{{ room.online }}</span>
            </span>
          </div>
          <div v-else class="follow-anchor-row">
            <span
              v-if="room.category"
              class="follow-category-tag"
              :style="categoryStyle(room.category)"
              :title="room.category"
            >{{ room.category }}</span>
            <span class="follow-anchor">{{ room.anchor || room.id }}</span>
            <span
              v-if="showOnlineStat(room)"
              class="follow-online-inline"
              :class="{ 'follow-online-inline--live': room.state === 'live' }"
              :title="`观看 ${room.online}`"
            >
              <Icon
                name="users"
                class="follow-online-fa"
                :class="{ 'fa-bounce': room.state === 'live' }"
              />
              <span>{{ room.online }}</span>
            </span>
          </div>
          <p v-if="layout !== 'grid' && !compact" class="follow-meta">
            {{ room.id }}
          </p>
        </div>
      </div>
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
import { followKey } from "../utils/prefStore.js";
import { prefetchRoom } from "../utils/roomPrefetch.js";
import { followStateClass, FOLLOW_STATE_LABEL } from "../utils/followDisplay.js";
import { getCategoryStyle } from "../utils/categoryColor.js";

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showDelete: { type: Boolean, default: true },
  layout: { type: String, default: "list" },
  compact: { type: Boolean, default: false },
  selectMode: { type: Boolean, default: false },
  selectedKeys: { type: Array, default: () => [] },
  emptyText: { type: String, default: "暂无关注，可使用侧栏批量加入" },
});

const emit = defineEmits(["select", "unfollow", "toggle-select"]);

function platformLabel(site) {
  return getPlatform(site)?.label || site;
}

function followStateLabel(state) {
  return FOLLOW_STATE_LABEL[state] || FOLLOW_STATE_LABEL.offline;
}

function avatarWrapClass(room) {
  if (props.selectMode) return null;
  const classes = [];
  if (room.state === "live") classes.push("follow-avatar-wrap--live");
  else if (room.state === "replay") classes.push("follow-avatar-wrap--replay");
  return classes.length ? classes : null;
}

function categoryStyle(category) {
  return getCategoryStyle(category) || {};
}

/** 离线或无观看数据时不占位 */
function displayRoomTitle(room) {
  const title = String(room.title || "").trim();
  if (title) return title;
  const anchor = String(room.anchor || "").trim();
  if (anchor) return anchor;
  return `房间 ${room.id}`;
}

function showOnlineStat(room) {
  if (room.state === "offline") return false;
  const online = String(room.online || "").trim();
  return Boolean(online && online !== "—" && online !== "-");
}

function isSelected(room) {
  const key = followKey(room.site, room.id);
  return props.selectedKeys.includes(key);
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
</script>

<style scoped>
.follow-room-list {
  min-height: 0;
}

.follow-room-list--grid {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  padding: .55rem .65rem .65rem;
  align-content: flex-start;
}

.follow-item {
  display: flex;
  gap: .45rem;
  width: 100%;
  padding: .42rem .45rem;
  border: none;
  border-bottom: 1px solid var(--gray-7);
  color: inherit;
  text-align: left;
  cursor: pointer;
  align-items: flex-start;
  transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease;
  position: relative;
}

.follow-room-list--grid .follow-item {
  width: 15rem;
  border: 1px solid var(--gray-7);
  border-radius: 10px;
  border-bottom: 1px solid var(--gray-7);
  padding: .45rem .42rem;
}

.follow-room-list--compact .follow-item {
  padding: .18rem .32rem;
  gap: .28rem;
  align-items: flex-start;
}

.follow-room-list--compact .follow-body {
  flex: 1 1 auto;
  min-height: 0;
}

.follow-item--selectable {
  cursor: pointer;
}

.follow-item--selected {
  border-color: var(--amber) !important;
  box-shadow: 0 0 0 1px rgba(243, 208, 78, .35);
}

.follow-avatar-wrap {
  position: relative;
  flex-shrink: 0;
  line-height: 0;
  align-self: flex-start;
}

.follow-avatar-wrap--live::after,
.follow-avatar-wrap--replay::after {
  content: "";
  position: absolute;
  inset: -2px;
  z-index: 2;
  border-radius: 5px;
  pointer-events: none;
  box-sizing: border-box;
}

.follow-avatar-wrap--live::after {
  border: 2.5px solid rgba(229, 57, 53, .92);
  animation: follow-avatar-live-ring 2.2s ease-in-out infinite;
}

.follow-avatar-wrap--replay::after {
  border: 2px solid rgba(243, 208, 78, .72);
}

.follow-room-list--grid .follow-avatar-wrap--live::after,
.follow-room-list--grid .follow-avatar-wrap--replay::after {
  border-radius: 6px;
}

.follow-room-list--compact .follow-avatar-wrap--live::after,
.follow-room-list--compact .follow-avatar-wrap--replay::after {
  border-radius: 4px;
}

@keyframes follow-avatar-live-ring {
  0%, 100% {
    border-color: rgba(229, 57, 53, .72);
    box-shadow: 0 0 0 0 rgba(229, 57, 53, 0);
  }
  50% {
    border-color: rgba(229, 57, 53, 1);
    box-shadow: 0 0 0 2px rgba(229, 57, 53, .32), 0 0 10px rgba(229, 57, 53, .28);
  }
}

.follow-platform-tag {
  flex-shrink: 0;
  font-size: .52rem;
  font-weight: 700;
  line-height: 1;
  padding: .16rem .28rem;
  border-radius: 3px;
  letter-spacing: .02em;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.08);
}

.follow-platform-tag--douyu {
  color: #ff8a2a;
  background: rgba(255, 138, 42, 0.18);
}

.follow-platform-tag--huya {
  color: #ffb800;
  background: rgba(255, 184, 0, 0.18);
}

.follow-platform-tag--douyin {
  color: #fe2c55;
  background: rgba(254, 44, 85, 0.18);
}

.follow-check {
  position: absolute;
  top: .3rem;
  right: .3rem;
  width: .95rem;
  height: .95rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: rgba(0, 0, 0, .35);
  z-index: 3;
}

.follow-check--on {
  border-color: var(--amber);
  background: var(--amber);
  box-shadow: inset 0 0 0 2px #1a1a1a;
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
  color: #777;
}

.follow-item--offline .follow-title,
.follow-item--offline .follow-anchor,
.follow-item--offline .follow-meta {
  color: #777;
}

.follow-item--offline .follow-platform-tag,
.follow-item--offline .follow-platform-tag--douyu,
.follow-item--offline .follow-platform-tag--huya,
.follow-item--offline .follow-platform-tag--douyin {
  color: #666;
  background: rgba(255, 255, 255, 0.06);
}

.follow-item--offline .follow-category-tag {
  filter: grayscale(1) brightness(0.88);
  opacity: 0.75;
}

.follow-item--offline .follow-avatar,
.follow-item--offline :deep(.follow-avatar) {
  filter: grayscale(1) brightness(0.78);
  opacity: 0.72;
}

.follow-item--offline .follow-avatar--empty {
  color: #666;
  border-color: rgba(255, 255, 255, 0.12);
}

.follow-item--offline .follow-online-inline {
  color: #666;
  background: rgba(255, 255, 255, 0.06);
}

.follow-item--offline .follow-online-fa {
  opacity: 0.48;
}

.follow-item--super {
  background: rgba(120, 62, 150, 0.34);
}

.follow-item--super.follow-item--live {
  background: rgba(120, 62, 150, 0.38);
}

.follow-item--super.follow-item--replay {
  background: rgba(120, 62, 150, 0.34);
}

.follow-item--super.follow-item--offline {
  background: rgba(95, 48, 118, 0.32);
}

.follow-item--super.follow-item--selected {
  box-shadow: 0 0 0 1px rgba(243, 208, 78, .35);
}

.follow-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  display: block;
  background: #1a1a1a;
}

.follow-room-list--grid .follow-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 5px;
}

/* 约两行文字高：标题 + 主播行 */
.follow-room-list--compact .follow-avatar {
  width: 1.72rem;
  height: 1.72rem;
  border-radius: 3px;
}

.follow-avatar--empty {
  display: grid;
  place-items: center;
  font-size: .72rem;
  color: var(--muted);
  border: 1px dashed var(--border);
}

.follow-room-list--compact .follow-avatar--empty {
  font-size: .64rem;
}

.follow-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: .18rem;
  overflow: visible;
}

.follow-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: .35rem;
}

.follow-main--compact {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  flex: 1;
  min-width: 0;
}

.follow-room-list--grid .follow-body,
.follow-room-list--compact .follow-body {
  gap: .2rem;
}

.follow-title-row {
  display: flex;
  align-items: center;
  gap: .22rem;
  min-width: 0;
  flex-shrink: 0;
}

.follow-title-row .follow-platform-tag {
  flex-shrink: 0;
}

.follow-title-row .follow-title {
  flex: 1;
  min-width: 0;
}

.follow-category-tag {
  flex-shrink: 1;
  min-width: 0;
  font-size: .65rem;
  font-weight: 700;
  line-height: 1.15;
  padding: .08rem .18rem;
  border-radius: 3px;
  letter-spacing: .02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 4.2rem;
}

.follow-room-list--compact .follow-category-tag {
  font-size: .58rem;
  padding: .06rem .16rem;
}

.follow-title {
  margin: 0;
  font-size: .75rem;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-room-list--grid .follow-title,
.follow-room-list--compact .follow-title {
  white-space: nowrap;
  display: block;
  -webkit-line-clamp: unset;
  -webkit-box-orient: unset;
}

.follow-anchor-row {
  display: flex;
  align-items: center;
  gap: .28rem;
  margin-top: 0;
  min-width: 0;
  font-size: .8rem;
  line-height: 1.2;
  overflow: visible;
}

.follow-anchor-row--compact {
  gap: .22rem;
}

.follow-room-list--compact .follow-anchor-row--compact {
  overflow-x: hidden;
  overflow-y: visible;
  font-size: .72rem;
}

.follow-anchor {
  margin: 0;
  font-size: inherit;
  font-weight: 600;
  line-height: 1.2;
  color: var(--live);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 0 1 auto;
  min-width: 0;
}

.follow-online-inline {
  display: inline-flex;
  align-items: center;
  gap: .1rem;
  flex-shrink: 0;
  font-size: .65rem;
  font-weight: 700;
  line-height: 1.15;
  padding: .08rem .18rem;
  border-radius: 3px;
  letter-spacing: .02em;
  font-variant-numeric: tabular-nums;
}

.follow-online-inline > span {
  line-height: 1.15;
}

.follow-online-inline {
  color: #7eb0e8;
  background: rgba(110, 181, 255, 0.18);
}

.follow-online-inline--live {
  color: #8ec0ff;
  background: rgba(110, 181, 255, 0.24);
}

.follow-room-list--compact .follow-online-inline {
  font-size: .58rem;
  padding: .06rem .16rem;
}

.follow-online-fa {
  font-size: .85em;
  line-height: 1;
  flex-shrink: 0;
  opacity: .9;
  --fa-bounce-height: 2px;
  --fa-animation-duration: 1.6s;
}

.follow-meta {
  margin: .12rem 0 0;
  font-size: .68rem;
  color: var(--muted);
}

.delete-btn {
  color: var(--danger);
  font-size: 1.1rem;
  opacity: .5;
  padding: .25rem;
  cursor: pointer;
  flex-shrink: 0;
  align-self: center;
}

.delete-btn:hover {
  opacity: 1;
}

.follow-room-list--grid .empty-tip,
.follow-room-list--grid .follow-loading {
  width: 100%;
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
