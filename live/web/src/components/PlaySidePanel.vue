<template>
  <aside
    class="play-side"
    :class="{
      'play-side--flow': isMobileFlowTab,
      'play-side--webscreen': webscreen,
    }"
  >
    <div class="side-header">
      <div class="room-aside">
        <div class="room-aside-avatar">
          <FollowAvatar
            :src="displayAvatar"
            :label="anchor?.slice(0, 1) || '?'"
            eager
          />
        </div>
        <div class="room-aside-meta">
          <p class="room-anchor">{{ anchor || "—" }}</p>
          <p class="room-fans" :title="fansTitle">
            <span>{{ fansText }}</span>
          </p>
          <p class="room-live-start" :title="liveStartTitle">
            <span>{{ liveStartText }}</span>
          </p>
        </div>
        <div class="room-aside-actions">
          <button
            type="button"
            class="follow-btn"
            :class="{ 'follow-btn--active': roomIsFollowed }"
            :title="roomIsFollowed ? '取消关注' : '关注'"
            @click="onToggleFollow"
          >
            <Icon name="heart" class="follow-btn__icon" :filled="roomIsFollowed" />
            <span class="follow-btn__text">{{ roomIsFollowed ? "已关注" : "关注" }}</span>
          </button>
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
    </div>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'chat' }" @click="tab = 'chat'">聊天</button>
      <button type="button" :class="{ active: tab === 'follow' }" @click="tab = 'follow'">关注</button>
      <button type="button" :class="{ active: tab === 'recommend' }" @click="tab = 'recommend'">推荐</button>
      <button type="button" :class="{ active: tab === 'settings' }" @click="tab = 'settings'">设置</button>
    </div>

    <div v-show="tab === 'chat'" class="tab-content chat-tab">
      <div v-if="chatPlayStatus || chatDanmakuLine || roomId" class="chat-sys-bar">
        <div class="chat-sys-line">
          <span v-if="chatPlayStatus" class="chat-sys-play">{{ chatPlayStatus }}</span>
          <span class="chat-sys-spacer" aria-hidden="true"></span>
          <span v-if="chatDanmakuLine" class="chat-sys-dm">{{ chatDanmakuLine }}</span>
          <button
            v-if="roomId"
            type="button"
            class="chat-dm-refresh-btn"
            title="重新连接弹幕"
            :disabled="dmRefreshing"
            @click="onRefreshDanmaku"
          >
            <Icon name="refresh" :class="{ 'chat-dm-refresh-btn__icon--spin': dmRefreshing }" />
            <span>刷新</span>
          </button>
        </div>
      </div>
      <div ref="chatListRef" class="chat-list">
        <div ref="chatContentRef" class="chat-list__content" :style="chatContentLayoutStyle">
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
        <FollowPlatformFilter v-model="followSiteFilter" class="follow-tab-toolbar__filter" />
      </div>
      <FollowPreviewGrid
        v-if="previewCover"
        sidebar
        compact
        hide-live-frame
        :show-stats="false"
        :rooms="filteredFollows"
        @select="$emit('play-room', $event)"
      />
      <FollowRoomList
        v-else
        layout="grid"
        hide-live-frame
        :rooms="filteredFollows"
        :loading="followStatusLoading"
        :show-delete="false"
        compact
        @select="$emit('play-room', $event)"
      />
    </div>

    <div v-show="tab === 'recommend'" class="tab-content scrolly recommend-tab">
      <p v-if="recommendLoading" class="recommend-hint">加载中…</p>
      <p v-else-if="recommendError" class="recommend-hint recommend-hint--err">{{ recommendError }}</p>
      <p v-else-if="!recommendPreviewRooms.length" class="recommend-hint">暂无推荐</p>
      <FollowPreviewGrid
        v-else
        sidebar
        compact
        :show-stats="false"
        :rooms="recommendPreviewRooms"
        @select="onRecommendSelect"
      />
    </div>

    <div v-show="tab === 'settings'" class="tab-content settings-tab">
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
          <label class="setting-row setting-row--speed">
            <span class="setting-label">速度</span>
            <div class="setting-speed-controls">
              <input
                v-model="chatSettings.speedLimit"
                type="checkbox"
                class="setting-check setting-check--inline"
                title="开启限速"
              >
              <input
                v-model.number="chatSettings.speed"
                class="setting-range"
                type="range"
                min="1"
                max="10"
                :disabled="!chatSettings.speedLimit"
              >
            </div>
            <span class="setting-value">{{ chatSettings.speedLimit ? `每${chatSettings.speed}秒1条` : "全量" }}</span>
          </label>
          <p class="settings-hint">关闭限速则一次显示全部弹幕；开启后严格按间隔逐条显示，满屏后从顶部滑出旧弹幕。</p>
        </section>
        <section class="settings-group">
          <h4 class="settings-group__title">关注列表</h4>
          <p class="settings-hint">导出紧凑格式到剪贴板，如 douyu:[252140],huya:[660000]，可在其他设备粘贴导入并合并。</p>
          <div class="settings-follow-actions">
            <button type="button" class="settings-action-btn" @click="onExportFollows">
              导出关注
            </button>
            <button type="button" class="settings-action-btn" @click="onImportFollows">
              导入关注
            </button>
          </div>
          <label v-if="exportFollowOpen" class="settings-import">
            <span class="settings-hint">请手动全选复制下方内容</span>
            <textarea
              ref="exportFollowInputRef"
              v-model="exportFollowText"
              class="settings-import__input"
              rows="3"
              readonly
            />
            <div class="settings-follow-actions">
              <button type="button" class="settings-action-btn" @click="exportFollowOpen = false">
                关闭
              </button>
            </div>
          </label>
          <label v-if="importFollowOpen" class="settings-import">
            <span class="settings-hint">粘贴关注数据后点确认</span>
            <textarea
              v-model="importFollowText"
              class="settings-import__input"
              rows="4"
              placeholder='douyu:[252140,6188551],huya:[660000]'
            />
            <div class="settings-follow-actions">
              <button type="button" class="settings-action-btn settings-action-btn--primary" @click="onConfirmImportFollows">
                确认导入
              </button>
              <button type="button" class="settings-action-btn" @click="importFollowOpen = false">
                取消
              </button>
            </div>
          </label>
        </section>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch, toRef, nextTick, onMounted, onBeforeUnmount } from "vue";
