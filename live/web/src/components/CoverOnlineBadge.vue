<template>
  <span v-if="displayText" class="cover-online-badge">{{ displayText }}</span>
</template>

<script setup>
import { computed } from "vue";
import { formatOnlineWanIfNeeded } from "../utils/followDisplay.js";

const props = defineProps({
  online: { type: String, default: "" },
  live: { type: Boolean, default: true },
});

const displayText = computed(() => {
  if (!props.live) return "";
  const text = String(props.online || "").trim();
  if (!text || text === "—" || text === "-") return "";
  return formatOnlineWanIfNeeded(text);
});
</script>

<style scoped>
.cover-online-badge {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 3;
  max-width: 88%;
  padding: .26rem .48rem;
  font-size: .74rem;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: rgba(0, 0, 0, 0.72);
  border-top-left-radius: 8px;
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
