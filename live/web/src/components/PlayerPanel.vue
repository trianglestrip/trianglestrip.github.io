<template>
  <section class="player-panel">
    <div class="player-frame">
      <video ref="videoEl" controls playsinline></video>
      <div v-show="!playing" class="player-placeholder">
        <span class="placeholder-icon">▶</span>
        <p>{{ placeholder }}</p>
      </div>
    </div>
    <div class="room-bar">
      <img v-if="cover" :src="cover" class="room-cover" alt="">
      <div class="room-text">
        <h2>{{ title }}</h2>
        <p>{{ anchor }}</p>
      </div>
      <span class="pill" :class="{ live: isLive }">{{ isLive ? "直播中" : "未开播" }}</span>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  playing: { type: Boolean, default: false },
  payload: { type: Object, default: null },
  placeholder: { type: String, default: "输入房间号并点击播放" },
});

const videoEl = ref(null);

const title = computed(() => props.payload?.title || props.payload?.anchor_name || "等待播放");
const anchor = computed(() => props.payload?.anchor_name || "");
const cover = computed(() => props.payload?.cover || "");
const isLive = computed(() => !!(props.payload?.is_live || props.payload?.status));

defineExpose({ videoEl });
</script>

<style scoped>
video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  background: #000;
}
</style>
