<template>
  <div v-if="show" class="player-controls" :class="{ 'player-controls--overlay': overlay }">
    <div class="controls-bar">
      <button
        type="button"
        class="ctrl-icon"
        :title="playing ? '暂停' : '播放'"
        @click="$emit('toggle-play')"
      >
        <Icon :name="playing ? 'pause' : 'play'" class="ctrl-fa" />
      </button>

      <button type="button" class="ctrl-icon" title="刷新" @click="$emit('refresh')">
        <Icon name="refresh" class="ctrl-fa" />
      </button>

      <div ref="danmakuRef" class="ctrl-danmaku-group">
        <button
          type="button"
          class="ctrl-icon ctrl-icon--danmaku"
          :class="{ 'ctrl-icon--active': danmakuOn }"
          title="弹幕开关"
          @click="$emit('toggle-danmaku')"
        >
          <span class="ctrl-danmaku-mark" aria-hidden="true"><span class="ctrl-danmaku-char">弹</span></span>
        </button>
        <button
          type="button"
          class="ctrl-danmaku-settings-btn"
          :class="{ 'ctrl-danmaku-settings-btn--open': danmakuSettingsOpen }"
          title="飘屏弹幕设置"
          @click.stop="toggleDanmakuSettings"
        >
          弹幕设置
        </button>
        <div
          v-show="danmakuSettingsOpen"
          class="ctrl-danmaku-settings-pop"
          role="dialog"
          aria-label="飘屏弹幕设置"
          @click.stop
        >
          <OverlayDanmakuSettingsPanel v-model="overlaySettings" />
        </div>
      </div>

      <div class="controls-spacer"></div>

      <div class="controls-right">
        <div class="ctrl-volume">
          <button
            type="button"
            class="ctrl-icon"
            :title="muted || volume === 0 ? '开启声音' : '静音'"
            @click="$emit('toggle-mute')"
          >
            <Icon
              :name="muted || volume === 0 ? 'volume-off' : 'volume-up'"
              class="ctrl-fa"
            />
          </button>
          <input
            class="ctrl-volume__slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="volume"
            aria-label="音量"
            @input="onVolumeInput"
          />
        </div>

        <div ref="qualityRef" class="ctrl-dropdown">
          <button
            type="button"
            class="ctrl-dropdown__trigger"
            :disabled="!qualities.length"
            @click.stop="toggleQualityMenu"
          >
            {{ qualityLabel }}
          </button>
          <div v-show="qualityOpen && qualities.length" class="ctrl-dropdown__menu">
            <button
              v-for="item in qualities"
              :key="item.index"
              type="button"
              class="ctrl-dropdown__item"
              :class="{ active: item.index === qualityIndex }"
              @click="pickQuality(item.index)"
            >
              {{ item.loaded ? item.name : `${item.name}（待加载）` }}
            </button>
          </div>
        </div>

        <div ref="lineRef" class="ctrl-dropdown">
          <button
            type="button"
            class="ctrl-dropdown__trigger"
            :disabled="!lines.length"
            @click.stop="toggleLineMenu"
          >
            {{ lineLabel }}
          </button>
          <div v-show="lineOpen && lines.length" class="ctrl-dropdown__menu">
            <button
              v-for="(line, index) in lines"
              :key="index"
              type="button"
              class="ctrl-dropdown__item"
              :class="{ active: index === lineIndex }"
              @click="pickLine(index)"
            >
              {{ line.name }}
            </button>
          </div>
        </div>

        <button type="button" class="ctrl-icon ctrl-icon--pip" title="画中画" @click="$emit('toggle-pip')">
          <Icon :name="pictureInPicture ? 'pip-exit' : 'pip'" class="ctrl-fa" />
        </button>
      </div>

      <button
        type="button"
        class="ctrl-icon"
        :class="{ 'ctrl-icon--active': webscreen }"
        title="网页全屏"
        @click="$emit('webscreen')"
      >
        <Icon name="webscreen" class="ctrl-fa" />
      </button>

      <button type="button" class="ctrl-icon" :title="fullscreen ? '退出全屏' : '全屏'" @click="$emit('fullscreen')">
        <Icon :name="fullscreen ? 'fullscreen-exit' : 'fullscreen'" class="ctrl-fa" />
      </button>
    </div>

    <p v-if="notice" class="controls-notice">{{ notice }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
import OverlayDanmakuSettingsPanel from "./OverlayDanmakuSettingsPanel.vue";

const overlaySettings = defineModel("overlaySettings", { type: Object, required: true });

const props = defineProps({
  show: { type: Boolean, default: true },
  overlay: { type: Boolean, default: false },
  playing: { type: Boolean, default: false },
  danmakuOn: { type: Boolean, default: true },
  webscreen: { type: Boolean, default: false },
  fullscreen: { type: Boolean, default: false },
  pictureInPicture: { type: Boolean, default: false },
  volume: { type: Number, default: 1 },
  muted: { type: Boolean, default: false },
  qualities: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  qualityIndex: { type: Number, default: 0 },
  lineIndex: { type: Number, default: 0 },
  notice: { type: String, default: "" },
});

const emit = defineEmits([
  "toggle-play",
  "webscreen",
  "fullscreen",
  "quality-change",
  "line-change",
  "refresh",
  "toggle-danmaku",
  "toggle-pip",
  "volume-change",
  "toggle-mute",
]);

const qualityOpen = ref(false);
const lineOpen = ref(false);
const danmakuSettingsOpen = ref(false);
const qualityRef = ref(null);
const lineRef = ref(null);
const danmakuRef = ref(null);

const qualityLabel = computed(() => {
  const item = props.qualities[props.qualityIndex];
  return item?.name || "清晰度";
});

const lineLabel = computed(() => props.lines[props.lineIndex]?.name || "线路");

function closeMenus() {
  qualityOpen.value = false;
  lineOpen.value = false;
  danmakuSettingsOpen.value = false;
}

function toggleDanmakuSettings() {
  qualityOpen.value = false;
  lineOpen.value = false;
  danmakuSettingsOpen.value = !danmakuSettingsOpen.value;
}

function toggleQualityMenu() {
  lineOpen.value = false;
  danmakuSettingsOpen.value = false;
  qualityOpen.value = !qualityOpen.value;
}

function toggleLineMenu() {
  qualityOpen.value = false;
  danmakuSettingsOpen.value = false;
  lineOpen.value = !lineOpen.value;
}

function pickQuality(index) {
  emit("quality-change", index);
  closeMenus();
}

function pickLine(index) {
  emit("line-change", index);
  closeMenus();
}

function onVolumeInput(event) {
  emit("volume-change", Number(event.target.value));
}

function onDocumentClick(event) {
  if (
    qualityRef.value?.contains(event.target)
    || lineRef.value?.contains(event.target)
    || danmakuRef.value?.contains(event.target)
  ) {
    return;
  }
  closeMenus();
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick));
</script>

