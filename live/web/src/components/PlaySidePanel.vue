<template>
  <aside class="play-side">
    <div class="side-header">
      <div class="room-info">
        <img v-if="cover" :src="cover" class="room-cover" alt="">
        <div v-else class="room-cover room-cover--empty">无封面</div>
        <div class="room-detail">
          <p class="room-title">{{ title }}</p>
          <div class="room-meta">
            <span class="room-anchor">{{ anchor || "—" }}</span>
            <span class="live-tag" :class="{ on: isLive }">{{ isLive ? "直播中" : "未开播" }}</span>
          </div>
        </div>
        <button
          type="button"
          class="follow-btn"
          :title="isFollowed ? '取消关注' : '关注'"
          @click="$emit('toggle-follow')"
        >
          <Icon name="heart" :filled="isFollowed" />
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
        <div class="chat-item sys">系统：开始获取直播间信息</div>
        <div v-if="statusText" class="chat-item sys">系统：{{ statusText }}</div>
        <div class="chat-item sys">系统：{{ danmakuStatus }}</div>
        <div v-for="m in danmakuMessages" v-show="chatSettings.show" :key="m.id" class="chat-item" :style="chatItemStyle">
          <span class="chat-user">{{ m.user }}：</span>
          <span class="chat-text">{{ m.text }}</span>
        </div>
      </div>
    </div>

    <div v-show="tab === 'follow'" class="tab-content scrolly">
      <button
        v-for="room in followList"
        :key="`${room.site}-${room.id}`"
        type="button"
        class="follow-item"
        @click="$emit('play-room', room)"
      >
        <img v-if="room.cover" :src="room.cover" class="follow-cover" alt="">
        <div v-else class="follow-cover follow-cover--empty"></div>
        <div class="follow-info">
          <p class="follow-title">{{ room.title || `房间 ${room.id}` }}</p>
          <p class="follow-meta">{{ platformLabel(room.site) }} · {{ room.anchor || room.id }}</p>
        </div>
        <Icon
          name="delete"
          class="delete-btn"
          title="取消关注"
          @click.stop="$emit('unfollow', room)"
        />
      </button>
      <div v-if="!followList.length" class="empty-tip">暂无关注，点击播放器控制条 ♥ 添加</div>
    </div>

    <div v-show="tab === 'settings'" class="tab-content settings-tab scrolly">
      <section class="settings-group">
        <h4 class="settings-group__title">屏幕弹幕</h4>
        <label class="setting-row setting-row--toggle">
          <span class="setting-label">飘屏</span>
          <input v-model="overlaySettings.show" type="checkbox" class="setting-check">
        </label>
        <label class="setting-row">
          <span class="setting-label">透明度</span>
          <input v-model.number="overlaySettings.opacity" class="setting-range" type="range" min="10" max="100">
          <span class="setting-value">{{ overlaySettings.opacity }}%</span>
        </label>
        <label class="setting-row">
          <span class="setting-label">字号</span>
          <input v-model.number="overlaySettings.fontSize" class="setting-range" type="range" min="12" max="36">
          <span class="setting-value">{{ overlaySettings.fontSize }}</span>
        </label>
        <label class="setting-row">
          <span class="setting-label">速度</span>
          <input v-model.number="overlaySettings.speed" class="setting-range" type="range" min="1" max="10">
          <span class="setting-value">{{ overlaySettings.speed }}</span>
        </label>
        <label class="setting-row">
          <span class="setting-label">区域</span>
          <select v-model.number="overlaySettings.area" class="setting-select">
            <option :value="1">全屏</option>
            <option :value="0.75">3/4</option>
            <option :value="0.5">半屏</option>
            <option :value="0.25">1/4</option>
          </select>
        </label>
      </section>

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
  </aside>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { getPlatform } from "../config/platforms";
import Icon from "./Icon.vue";

const props = defineProps({
  statusText: { type: String, default: "" },
  payload: { type: Object, default: null },
  danmakuMessages: { type: Array, default: () => [] },
  danmakuStatus: { type: String, default: "" },
  followList: { type: Array, default: () => [] },
  isFollowed: { type: Boolean, default: false },
});

const overlaySettings = defineModel("overlaySettings", { type: Object, required: true });
const chatSettings = defineModel("chatSettings", { type: Object, required: true });

defineEmits(["play-room", "unfollow", "toggle-follow"]);

const tab = ref("chat");
const chatListRef = ref(null);