import Icon from "./Icon.vue";
import FollowAvatar from "./FollowAvatar.vue";
import FollowRoomList from "./FollowRoomList.vue";
import FollowPreviewGrid from "./FollowPreviewGrid.vue";
import FollowPlatformFilter from "./FollowPlatformFilter.vue";
import { fetchFollowStatus } from "../api/follow.js";
import { fetchCategoryRooms, fetchRelatedRecommendRooms, fetchMixedRecommendRooms, roomKey } from "../api/browse.js";
import { useFollow } from "../composables/useFollow.js";
import { useFollowStatus } from "../composables/useFollowStatus.js";
import { useToast } from "../composables/useToast.js";
import { loadGlobalPref, saveGlobalPref } from "../utils/prefStore.js";
import { briefDanmakuStatus, briefPlayStatus } from "../utils/chatStatus.js";
import { displayCategoryName } from "../utils/categoryDisplay.js";
import { formatLastLiveAt } from "../utils/followDisplay.js";
import { serializeFollowsMinimal, parseFollowsMinimal } from "../utils/followExport.js";
import { copyTextToClipboard } from "../utils/copyText.js";
import { mobileMediaQuery, playStackMediaQuery } from "../utils/breakpoints.js";

const props = defineProps({
  site: { type: String, default: "" },
  roomId: { type: String, default: "" },
  statusText: { type: String, default: "" },
  payload: { type: Object, default: null },
  danmakuMessages: { type: Array, default: () => [] },
  danmakuStatus: { type: String, default: "" },
  followList: { type: Array, default: () => [] },
  roomCategory: { type: String, default: "" },
  roomCid: { type: String, default: "" },
  roomPid: { type: String, default: "" },
  isSuperFollowed: { type: Boolean, default: false },
  webscreen: { type: Boolean, default: false },
});

const chatSettings = defineModel("chatSettings", { type: Object, required: true });

const emit = defineEmits(["play-room", "unfollow", "toggle-super-follow", "refresh-danmaku", "trim-chat"]);

const dmRefreshing = ref(false);

const { follows, isFollowed, toggleFollow, importFollows } = useFollow();
const { notify } = useToast();

const importFollowOpen = ref(false);
const importFollowText = ref("");
const exportFollowOpen = ref(false);
const exportFollowText = ref("");
const exportFollowInputRef = ref(null);

const tab = ref("follow");
const playMobileLayout = ref(false);

function syncPlayMobileLayout() {
  if (typeof window === "undefined") return;
  playMobileLayout.value = window.matchMedia(playStackMediaQuery()).matches;
}

const isMobileFlowTab = computed(() =>
  !props.webscreen
  && playMobileLayout.value
  && ["chat", "follow", "recommend", "settings"].includes(tab.value),
);
const followTabActive = computed(() => tab.value === "follow");
const followSiteFilter = ref("");
const followUiPref = loadGlobalPref("play_follow_ui", { previewCover: true });
const previewCover = ref(followUiPref.previewCover !== false);
const PLAY_FOLLOW_POLL_MS = 180000;
const PLAY_FOLLOW_MIN_REFRESH_MS = 60000;

