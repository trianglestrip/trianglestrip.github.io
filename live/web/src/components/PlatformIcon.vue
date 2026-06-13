<template>
  <span
    class="platform-icon"
    :class="[`platform-icon--${id}`, `platform-icon--${size}`]"
    :title="label"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path v-if="id === 'douyu'" d="M12 3c-4 0-7 2.5-7 6.5 0 2.2 1.2 4.1 3 5.2-.6 1.5-1.6 2.8-2.8 3.8 2.5-.4 4.7-1.5 6.3-3.1 1.2.4 2.5.6 3.9.6 4 0 7-2.5 7-6.5S16 3 12 3Zm-2.2 5.8a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm4.4 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z" />
      <path v-else-if="id === 'huya'" d="M7 4h10l1 3h3v3h-1.2c.5 1.2.7 2.5.7 3.8 0 4.2-2.8 7.2-7 7.2S3 15 3 10.8c0-1.3.2-2.6.7-3.8H3V7h3L7 4Zm5 4.5a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
      <path v-else-if="id === 'douyin'" d="M15.5 4.5c.8 1.6 2.2 2.8 4 3.4V11c-1.5-.1-2.9-.6-4.1-1.4v5.8c0 3.2-2.6 5.8-5.8 5.8S4.4 18.4 4.4 15.3s2.6-5.8 5.8-5.8c.3 0 .7 0 1 .1v3.1a2.7 2.7 0 1 0 1.9 2.6V4.5h3.2Z" />
      <path v-else d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" />
    </svg>
  </span>
</template>

<script setup>
import { computed } from "vue";
import { getPlatform } from "../config/platforms.js";

const props = defineProps({
  id: { type: String, required: true },
  size: { type: String, default: "md" },
});

const label = computed(() => getPlatform(props.id)?.label || props.id);
</script>

<style scoped>
.platform-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  flex-shrink: 0;
}

.platform-icon--sm {
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 6px;
}

.platform-icon--xs {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 4px;
}

.platform-icon svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: currentColor;
}

.platform-icon--sm svg {
  width: 1rem;
  height: 1rem;
}

.platform-icon--xs svg {
  width: .72rem;
  height: .72rem;
}

.platform-icon--douyu {
  color: #ff8a2a;
  background: rgba(255, 138, 42, 0.15);
}

.platform-icon--huya {
  color: #ffb800;
  background: rgba(255, 184, 0, 0.15);
}

.platform-icon--douyin {
  color: #fe2c55;
  background: rgba(254, 44, 85, 0.15);
}
</style>
