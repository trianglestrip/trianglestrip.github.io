<template>
  <aside class="side-panel scrolly">
    <section class="panel-section platform-section">
      <h3 class="section-title">{{ platform?.tabLabel || "平台" }}</h3>
      <p class="platform-desc">{{ platform?.description }}</p>
      <ul v-if="platform?.features?.length" class="feature-list">
        <li v-for="item in platform.features" :key="item">{{ item }}</li>
      </ul>
      <p class="platform-meta">
        状态：<strong>{{ platform?.enabled ? "已接入" : "未接入" }}</strong>
        <template v-if="platform?.defaultRoom">
          · 示例 <code>{{ platform.defaultRoom }}</code>
        </template>
      </p>
    </section>

    <section class="panel-section">
      <label class="field-label" for="roomInput">房间号 / 链接</label>
      <div class="room-row">
        <input
          id="roomInput"
          v-model="roomInput"
          type="text"
          :placeholder="placeholder"
          :disabled="!platform?.enabled"
          autocomplete="off"
          @keydown.enter="$emit('play')"
        >
        <button
          class="btn btn-primary btn-play"
          type="button"
          :disabled="loading || !platform?.enabled"
          @click="$emit('play')"
        >
          {{ loading ? "…" : "播放" }}
        </button>
      </div>
    </section>

    <section class="panel-section row-2">
      <div>
        <label class="field-label" for="qualitySelect">清晰度</label>
        <select
          id="qualitySelect"
          :value="qualityIndex"
          :disabled="!qualities.length"
          @change="onQualitySelect"
        >
          <option v-if="!qualities.length" value="0">默认</option>
          <option v-for="item in qualities" :key="item.index" :value="item.index">
            {{ item.loaded ? item.name : `${item.name}（待加载）` }}
          </option>
        </select>
      </div>
      <div>
        <label class="field-label" for="lineSelect">线路</label>
        <select
          id="lineSelect"
          :value="lineIndex"
          :disabled="!lines.length"
          @change="onLineSelect"
        >
          <option v-if="!lines.length" value="0">—</option>
          <option v-for="(line, index) in lines" :key="index" :value="index">
            {{ line.name }}
          </option>
        </select>
      </div>
    </section>

    <section class="panel-section actions">
      <button class="btn" type="button" @click="$emit('stop')">停止</button>
    </section>

    <section class="panel-section room-section">
      <h3 class="section-title">房间信息</h3>
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

    <section class="panel-section status-section">
      <p class="status" :class="statusClass">{{ statusText || "输入房间号后点击播放" }}</p>
    </section>
  </aside>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  platform: { type: Object, default: null },
  roomInput: { type: String, default: "" },
  placeholder: { type: String, default: "例如 5720533" },
  qualities: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  qualityIndex: { type: Number, default: 0 },
  lineIndex: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  statusText: { type: String, default: "" },
  statusKind: { type: String, default: "info" },
  payload: { type: Object, default: null },
});

const emit = defineEmits(["update:roomInput", "play", "stop", "quality-change", "line-change"]);

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

function onQualitySelect(event) {
  emit("quality-change", Number(event.target.value) || 0);
}

function onLineSelect(event) {
  emit("line-change", Number(event.target.value) || 0);
}
</script>

<style scoped>
.side-panel {
  width: var(--sidebar-width);
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-elevated);
  padding: .85rem;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.panel-section {
  padding-bottom: .75rem;
  border-bottom: 1px solid var(--border);
}

.panel-section:last-child {
  border-bottom: none;
}

.section-title {
  margin: 0 0 .45rem;
  font-size: .82rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .04em;
}

.platform-desc {
  margin: 0 0 .5rem;
  font-size: .86rem;
  line-height: 1.55;
  color: var(--text);
}

.feature-list {
  margin: 0 0 .5rem;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
}

.feature-list li {
  font-size: .72rem;
  padding: .15rem .45rem;
  border-radius: 4px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  color: var(--muted);
}

.platform-meta {
  margin: 0;
  font-size: .78rem;
  color: var(--muted);
}

.platform-meta code {
  font-family: Consolas, monospace;
  color: var(--lemon);
}

.platform-meta strong {
  color: var(--live);
  font-weight: 600;
}

.field-label {
  display: block;
  margin-bottom: .35rem;
  color: var(--muted);
  font-size: .78rem;
}

.room-row {
  display: flex;
  gap: .45rem;
}

.room-row input {
  flex: 1;
  min-width: 0;
}

.btn-play {
  width: auto;
  min-width: 4.5rem;
  flex-shrink: 0;
}

.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .55rem;
}

.actions {
  display: flex;
  gap: .45rem;
}

.actions .btn {
  flex: 1;
}

.room-card {
  display: flex;
  gap: .65rem;
  align-items: flex-start;
}

.room-cover {
  width: 72px;
  height: 72px;
  border-radius: 6px;
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

.room-detail {
  min-width: 0;
  flex: 1;
}

.room-title {
  margin: 0 0 .25rem;
  font-size: .9rem;
  line-height: 1.4;
  word-break: break-word;
}

.room-anchor {
  margin: 0 0 .35rem;
  font-size: .82rem;
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
  background: rgba(61, 220, 132, .08);
}

.status {
  margin: 0;
  font-size: .82rem;
  line-height: 1.55;
  color: var(--muted);
  word-break: break-word;
}

.status.ok { color: var(--live); }
.status.err { color: var(--danger); }

@media (max-width: 960px) {
  .side-panel {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    max-height: 50vh;
  }
}
</style>