const { sortedFollows, loading: followStatusLoading, refresh: refreshFollowStatus } = useFollowStatus(
  toRef(props, "followList"),
  {
    active: followTabActive,
    pollInterval: PLAY_FOLLOW_POLL_MS,
    minRefreshMs: PLAY_FOLLOW_MIN_REFRESH_MS,
    shallowWatch: true,
    getFocusCategory(merged) {
      const room = merged.find(
        (item) => item.site === props.site && String(item.id) === String(props.roomId),
      );
      return displayCategoryName(props.site, room?.category, room?.cid);
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

function onRefreshDanmaku() {
  if (dmRefreshing.value) return;
  dmRefreshing.value = true;
  resetChatFlow();
  emit("refresh-danmaku");
  window.setTimeout(() => {
    dmRefreshing.value = false;
  }, 900);
}

function togglePreviewCover() {
  previewCover.value = !previewCover.value;
  saveGlobalPref("play_follow_ui", { previewCover: previewCover.value });
}

const RECOMMEND_LIMIT = 20;
const RECOMMEND_PER_SITE = 10;

const recommendRooms = ref([]);
const recommendLoading = ref(false);
const recommendError = ref("");
const recommendLoaded = ref(false);

const recommendPreviewRooms = computed(() =>
  recommendRooms.value.map((room) => {
    const site = room.siteId || room.site || props.site;
    const offline = room.status === false || room.liveState === "offline";
    return {
      site,
      id: roomKey(room),
      anchor: room.nickname || room.title || roomKey(room),
      cover: room.cover || "",
      state: room.liveState || (room.status ? "live" : "offline"),
      online: offline ? "" : room.online || "",
      category: room.category || "",
      cid: room.cid || "",
    };
  }),
);

function findCurrentFollowRoom() {
  return (
    sortedFollows.value.find(
      (item) => item.site === props.site && String(item.id) === String(props.roomId),
    ) ||
    props.followList?.find(
      (item) => item.site === props.site && String(item.id) === String(props.roomId),
    ) ||
    null
  );
}

function excludeCurrentRoom(list) {
  return (list || []).filter(
    (room) =>
      String(room.siteId || room.site) !== props.site ||
      String(roomKey(room)) !== String(props.roomId),
  );
}

async function resolveRecommendContext() {
  const browseCid = String(props.roomCid || "").trim();
  const browsePid = String(props.roomPid || "").trim();
  if (browseCid) {
    return {
      category: props.roomCategory || "",
      cid: browseCid,
      pid: browsePid,
      fromBrowse: true,
    };
  }

  const room = findCurrentFollowRoom();
  const roomCid = props.roomCid || (room?.cid ? String(room.cid).trim() : "");

  if (props.roomCategory) {
    return { category: props.roomCategory, cid: roomCid };
  }

  const raw = room?.category ? String(room.category).trim() : "";
  if (raw || roomCid) {
    return {
      category: displayCategoryName(props.site, raw, roomCid),
      cid: roomCid,
    };
  }

  if (props.site && props.roomId) {
    try {
      const data = await fetchFollowStatus([{ site: props.site, id: props.roomId }]);
      const snap = data.list?.[0];
      const cat = String(snap?.category || "").trim();
      if (cat) {
        return {
          category: displayCategoryName(props.site, cat, roomCid),
          cid: roomCid,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return { category: "", cid: roomCid };
}

async function loadRecommend() {
  if (recommendLoaded.value || recommendLoading.value) return;
  recommendLoading.value = true;
  recommendError.value = "";
  try {
    const { category, cid, pid, fromBrowse } = await resolveRecommendContext();
    if (fromBrowse && cid && props.site === "douyin") {
      const data = await fetchCategoryRooms(props.site, { cid, pid, page: 1 });
      recommendRooms.value = excludeCurrentRoom(data.list).slice(0, RECOMMEND_LIMIT);
    } else if (category) {
      const data = await fetchRelatedRecommendRooms({
        site: props.site,
        category,
        cid,
        page: 1,
        perSite: RECOMMEND_PER_SITE,
        limit: RECOMMEND_LIMIT,
      });
      recommendRooms.value = excludeCurrentRoom(data.list).slice(0, RECOMMEND_LIMIT);
    } else {
      const mixed = await fetchMixedRecommendRooms({ page: 1, perSite: RECOMMEND_PER_SITE });
      recommendRooms.value = excludeCurrentRoom(mixed).slice(0, RECOMMEND_LIMIT);
    }
    if (!recommendRooms.value.length) throw new Error("暂无推荐直播");
    recommendLoaded.value = true;
  } catch (err) {
    recommendError.value = err.message;
  } finally {
    recommendLoading.value = false;
  }
}

function onRecommendSelect(room) {
  emit("play-room", room);
}

async function onExportFollows() {
  const list = follows.value || [];
  if (!list.length) {
    notify({ kind: "info", title: "暂无关注可导出" });
    return;
  }
  const text = serializeFollowsMinimal(list);
  importFollowOpen.value = false;
  const copied = await copyTextToClipboard(text);
  if (copied) {
    exportFollowOpen.value = false;
    notify({ kind: "live", title: `已复制 ${list.length} 个关注到剪贴板` });
    return;
  }
  exportFollowText.value = text;
  exportFollowOpen.value = true;
  await nextTick();
  const input = exportFollowInputRef.value;
  if (input) {
    input.focus();
    input.select();
  }
  notify({ kind: "info", title: "无法自动写入剪贴板，请手动复制下方内容" });
}

async function onImportFollows() {
  importFollowText.value = "";
  exportFollowOpen.value = false;
  try {
    const clip = await navigator.clipboard.readText();
    if (clip?.trim()) {
      const applied = applyImportedFollows(clip);
      if (applied !== null) return;
    }
  } catch {
    /* 无权限或未授权时展开手动粘贴 */
  }
  importFollowOpen.value = true;
}

function applyImportedFollows(text) {
  const items = parseFollowsMinimal(text);
  if (!items.length) {
    notify({ kind: "offline", title: "未识别到有效关注数据" });
    return null;
  }
  const added = importFollows(items);
  importFollowOpen.value = false;
  importFollowText.value = "";
  refreshFollowStatus({ force: true });
  const total = follows.value.length;
  notify({
    kind: "live",
    title: added > 0 ? `已导入 ${added} 个新关注（共 ${total} 个）` : `已合并，无新增（共 ${total} 个）`,
  });
  return added;
}

function onConfirmImportFollows() {
  applyImportedFollows(importFollowText.value);
}

watch(tab, (value) => {
  if (value === "recommend") loadRecommend();
}, { immediate: true });

watch(followTabActive, (active) => {
  if (active) refreshFollowStatus();
});

watch(
  () => [props.site, props.roomId, props.roomCategory, props.roomCid, props.roomPid],
  () => {
    recommendRooms.value = [];
    recommendLoaded.value = false;
    recommendError.value = "";
    if (tab.value === "recommend") loadRecommend();
  },
);

const roomIsFollowed = computed(() => isFollowed(props.site, props.roomId));

function roomInfoForFollow() {
  return {
    site: props.site,
    id: String(props.roomId || props.payload?.room_id || "").trim(),
    title: props.payload?.title || "",
    anchor: props.payload?.anchor_name || "",
    cover: props.payload?.cover || "",
    avatar: props.payload?.avatar || roomAvatar.value || "",
  };
}

function onToggleFollow() {
  const info = roomInfoForFollow();
  if (!info.id) return;
  toggleFollow(info);
}

const anchor = computed(() => props.payload?.anchor_name || "");

const roomFans = ref("");
const roomLiveStartAt = ref(0);
const roomState = ref("offline");
const roomAvatar = ref("");

const fansText = computed(() => {
  const count = String(roomFans.value || "").trim();
  return count ? `关注：${count}` : "关注：—";
});
const fansTitle = computed(() => fansText.value);
const liveStartText = computed(() => {
  if (roomState.value === "offline") return "开播：—";
  const text = formatLastLiveAt(roomLiveStartAt.value);
  return text ? `开播：${text}` : "开播：—";
});
const liveStartTitle = computed(() => liveStartText.value);
const displayAvatar = computed(() => {
  const fromPayload = String(props.payload?.avatar || "").trim();
  if (fromPayload) return fromPayload;
  const fromSnap = String(roomAvatar.value || "").trim();
  if (fromSnap) return fromSnap;
  const id = String(props.roomId || props.payload?.room_id || "").trim();
  const site = String(props.site || props.payload?.platform || props.payload?.site || "").trim();
  if (!id || !site) return "";
  const room =
    sortedFollows.value.find((item) => item.site === site && String(item.id) === id) ||
    props.followList?.find((item) => item.site === site && String(item.id) === id);
  return String(room?.avatar || "").trim();
});

function syncMetaFromFollowList() {
  const id = String(props.roomId || props.payload?.room_id || "").trim();
  const site = String(props.site || props.payload?.platform || props.payload?.site || "").trim();
  if (!id || !site) return;
  const room =
    sortedFollows.value.find((item) => item.site === site && String(item.id) === id) ||
    props.followList?.find((item) => item.site === site && String(item.id) === id);
  if (!room) return;
  if (!roomAvatar.value && room.avatar) roomAvatar.value = String(room.avatar).trim();
  if (!roomFans.value && room.fans) roomFans.value = String(room.fans).trim();
  if (room.state) roomState.value = room.state;
  if (room.liveStartAt) roomLiveStartAt.value = Number(room.liveStartAt) || 0;
}

function syncAvatarFromFollowList() {
  syncMetaFromFollowList();
}

async function refreshRoomFans() {
  const site = String(
    props.payload?.platform || props.payload?.site || props.site || "",
  ).trim();
  const id = String(props.payload?.room_id || props.roomId || "").trim();
  if (!site || !id) {
    roomFans.value = "";
    roomLiveStartAt.value = 0;
    roomState.value = "offline";
    if (!props.payload?.avatar) roomAvatar.value = "";
    return;
  }
  try {
    const data = await fetchFollowStatus([{ site, id }]);
    const snap = data.list?.[0];
    if (!snap) return;
    roomFans.value = snap.fans || "";
    if (snap.state) roomState.value = snap.state;
    if (snap.liveStartAt) roomLiveStartAt.value = Number(snap.liveStartAt) || 0;
    else if (snap.state === "offline") roomLiveStartAt.value = 0;
    if (!roomAvatar.value && snap.avatar) roomAvatar.value = snap.avatar;
  } catch {
    /* 保留上次 */
  }
}

function refreshSide() {
  const payloadAvatar = String(props.payload?.avatar || "").trim();
  roomAvatar.value = payloadAvatar;
  if (!payloadAvatar) syncAvatarFromFollowList();
  void refreshRoomFans();
}

defineExpose({ refreshSide });

watch(
  () => [
    props.site,
    props.roomId,
    props.payload?.platform,
    props.payload?.site,
    props.payload?.room_id,
    props.payload?.avatar,
  ],
  () => {
    const payloadAvatar = String(props.payload?.avatar || "").trim();
    roomAvatar.value = payloadAvatar;
    if (!payloadAvatar) syncAvatarFromFollowList();
    if (!props.payload?.room_id && !props.roomId) {
      roomFans.value = "";
      roomLiveStartAt.value = 0;
      roomState.value = "offline";
      roomAvatar.value = "";
      return;
    }
    roomFans.value = "";
    roomLiveStartAt.value = 0;
    roomState.value = "offline";
    void refreshRoomFans();
  },
  { immediate: true },
);

const chatItemStyle = computed(() => ({
  fontSize: `${chatSettings.value.fontSize || 14}px`,
  opacity: (Number(chatSettings.value.opacity) || 100) / 100,
  marginBottom: `${chatSettings.value.gap ?? 4}px`,
}));

/** 在 danmakuMessages 上取连续窗口 [start, end)，保证列表无断层、满屏连贯上滚 */
let chatDisplayStart = 0;
let chatDisplayEnd = 0;
let nextChatReleaseAt = 0;
let chatFlowRafId = null;
const CHAT_VISIBLE_MAX = 48;

function chatIntervalSeconds() {
  const raw = Number(chatSettings.value.speed);
  if (!Number.isFinite(raw)) return 5;
  return Math.min(10, Math.max(1, Math.round(raw)));
}

function resetChatFlow() {
  chatDisplayStart = 0;
  chatDisplayEnd = 0;
  nextChatReleaseAt = 0;
}

function clampChatDisplayEnd() {
  const total = props.danmakuMessages.length;
  if (chatDisplayEnd > total) chatDisplayEnd = total;
}

function trimChatVisibleStart() {
  if (chatDisplayEnd - chatDisplayStart > CHAT_VISIBLE_MAX) {
    chatDisplayStart = chatDisplayEnd - CHAT_VISIBLE_MAX;
  }
}

/** 缓冲满员轮换：长度不变但头部 id 变化，需回退释放游标，避免新弹幕瞬间全显 */
function syncBufferRotation(msgs, oldMsgs) {
  if (!chatSpeedLimitOn() || !oldMsgs?.length || !msgs.length) return;
  if (msgs.length !== oldMsgs.length) return;

  let rotated = 0;
  const limit = Math.min(msgs.length, oldMsgs.length);
  for (let i = 0; i < limit; i += 1) {
    if (msgs[i]?.id === oldMsgs[i]?.id) break;
    rotated += 1;
  }
  if (rotated <= 0) return;

  chatDisplayEnd = Math.max(chatDisplayStart, chatDisplayEnd - rotated);
  clampChatDisplayEnd();
}

function syncChatWindowAfterParentTrim(removed) {
  const n = Math.max(0, Number(removed) || 0);
  if (!n) return;
  chatDisplayStart = Math.max(0, chatDisplayStart - n);
  chatDisplayEnd = Math.max(chatDisplayStart, chatDisplayEnd - n);
  clampChatDisplayEnd();
}

function chatSpeedLimitOn() {
  return Boolean(chatSettings.value.speedLimit);
}

function syncChatAllMessages() {
  chatDisplayEnd = props.danmakuMessages.length;
  trimChatVisibleStart();
}

function releaseChatMessages(now) {
  if (!chatSpeedLimitOn()) return false;

  const intervalMs = chatIntervalSeconds() * 1000;
  if (!nextChatReleaseAt) nextChatReleaseAt = now + intervalMs;
  if (now < nextChatReleaseAt) return false;
  nextChatReleaseAt = now + intervalMs;

  const total = props.danmakuMessages.length;
  if (chatDisplayEnd >= total) return false;

  chatDisplayEnd += 1;
  trimChatVisibleStart();
  return true;
}

function chatFlowShouldRun() {
  return tab.value === "chat" && chatSettings.value.show && chatSpeedLimitOn();
}

function stopChatFlowLoop() {
  if (!chatFlowRafId) return;
  cancelAnimationFrame(chatFlowRafId);
  chatFlowRafId = null;
}

function chatFlowLoop(now) {
  if (!chatFlowShouldRun()) {
    chatFlowRafId = null;
    return;
  }
  if (releaseChatMessages(now)) void syncChatOverflow();
  chatFlowRafId = requestAnimationFrame(chatFlowLoop);
}

function startChatFlowLoop() {
  if (chatFlowRafId) return;
  chatFlowRafId = requestAnimationFrame(chatFlowLoop);
}

function syncChatFlowState() {
  if (!chatSettings.value.show || tab.value !== "chat") {
    stopChatFlowLoop();
    return;
  }
  if (!chatSpeedLimitOn()) {
    stopChatFlowLoop();
    syncChatAllMessages();
    void syncChatOverflow();
    return;
  }
  clampChatDisplayEnd();
  startChatFlowLoop();
}


/** 非聊天 Tab 时不挂载弹幕列表，避免关注 Tab 下高频 patch 触发 Vue 更新异常 */
const chatDanmakuMessages = computed(() => {
  if (tab.value !== "chat" || !chatSettings.value.show) return [];
  const msgs = props.danmakuMessages;
  if (!msgs.length || chatDisplayStart >= msgs.length) return [];
  const end = chatSpeedLimitOn() ? chatDisplayEnd : msgs.length;
  if (end <= chatDisplayStart) return [];
  return msgs.slice(chatDisplayStart, end);
});

const chatListRef = ref(null);
const chatContentRef = ref(null);
const chatBottomInset = ref(0);
let chatResizeObserver = null;

function isMobilePortraitChat() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia(mobileMediaQuery()).matches) return false;
  if (!playMobileLayout.value || props.webscreen) return false;
  return window.matchMedia("(orientation: portrait)").matches;
}

function navBarHeightPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--nav-height").trim();
  return parseFloat(raw) || 56;
}

function syncChatBottomInset() {
  if (!isMobilePortraitChat() || tab.value !== "chat") {
    chatBottomInset.value = 0;
    return;
  }
  const el = chatListRef.value;
  if (!el) {
    chatBottomInset.value = 0;
    return;
  }
  const navTop = window.innerHeight - navBarHeightPx();
  const overlap = el.getBoundingClientRect().bottom - navTop;
  chatBottomInset.value = Math.max(0, Math.min(navBarHeightPx(), overlap));
}

const chatContentLayoutStyle = computed(() => {
  const inset = chatBottomInset.value;
  if (!inset) return undefined;
  return {
    bottom: `${inset}px`,
    maxHeight: `calc(100% - ${inset}px)`,
  };
});

function syncChatLayout() {
  syncChatBottomInset();
  void syncChatOverflow();
}

async function syncChatOverflow() {
  if (tab.value !== "chat" || !chatSettings.value.show) return;
  await nextTick();
  const container = chatListRef.value;
  const content = chatContentRef.value;
  if (!container || !content) return;
  const maxH = container.clientHeight;
  if (maxH < 24) return;

  let iter = 0;
  while (
    content.scrollHeight > maxH + 1
    && chatDisplayEnd - chatDisplayStart > 1
    && iter < 48
  ) {
    const count = Math.max(1, chatDisplayEnd - chatDisplayStart);
    const avg = content.scrollHeight / count;
    const overflow = content.scrollHeight - maxH;
    const remove = Math.min(3, Math.max(1, Math.ceil(overflow / Math.max(avg, 6))));
    chatDisplayStart = Math.min(chatDisplayEnd - 1, chatDisplayStart + remove);
    iter += 1;
    await nextTick();
  }
}

watch(
  () => props.danmakuMessages,
  (msgs, oldMsgs) => {
    const len = msgs.length;
    const prev = oldMsgs?.length ?? 0;

    if (!len) {
      resetChatFlow();
      void syncChatOverflow();
      return;
    }

    syncBufferRotation(msgs, oldMsgs);

    if (len < prev) {
      syncChatWindowAfterParentTrim(prev - len);
    }

    if (!chatSpeedLimitOn()) {
      syncChatAllMessages();
    } else {
      clampChatDisplayEnd();
    }

    syncChatFlowState();
    if (!chatSpeedLimitOn()) {
      void syncChatOverflow();
    }
  },
);

watch(
  () => [
    chatSettings.value.fontSize,
    chatSettings.value.gap,
    chatSettings.value.show,
    chatSettings.value.speed,
    chatSettings.value.speedLimit,
  ],
  () => {
    nextChatReleaseAt = 0;
    if (chatSpeedLimitOn()) {
      clampChatDisplayEnd();
      trimChatVisibleStart();
    }
    syncChatFlowState();
    if (!chatSpeedLimitOn()) {
      void syncChatOverflow();
    }
  },
);

watch(tab, (value) => {
  if (value === "chat") {
    syncChatFlowState();
    syncChatLayout();
    return;
  }
  stopChatFlowLoop();
  chatBottomInset.value = 0;
});

function onPlayMobileLayoutChange() {
  syncPlayMobileLayout();
  syncChatBottomInset();
}

onMounted(() => {
  syncPlayMobileLayout();
  syncChatBottomInset();
  window.addEventListener("resize", onPlayMobileLayoutChange);
  window.addEventListener("scroll", syncChatBottomInset, { passive: true });
  if (typeof ResizeObserver === "undefined") return;
  chatResizeObserver = new ResizeObserver(syncChatLayout);
  if (chatListRef.value) chatResizeObserver.observe(chatListRef.value);
});

watch(chatListRef, (el, prev) => {
  if (!chatResizeObserver) return;
  if (prev) chatResizeObserver.unobserve(prev);
  if (el) chatResizeObserver.observe(el);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onPlayMobileLayoutChange);
  window.removeEventListener("scroll", syncChatBottomInset);
  stopChatFlowLoop();
  chatResizeObserver?.disconnect();
  chatResizeObserver = null;
});
</script>

<style scoped>
.play-side {
  flex-shrink: 0;
  width: var(--play-sidebar-width);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.play-side--webscreen {
  width: var(--play-sidebar-width);
  height: 100%;
  max-width: none;
  min-height: 0;
  border-top: none;
  flex-shrink: 0;
  overflow: hidden;
}

.side-header {
  padding: 0.2rem .55rem;
  border-bottom: 1px solid var(--chrome-border);
}

.room-aside {
  display: flex;
  align-items: center;
  gap: .4rem;
  width: 100%;
}

.room-aside-avatar {
  flex-shrink: 0;
  line-height: 0;
}

.room-aside-avatar :deep(.follow-avatar),
.room-aside-avatar :deep(.follow-avatar--empty) {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 4px;
}

.room-aside-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-self: stretch;
  min-height: 3.25rem;
  gap: 0;
  padding-top: 0;
}

.room-anchor {
  margin: 0;
  font-size: .9rem;
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
  margin: 0.2rem 0 0;
  font-size: .82rem;
  line-height: 1.2;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.room-live-start {
  margin: 0.14rem 0 0;
  font-size: .82rem;
  line-height: 1.2;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.room-aside-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  align-self: stretch;
  justify-content: center;
  gap: .24rem;
  min-height: 3.25rem;
}

.follow-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .14rem;
  width: 100%;
  padding: .22rem .34rem;
  border: 1px solid var(--play-follow-border);
  border-radius: 6px;
  background: var(--play-follow-bg);
  color: var(--play-follow-text);
  font-size: .62rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: border-color .12s ease, background-color .12s ease, color .12s ease;
}

.follow-btn:hover {
  border-color: var(--play-follow-border);
  background: var(--play-follow-bg-hover);
  color: var(--play-follow-text);
}

.follow-btn--active {
  border-color: var(--play-follow-border);
  background: var(--play-follow-bg-active);
  color: var(--play-follow-text-active);
}

.follow-btn__icon {
  width: .78rem;
  height: .78rem;
}

.follow-btn__text {
  white-space: nowrap;
}

.super-follow-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .14rem;
  width: 100%;
  padding: .22rem .34rem;
  border: 1px solid var(--play-super-border);
  border-radius: 6px;
  background: var(--play-super-bg);
  color: var(--play-super-text);
  font-size: .62rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: border-color .12s ease, background-color .12s ease, color .12s ease;
}

.super-follow-btn:hover {
  border-color: var(--play-super-border);
  background: var(--play-super-bg-hover);
  color: var(--play-super-text);
}

.super-follow-btn--active {
  border-color: var(--play-super-border);
  background: var(--play-super-bg-active);
  color: var(--play-super-text-active);
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
  border-bottom: 1px solid var(--chrome-border);
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
  gap: .35rem;
  padding: .35rem .45rem .7rem;
  flex-shrink: 0;
}

.follow-tab-toolbar__filter {
  flex: 0 1 auto;
  margin-left: auto;
}

.follow-tab-toolbar__filter :deep(.follow-platform-filter) {
  gap: .28rem;
}

.follow-tab-toolbar__filter :deep(.follow-platform-filter__item) {
  padding: .22rem .44rem;
  border-radius: 4px;
  font-size: .8rem;
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
  background: var(--follow-filter-bg, transparent);
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
  border-color: var(--primary-border-strong);
  background: var(--play-chip-bg);
}

.follow-tab :deep(.follow-room-list--grid) {
  padding: 0;
  gap: 0;
  flex-direction: column;
  flex-wrap: nowrap;
}

.follow-tab :deep(.follow-room-list--grid .follow-item) {
  border-radius: 0;
  flex: none;
  width: 100%;
  max-width: none;
  border: none;
  border-bottom: 1px solid var(--chrome-border);
}

.follow-tab :deep(.follow-room-list--grid .follow-item),
.follow-tab :deep(.follow-room-list--compact .follow-item) {
  padding: 0;
  gap: 0;
}

.follow-tab :deep(.follow-body) {
  gap: 0;
}

.recommend-hint {
  padding: 1rem .65rem;
  text-align: center;
  font-size: .82rem;
  color: var(--muted);
}

.recommend-hint--err {
  color: var(--danger);
}

.chat-tab {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chat-sys-bar {
  flex-shrink: 0;
  padding: .28rem .45rem .24rem;
  border-bottom: 1px solid var(--chrome-border);
}

.chat-sys-line {
  display: flex;
  align-items: center;
  gap: .35rem;
  min-width: 0;
}

.chat-sys-play {
  flex-shrink: 0;
  font-size: .84rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--text);
}

.chat-sys-spacer {
  flex: 1;
  min-width: .35rem;
}

.chat-sys-dm {
  flex-shrink: 0;
  font-size: .84rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--muted);
  white-space: nowrap;
}

.chat-dm-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: .2rem;
  flex-shrink: 0;
  padding: .18rem .4rem;
  border: none;
  border-radius: 5px;
  background: var(--sidebar-chip-bg);
  color: var(--muted);
  font: inherit;
  font-size: .84rem;
  font-weight: 400;
  line-height: 1.25;
  cursor: pointer;
  transition: background .15s, color .15s;
}

