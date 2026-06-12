<template>
  <aside class="side-panel">
    <div class="panel-block">
      <label class="field-label" for="roomInput">房间号 / 链接</label>
      <input
        id="roomInput"
        v-model="roomInput"
        type="text"
        :placeholder="placeholder"
        autocomplete="off"
        @keydown.enter="$emit('play')"
      >
    </div>

    <div class="panel-block row-2">
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
          <option v-for="(line, index) in lines" :key="index" :value="index">
            {{ line.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="panel-block actions">
      <button class="btn btn-primary" type="button" :disabled="loading" @click="$emit('play')">
        {{ loading ? "解析中…" : "播放" }}
      </button>
      <button class="btn" type="button" @click="$emit('stop')">停止</button>
    </div>

    <div class="panel-block tips">
      <p class="status" :class="statusClass">{{ statusText }}</p>
      <p class="hint">
        参考
        <a href="https://lemonlive.deno.dev/" target="_blank" rel="noopener noreferrer">Lemon Live</a>
        布局；解析走本机 API。
        <RouterLink to="/">首页</RouterLink>
        ·
        <a href="/legacy" target="_blank" rel="noopener">Legacy 调试</a>
      </p>
    </div>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps({
  roomInput: { type: String, default: "" },
  placeholder: { type: String, default: "例如 5720533" },
  qualities: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  qualityIndex: { type: Number, default: 0 },
  lineIndex: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  statusText: { type: String, default: "" },
  statusKind: { type: String, default: "info" },
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

function onQualitySelect(event) {
  emit("quality-change", Number(event.target.value) || 0);
}

function onLineSelect(event) {
  emit("line-change", Number(event.target.value) || 0);
}
</script>