<style scoped>
.player-controls {
  padding: .35rem .5rem .5rem;
}

.player-controls--overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 0;
  pointer-events: auto;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .5rem 1rem;
  background: rgba(0, 0, 0, .3);
}

.controls-spacer {
  flex: 1;
  min-width: .5rem;
}

.controls-right {
  display: flex;
  align-items: center;
  gap: .15rem;
}

.ctrl-volume {
  display: flex;
  align-items: center;
  gap: .25rem;
  margin-right: .15rem;
}

.ctrl-volume__slider {
  width: 4.5rem;
  height: .2rem;
  margin: 0;
  accent-color: var(--amber);
  cursor: pointer;
}

@media (max-width: 640px) {
  .ctrl-volume__slider {
    width: 3rem;
  }
}

.ctrl-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  transition: color .15s;
}

.ctrl-icon:hover,
.ctrl-icon--active {
  color: var(--amber);
}

.ctrl-icon--pip {
  margin-left: .35rem;
  font-size: 1.2rem;
}

.ctrl-icon :deep(.ui-icon),
.ctrl-fa,
.ctrl-danmaku-mark {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.ctrl-icon :deep(.ui-icon) {
  display: block;
}

.ctrl-fa {
  font-size: 1em;
  line-height: 1;
  pointer-events: none;
}

.ctrl-danmaku-mark {
  font-size: inherit;
  font-weight: 700;
  border: 2px solid currentColor;
  border-radius: 3px;
  pointer-events: none;
  user-select: none;
}

.ctrl-danmaku-char {
  font-size: .64em;
  line-height: 1;
}

.ctrl-icon--danmaku:not(.ctrl-icon--active) .ctrl-danmaku-mark {
  opacity: .72;
}

.ctrl-danmaku-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: .1rem;
  flex-shrink: 0;
}

.ctrl-danmaku-settings-btn {
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: .82rem;
  line-height: 1.2;
  padding: .2rem .35rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color .15s;
}

.ctrl-danmaku-settings-btn:hover,
.ctrl-danmaku-settings-btn--open {
  color: var(--amber);
}

.ctrl-danmaku-settings-pop {
  position: absolute;
  left: 0;
  bottom: 100%;
  margin-bottom: .4rem;
  width: 15.5rem;
  max-width: min(15.5rem, calc(100vw - 2rem));
  padding: .45rem .5rem .5rem;
  background: rgba(0, 0, 0, .9);
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .45);
  z-index: 6;
  box-sizing: border-box;
}

.ctrl-dropdown {
  position: relative;
  display: inline-block;
}

.ctrl-dropdown__trigger {
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: .88rem;
  padding: .25rem .35rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color .15s;
}

.ctrl-dropdown__trigger:hover:not(:disabled),
.ctrl-dropdown__trigger:focus-visible {
  color: var(--amber);
  outline: none;
}

.ctrl-dropdown__trigger:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.ctrl-dropdown__menu {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  min-width: 6.5rem;
  margin-bottom: .35rem;
  padding: .15rem 0;
  background: rgba(0, 0, 0, .88);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 6px;
  text-align: center;
  z-index: 5;
}

.ctrl-dropdown__item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: .85rem;
  padding: .35rem .65rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color .15s;
}

.ctrl-dropdown__item:hover,
.ctrl-dropdown__item.active {
  color: var(--amber);
}

.controls-notice {
  margin: .35rem 0 0;
  padding: 0 1rem .35rem;
  font-size: .82rem;
  color: var(--amber);
}
</style>