.chat-dm-refresh-btn:hover:not(:disabled) {
  background: var(--sidebar-chip-hover-bg);
  color: var(--amber);
}

@media (max-width: 767px) {
  .chat-sys-bar {
    display: none;
  }
}

.chat-dm-refresh-btn:disabled {
  opacity: .65;
  cursor: wait;
}

.chat-dm-refresh-btn__icon--spin {
  animation: chat-dm-refresh-spin .8s linear infinite;
}

@keyframes chat-dm-refresh-spin {
  to { transform: rotate(360deg); }
}

.chat-list {
  position: relative;
  flex: 1;
  min-height: 0;
  font-size: .85rem;
  line-height: 1.5;
  overflow: hidden;
}

.chat-list__content {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
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
  flex: 0 0 auto;
  min-height: auto;
  overflow: visible;
  width: 100%;
  max-width: 100%;
  align-self: stretch;
  box-sizing: border-box;
  padding: .35rem 0 .4rem;
  gap: .38rem;
}

.settings-groups {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: .38rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 0;
}

.settings-group {
  flex: 0 0 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: .3rem;
  padding: .36rem .42rem .38rem;
  border: 1px solid var(--chrome-border);
  border-radius: 6px;
  background: var(--play-chip-bg);
  box-sizing: border-box;
}