const title = computed(() => props.payload?.title || props.payload?.anchor_name || "等待播放");
const anchor = computed(() => props.payload?.anchor_name || "");
const cover = computed(() => props.payload?.cover || "");
const isLive = computed(() => !!(props.payload?.is_live || props.payload?.status));

function platformLabel(site) {
  return getPlatform(site)?.label || site;
}

const chatItemStyle = computed(() => ({
  fontSize: `${chatSettings.value.fontSize || 14}px`,
  opacity: (Number(chatSettings.value.opacity) || 100) / 100,
  marginBottom: `${chatSettings.value.gap ?? 4}px`,
}));

watch(
  () => props.danmakuMessages.length,
  () => {
    if (tab.value !== "chat" || !chatListRef.value) return;
    const el = chatListRef.value;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom) {
      nextTick(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  },
);
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
  padding: .75rem .65rem;
  border-bottom: 1px solid var(--gray-7);
}

.room-info {
  display: flex;
  gap: .55rem;
  align-items: flex-start;
}

.room-cover {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
  background: #000;
  flex-shrink: 0;
}

.room-cover--empty {
  display: grid;
  place-items: center;
  font-size: .65rem;
  color: var(--muted);
  border: 1px dashed var(--border);
}

.room-detail {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.room-title {
  margin: 0 0 .25rem;
  font-size: .88rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.room-anchor {
  font-size: .8rem;
  color: var(--muted);
}

.live-tag {
  display: inline-block;
  font-size: .72rem;
  padding: .1rem .35rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  color: var(--muted);
  line-height: 1;
}

.live-tag.on {
  border-color: rgba(61, 220, 132, .45);
  color: var(--live);
}

.follow-btn {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.15rem;
  cursor: pointer;
}

.follow-btn:hover,
.follow-btn .ui-icon--filled {
  color: var(--danger);
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
  display: flex;
  flex-direction: column;
}

.chat-list {
  flex: 1;
  padding: .5rem;
  font-size: .85rem;
  line-height: 1.5;
}

.chat-item {
  margin-bottom: .35rem;
  word-wrap: break-word;
}

.chat-item.sys { color: var(--muted); }

.chat-user { color: #8ab4f8; }

.chat-text { color: var(--text); }

.follow-item {
  display: flex;
  gap: .45rem;
  width: 100%;
  padding: .5rem;
  border: none;
  border-bottom: 1px solid var(--gray-7);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  align-items: center;
}

.follow-item:hover { background: rgba(255, 255, 255, .03); }

.follow-cover {
  width: 56px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  background: #000;
}

.follow-cover--empty {
  border: 1px dashed var(--border);
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

.delete-btn {
  color: var(--danger);
  font-size: 1.1rem;
  opacity: .5;
  padding: .25rem;
  cursor: pointer;
}

.delete-btn:hover { opacity: 1; }

.empty-tip {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
  font-size: .85rem;
  line-height: 1.5;
}

.settings-tab {
  padding: .55rem .65rem .75rem;
  gap: .65rem;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  padding: .45rem .5rem .5rem;
  border: 1px solid var(--gray-7);
  border-radius: 8px;
  background: rgba(255, 255, 255, .02);
}

.settings-group__title {
  margin: 0 0 .15rem;
  padding-bottom: .35rem;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  font-size: .78rem;
  font-weight: 600;
  letter-spacing: .02em;
  color: var(--amber);
}

.setting-row {
  display: grid;
  grid-template-columns: 3.1rem 1fr 2.1rem;
  align-items: center;
  gap: .4rem;
  min-height: 1.85rem;
  padding: .1rem 0;
  cursor: pointer;
}

.setting-row--toggle {
  grid-template-columns: 3.1rem 1fr;
}

.setting-label {
  font-size: .78rem;
  color: var(--muted);
  white-space: nowrap;
}

.setting-value {
  font-size: .72rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--amber);
}

.setting-select {
  grid-column: 2 / 4;
  width: 100%;
  padding: .28rem .45rem;
  font-size: .78rem;
  border-radius: 6px;
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
  height: 4px;
  margin: 0;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, .12);
  appearance: none;
  cursor: pointer;
}

.setting-range::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border: 2px solid #1a1a1a;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 0 1px rgba(243, 208, 78, .35);
}

.setting-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid #1a1a1a;
  border-radius: 50%;
  background: var(--amber);
}

.setting-range::-moz-range-track {
  height: 4px;
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
