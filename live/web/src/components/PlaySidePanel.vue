<template>
  <aside class="play-side">
    <div class="side-header">
      <div class="room-aside">
        <LazyImage v-if="displayAvatar" :src="displayAvatar" image-class="room-avatar" eager />
        <div v-else class="room-avatar room-avatar--empty">{{ anchor?.slice(0, 1) || "?" }}</div>
        <div class="room-aside-meta">
          <p class="room-anchor">{{ anchor || "—" }}</p>
          <p v-if="showFansStatForRoom" class="room-fans" :title="fansTitle">
            <Icon name="user" class="room-stat-icon" />
            <span>{{ fansText }}</span>
          </p>
        </div>
        <button
          type="button"
          class="super-follow-btn"
          :class="{ 'super-follow-btn--active': isSuperFollowed }"
          :title="isSuperFollowed ? '取消超级关注' : '超级关注'"
          @click="$emit('toggle-super-follow')"
        >
          <Icon name="star" class="super-follow-btn__icon" :filled="isSuperFollowed" />
          <span class="super-follow-btn__text">{{ isSuperFollowed ? "已超关" : "超关" }}</span>
        </button>
      </div>
    </div>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'chat' }" @click="tab = 'chat'">聊天</button>
      <button type="button" :class="{ active: tab === 'follow' }" @click="tab = 'follow'">关注</button>
      <button type="button" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">设置</button>
    </div>

    <div v-show="tab === 'chat'" class="tab-content">
      <div ref="chatListRef" class="chat-list scrolly">
        <div class="chat-list__content">
          <div v-if="chatPlayStatus" class="chat-item sys">系统：{{ chatPlayStatus }}</div>
          <div v-if="chatDanmakuLine" class="chat-item sys">系统：{{ chatDanmakuLine }}</div>
          <div
            v-for="m in chatDanmakuMessages"
            :key="m.id"
            class="chat-item"
            :style="chatItemStyle"
          >
            <span class="chat-user">{{ m.user }}：</span>
            <span class="chat-text">{{ m.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-show="tab === 'follow'" class="tab-content scrolly follow-tab">
      <div class="follow-tab-toolbar">
        <FollowPlatformFilter v-model="followSiteFilter" />
        <div class="follow-tab-toolbar__actions">
          <button
            type="button"
            class="follow-toolbar-btn follow-list-mode-btn"
            :class="{ 'follow-list-mode-btn--active': !previewCover }"
            title="列表视图"
            @click="togglePreviewCover"
          >
            <Icon name="list" />
          </button>
        </div>
      </div>
      <FollowPreviewGrid
        v-if="previewCover"
        compact
        :rooms="filteredFollows"
        @select="$emit('play-room', $event)"
      />
      <FollowRoomList
        v-else
        :rooms="filteredFollows"
        :loading="followStatusLoading"
        :show-delete="false"
        compact
        @select="$emit('play-room', $event)"
      />
    </div>

    <div v-show="tab === 'settings'" class="tab-content settings-tab scrolly">
      <div class="settings-groups">
        <section class="settings-group">
          <h4 class="settings-group__title">聊天弹幕</h4>
          <label class="setting-row setting-row--toggle">
            <span class="setting-label">聊天</span>
            <input v-model="chatSettings.show" type="checkbox" class="setting-check">
          </label>
          <label class="setting-row">
            <span class="setting-label">透明度</span>
            <input v-model.number="chatSettings.opacity" class="setting-range" type="range" min="10" max="100">
            <span class="setting-value">{{ chatSettings.opacity }}%</span>
          </label>
          <label class="setting-row">
            <span class="setting-label">字号</span>
            <input v-model.number="chatSettings.fontSize" class="setting-range" type="range" min="12" max="24">
            <span class="setting-value">{{ chatSettings.fontSize }}</span>
          </label>
          <label class="setting-row">
            <span class="setting-label">间距</span>
            <input v-model.number="chatSettings.gap" class="setting-range" type="range" min="0" max="16">
            <span class="setting-value">{{ chatSettings.gap }}</span>
          </label>
        </section>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch, nextTick, toRef, onMounted } from "vue";
import Icon from "./Icon.vue";
import LazyImage from "./LazyImage.vue";
import FollowRoomList from "./FollowRoomList.vue";
import FollowPreviewGrid from "./FollowPreviewGrid.vue";
import FollowPlatformFilter from "./FollowPlatformFilter.vue";
import { fetchFollowStatus } from "../api/follow.js";
import { useFollowStatus } from "../composables/useFollowStatus.js";
import { loadGlobalPref, saveGlobalPref } from "../utils/prefStore.js";
import { briefDanmakuStatus, briefPlayStatus } from "../utils/chatStatus.js";

const props = defineProps({
  site: { type: String, default: "" },
  roomId: { type: String, default: "" },
  statusText: { type: String, default: "" },
  payload: { type: Object, default: null },
  danmakuMessages: { type: Array, default: () => [] },
  danmakuStatus: { type: String, default: "" },
  followList: { type: Array, default: () => [] },
  isSuperFollowed: { type: Boolean, default: false },
});

const chatSettings = defineModel("chatSettings", { type: Object, required: true });

defineEmits(["play-room", "unfollow", "toggle-super-follow"]);

const tab = ref("chat");
const followSiteFilter = ref("");
const followUiPref = loadGlobalPref("play_follow_ui", { previewCover: true });
const previewCover = ref(followUiPref.previewCover !== false);
const chatListRef = ref(null);
const { sortedFollows, loading: followStatusLoading, refresh: refreshFollowStatus } = useFollowStatus(
  toRef(props, "followList"),
  {
    getFocusCategory(merged) {
      const room = merged.find(
        (item) => item.site === props.site && String(item.id) === String(props.roomId),
      );
      return room?.category || "";
    },
  },
);

const filteredFollows = computed(() => {
  const site = followSiteFilter.value;
  if (!site) return sortedFollows.value;
  return sortedFollows.value.filter((room) => room.site === site);
});

const chatPlayStatus = computed(() => briefPlayStatus(props.statusText));
const chatDanmakuLine = computed(() => briefDanmakuStatus(props.danmakuStatus));

function togglePreviewCover() {
  previewCover.value = !previewCover.value;
  saveGlobalPref("play_follow_ui", { previewCover: previewCover.value });
}

watch(tab, (value) => {
  if (value === "follow") refreshFollowStatus();
});

const anchor = computed(() => props.payload?.anchor_name || "");
const cover = computed(() => props.payload?.cover || "");

const roomFans = ref("");
const roomAvatar = ref("");

const fansText = computed(() => roomFans.value || "—");
const showFansStatForRoom = computed(() => {
  if (roomFans.value) return true;
  const site = String(props.site || props.payload?.platform || "").trim();
  return site !== "douyu";
});
const fansTitle = computed(() => {
  if (roomFans.value) return `粉丝 ${roomFans.value}`;
  if (props.site === "douyu") return "斗鱼未提供公开粉丝数";
  return "粉丝 —";
});
const displayAvatar = computed(() => roomAvatar.value || cover.value || "");

async function refreshRoomMeta() {
  const site = String(
    props.payload?.platform || props.payload?.site || props.site || "",
  ).trim();
  const id = String(props.payload?.room_id || props.roomId || "").trim();
  if (!site || !id) {
    roomFans.value = "";
    roomAvatar.value = "";
    return;
  }
  try {
    const data = await fetchFollowStatus([{ site, id }]);
    const snap = data.list?.[0];
    if (!snap) return;
    roomFans.value = snap.fans || "";
    roomAvatar.value = snap.avatar || "";
  } catch {
    /* 保留上次 */
  }
}

function refreshSide() {
  refreshRoomMeta();
  refreshFollowStatus();
}

defineExpose({ refreshSide });

watch(
  () => [props.site, props.roomId, props.payload?.platform, props.payload?.site, props.payload?.room_id],
  () => refreshRoomMeta(),
  { immediate: true },
);

function scrollChatToBottom() {
  if (tab.value !== "chat" || !chatListRef.value) return;
  nextTick(() => {
    requestAnimationFrame(() => {
      const el = chatListRef.value;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  });
}

onMounted(() => {
  if (tab.value === "follow") refreshFollowStatus();
  scrollChatToBottom();
});

const chatItemStyle = computed(() => ({
  fontSize: `${chatSettings.value.fontSize || 14}px`,
  opacity: (Number(chatSettings.value.opacity) || 100) / 100,
  marginBottom: `${chatSettings.value.gap ?? 4}px`,
}));

/** 非聊天 Tab 时不挂载弹幕列表，避免关注 Tab 下高频 patch 触发 Vue 更新异常 */
const chatDanmakuMessages = computed(() => {
  if (tab.value !== "chat" || !chatSettings.value.show) return [];
  return props.danmakuMessages;
});

watch(
  () => props.danmakuMessages.map((m) => m.id).join(),
  () => scrollChatToBottom(),
);

watch(tab, (value) => {
  if (value === "chat") scrollChatToBottom();
});
</script>

<style scoped>
.play-side {
  flex-shrink: 0;
  width: var(--play-sidebar-width);
  border-left: 1px solid var(--gray-7);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg);
}

.side-header {
  padding: .5rem .55rem;
  border-bottom: 1px solid var(--gray-7);
}

.room-aside {
  display: flex;
  align-items: center;
  gap: .4rem;
  width: 100%;
}

.room-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: #111;
  flex-shrink: 0;
}

.room-avatar--empty {
  display: grid;
  place-items: center;
  font-size: .75rem;
  color: var(--muted);
  border: 1px dashed var(--border);
}

.room-aside-meta {
  flex: 1;
  min-width: 0;
}

.room-anchor {
  margin: 0;
  font-size: .78rem;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--live);
}