.settings-group__title {
  margin: 0 0 .06rem;
  padding-bottom: .26rem;
  border-bottom: 1px solid var(--chrome-border);
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

.setting-row--speed .setting-speed-controls {
  display: flex;
  align-items: center;
  gap: .3rem;
  min-width: 0;
}

.setting-row--speed .setting-range {
  flex: 1;
  min-width: 0;
}

.setting-check--inline {
  flex-shrink: 0;
  width: .95rem;
  height: .95rem;
  margin: 0;
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
  background: var(--play-range-track);
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
  box-shadow: 0 0 0 1px var(--primary-ring);
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
  background: var(--play-range-track);
}

.settings-hint {
  margin: 0;
  font-size: .74rem;
  line-height: 1.35;
  color: var(--muted);
}

.settings-follow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
}

.settings-action-btn {
  flex: 1 1 auto;
  min-width: 0;
  padding: .32rem .5rem;
  font-size: .78rem;
  border: 1px solid var(--chrome-border);
  border-radius: 5px;
  background: var(--play-chip-bg);
  color: var(--text);
  cursor: pointer;
}

.settings-action-btn:hover {
  border-color: var(--primary-ring);
  background: var(--bg-soft);
}

.settings-action-btn--primary {
  border-color: var(--primary-border-strong);
  color: var(--amber);
}

