<template>
  <div v-if="show" class="player-controls">
    <div class="controls-row">
      <select :value="qualityIndex" :disabled="!qualities.length" @change="onQuality">
        <option v-for="item in qualities" :key="item.index" :value="item.index">
          {{ item.loaded ? item.name : `${item.name}（待加载）` }}
        </option>
      </select>
      <select :value="lineIndex" :disabled="!lines.length" @change="onLine">
        <option v-for="(line, index) in lines" :key="index" :value="index">{{ line.name }}</option>
      </select>
    </div>
    <div class="controls-row controls-actions">
      <button type="button" class="ctrl-btn" :title="playing ? '暂停' : '播放'" @click="$emit('toggle-play')">
        <i :class="playing ? 'ri-pause-line' : 'ri-play-line'"></i>
      </button>
      <button type="button" class="ctrl-btn" title="停止" @click="$emit('stop')">
        <i class="ri-stop-line"></i>
      </button>
      <button type="button" class="ctrl-btn" title="网页全屏" @click="$emit('webscreen')">
        <i class="ri-layout-row-line"></i>
      </button>
      <button type="button" class="ctrl-btn" title="全屏" @click="$emit('fullscreen')">
        <i class="ri-fullscreen-line"></i>
      </button>
    </div>
    <p v-if="notice" class="controls-notice">{{ notice }}</p>
  </div>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: true },
  playing: { type: Boolean, default: false },
  qualities: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  qualityIndex: { type: Number, default: 0 },
  lineIndex: { type: Number, default: 0 },
  notice: { type: String, default: "" },
});

const emit = defineEmits(["toggle-play", "stop", "webscreen", "fullscreen", "quality-change", "line-change"]);

function onQuality(event) {
  emit("quality-change", Number(event.target.value) || 0);
}

function onLine(event) {
  emit("line-change", Number(event.target.value) || 0);
}
</script>

<style scoped>
.player-controls {
  padding: .35rem .5rem .5rem;
}

.controls-row {
  display: flex;
  gap: .45rem;
  align-items: center;
  flex-wrap: wrap;
}

.controls-row select {
  flex: 1;
  min-width: 6rem;
}

.controls-actions {
  margin-top: .45rem;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
  border-radius: 8px;
  font-size: 1.1rem;
}

.controls-notice {
  margin: .45rem 0 0;
  font-size: .82rem;
  color: var(--amber);
}
</style>