.room-fans {
  display: flex;
  align-items: center;
  gap: .2rem;
  margin: .16rem 0 0;
  font-size: .7rem;
  line-height: 1.15;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.room-stat-icon {
  width: .78em;
  height: .78em;
  opacity: .7;
  flex-shrink: 0;
}

.super-follow-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: .14rem;
  padding: .22rem .34rem;
  border: 1px solid rgba(155, 89, 182, 0.35);
  border-radius: 6px;
  background: rgba(155, 89, 182, 0.1);
  color: #b794f6;
  font-size: .62rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: border-color .12s ease, background-color .12s ease, color .12s ease;
}

.super-follow-btn:hover {
  border-color: rgba(155, 89, 182, 0.55);
  background: rgba(155, 89, 182, 0.18);
  color: #d6bcfa;
}

.super-follow-btn--active {
  border-color: #9b59b6;
  background: rgba(155, 89, 182, 0.28);
  color: #e9d5ff;
}

.super-follow-btn__icon {
  width: .78rem;
  height: .78rem;
}

.super-follow-btn__text {
  white-space: nowrap;
}

.tabs {
  display: flex;
  padding: 0 .5rem;
  gap: 1rem;
  border-bottom: 1px solid var(--gray-7);
  flex-shrink: 0;
}

.tabs button {
  background: none;
  border: none;
  color: var(--muted);
  padding: .65rem .25rem;
  font-size: .9rem;
  cursor: pointer;
  position: relative;
}