.settings-import {
  display: flex;
  flex-direction: column;
  gap: .3rem;
}

.settings-import__input {
  width: 100%;
  min-height: 4.5rem;
  max-height: 8rem;
  padding: .35rem .4rem;
  font-size: .74rem;
  font-family: ui-monospace, Consolas, monospace;
  line-height: 1.35;
  border: 1px solid var(--chrome-border);
  border-radius: 5px;
  background: var(--play-input-bg);
  color: var(--text);
  resize: vertical;
  box-sizing: border-box;
}

@media (max-width: 1024px) {
  .play-side {
    width: 100%;
    max-width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    height: auto;
    flex-shrink: 0;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .play-side--webscreen {
    width: var(--play-sidebar-width);
    max-width: min(var(--play-sidebar-width), 42vw);
    height: 100%;
    border-left: 1px solid var(--border);
    border-top: none;
    overflow: hidden;
  }

  .play-side--flow {
    height: auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: visible;
  }

  .play-side--flow .tab-content {
    flex: 0 0 auto;
    min-height: auto;
  }

  .play-side--flow .follow-tab.scrolly,
  .play-side--flow .recommend-tab.scrolly {
    min-height: min(45vh, 24rem);
    max-height: min(55vh, 30rem);
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .play-side--flow .settings-tab {
    max-height: min(55vh, 30rem);
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .play-side--flow .chat-tab {
    flex: 0 0 auto;
    min-height: min(40vh, 22rem);
    max-height: min(50vh, 28rem);
    overflow: hidden;
  }

  .play-side--flow .chat-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .tabs button {
    font-size: 1.05rem;
    font-weight: 600;
  }

  .play-side--flow .room-aside-actions {
    flex-direction: row;
    flex-wrap: nowrap;
    align-self: center;
    min-height: 0;
    gap: .2rem;
  }

  .play-side--flow .follow-btn,
  .play-side--flow .super-follow-btn {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    min-height: 0;
    padding: .46rem .28rem .28rem;
    font-size: .74rem;
    gap: .12rem;
  }

  .play-side--flow .follow-btn__icon,
  .play-side--flow .super-follow-btn__icon {
    width: .72rem;
    height: .72rem;
  }
}

@media (max-width: 640px) {
  .play-side--flow .chat-tab {
    min-height: min(52vh, 28rem);
    max-height: min(60vh, 32rem);
  }

  .play-side--flow .follow-tab.scrolly,
  .play-side--flow .recommend-tab.scrolly {
    min-height: min(50vh, 28rem);
    max-height: min(62vh, 34rem);
  }

  .play-side--flow .settings-tab {
    max-height: min(62vh, 34rem);
  }
}

@media (max-width: 640px) {
  .side-header {
    padding: .15rem .4rem;
  }

  .room-aside {
    gap: .3rem;
    min-width: 0;
    align-items: center;
  }

  .room-aside-avatar :deep(.follow-avatar),
  .room-aside-avatar :deep(.follow-avatar--empty) {
    width: 2.6rem;
    height: 2.6rem;
  }

  .room-aside-meta {
    min-height: 0;
    align-self: center;
  }

  .room-fans {
    margin-top: .12rem;
  }

  .room-live-start {
    margin-top: .08rem;
  }

  .room-anchor {
    font-size: .82rem;
  }

  .room-fans,
  .room-live-start {
    font-size: .72rem;
  }

  .room-aside-actions {
    flex-direction: row;
    flex-wrap: nowrap;
    align-self: center;
    min-height: 0;
    gap: .2rem;
  }

  .follow-btn,
  .super-follow-btn {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    padding: .52rem .3rem .3rem;
    font-size: .78rem;
    gap: .12rem;
    min-height: 0;
  }

  .follow-btn__icon,
  .super-follow-btn__icon {
    width: .76rem;
    height: .76rem;
    flex-shrink: 0;
  }

  .follow-btn__text,
  .super-follow-btn__text {
    display: inline;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tabs {
    gap: 0;
    padding: 0;
    overflow-x: visible;
  }

  .tabs button {
    flex: 1;
    padding: .68rem .1rem;
    font-size: 1.15rem;
    font-weight: 600;
    text-align: center;
  }
}
</style>
