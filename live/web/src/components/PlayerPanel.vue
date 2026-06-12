<template>
  <section class="player-panel">
    <div class="player-frame">
      <video ref="videoEl" controls playsinline></video>
      <div v-show="!playing" class="player-placeholder">
        <span class="placeholder-icon"><i class="ri-play-circle-line"></i></span>
        <p>{{ placeholder }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  playing: { type: Boolean, default: false },
  placeholder: { type: String, default: "输入房间号并点击播放" },
});

const videoEl = ref(null);
defineExpose({ videoEl });
</script>

<style scoped>
.player-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
}

.player-frame {
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #000;
}

video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  background: #000;
}

.player-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: .5rem;
  text-align: center;
  color: var(--muted);
  pointer-events: none;
  background: rgba(0, 0, 0, .55);
}

.placeholder-icon {
  font-size: 2.75rem;
  color: var(--amber);
  opacity: .85;
}

.player-placeholder p {
  margin: 0;
  font-size: .9rem;
}
</style>