.tabs button:hover { color: var(--amber); }

.tabs button.active {
  color: var(--amber);
  font-weight: 600;
}

.tabs button.active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--amber);
}

.tab-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.follow-tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .35rem;
  padding: .35rem .45rem .7rem;
  flex-shrink: 0;
}

.follow-tab-toolbar__actions {
  display: flex;
  align-items: center;
  gap: .28rem;
  flex-shrink: 0;
}

.follow-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .28rem .35rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  line-height: 1;
  flex-shrink: 0;
}

.follow-toolbar-btn:hover:not(:disabled) {
  color: var(--amber);
  border-color: var(--amber);
}

.follow-toolbar-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.follow-toolbar-btn :deep(.ui-icon) {
  font-size: .88rem;
  line-height: 1;
}

.follow-list-mode-btn--active {
  color: var(--amber);
  border-color: rgba(243, 208, 78, 0.45);
  background: rgba(243, 208, 78, 0.1);
}

.chat-list {
  flex: 1;
  min-height: 0;
  font-size: .85rem;
  line-height: 1.5;
}

.chat-list__content {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 100%;
  padding: .5rem;
  box-sizing: border-box;
}

.chat-item {
  margin-bottom: .35rem;
  word-wrap: break-word;
}

.chat-item.sys { color: var(--muted); }

.chat-user { color: #8ab4f8; }

.chat-text { color: var(--text); }

.settings-tab {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  align-self: stretch;
  box-sizing: border-box;
  padding: .35rem 0 .4rem;
  gap: .38rem;
}

.settings-groups {
  display: flex;
  align-items: stretch;
  gap: .25rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0;
}

.settings-group {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: .3rem;
  padding: .36rem .42rem .38rem;
  border: 1px solid var(--gray-7);
  border-radius: 6px;
  background: rgba(255, 255, 255, .02);
  box-sizing: border-box;
}

.settings-group__title {
  margin: 0 0 .06rem;
  padding-bottom: .26rem;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  font-size: .82rem;
  font-weight: 600;
  letter-spacing: .02em;
  color: var(--amber);
}

.setting-row {
  display: grid;
  grid-template-columns: 2.45rem minmax(0, 1fr) auto;
  align-items: center;
  gap: .26rem;
  min-height: 1.65rem;
  padding: .1rem 0;
  cursor: pointer;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.setting-row--toggle {
  grid-template-columns: 2.45rem 1fr;
  min-height: 1.55rem;
}

.setting-label {
  font-size: .82rem;
  color: var(--muted);
  white-space: nowrap;
  line-height: 1.25;
}

.setting-value {
  font-size: .78rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--amber);
  line-height: 1.25;
  justify-self: end;
  min-width: 0;
  padding-right: 0;
}

.setting-select {
  grid-column: 2 / 4;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
  padding: .18rem .32rem;
  font-size: .8rem;
  border-radius: 5px;
  line-height: 1.3;
}

.setting-check {
  grid-column: 2;
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: var(--amber);
  cursor: pointer;
}

.setting-range {
  width: 100%;
  min-width: 0;
  height: 3px;
  margin: 0;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, .12);
  appearance: none;
  cursor: pointer;
}

.setting-range::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  border: 2px solid #1a1a1a;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 0 1px rgba(243, 208, 78, .35);
}

.setting-range::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 2px solid #1a1a1a;
  border-radius: 50%;
  background: var(--amber);
}

.setting-range::-moz-range-track {
  height: 3px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, .12);
}

@media (max-width: 1024px) {
  .play-side {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--gray-7);
    height: 360px;
    flex-shrink: 0;
  }
}
</style>
