<template>
  <section class="player-panel">
    <div class="player-frame">
      <video ref="videoEl" playsinline autoplay></video>
      <div v-show="!streamActive" class="player-placeholder">
        <span class="placeholder-icon" :class="{ 'placeholder-icon--spin': loading }">
          <Icon :name="loading ? 'refresh' : 'play-circle'" />
        </span>
        <p v-if="placeholder">{{ placeholder }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import Icon from "./Icon.vue";

defineProps({
  streamActive: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  placeholder: { type: String, default: "" },
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
  background: var(--on-video-bg-hint);
}

.placeholder-icon {
  font-size: 2.75rem;
  color: var(--amber);
  opacity: .85;
}

.placeholder-icon--spin {
  display: inline-flex;
  animation: placeholder-spin 1s linear infinite;
}

@keyframes placeholder-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.player-placeholder p {
  margin: 0;
  font-size: .9rem;
}
</style>
