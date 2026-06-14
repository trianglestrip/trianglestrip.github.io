<template>
  <span
    v-if="site"
    class="platform-cover-badge"
    :class="`platform-cover-badge--${site}`"
  >{{ label }}</span>
</template>

<script setup>
import { computed } from "vue";
import { getPlatform } from "../config/platforms.js";

const props = defineProps({
  site: { type: String, default: "" },
});

const label = computed(() => {
  const id = String(props.site || "").trim();
  if (!id) return "";
  return getPlatform(id)?.label || id;
});
</script>

<style scoped>
.platform-cover-badge {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  font-size: .74rem;
  font-weight: 700;
  line-height: 1.15;
  padding: .28rem .5rem;
  border-radius: 0 0 8px 0;
  letter-spacing: .03em;
  pointer-events: none;
  color: #fff;
  background: rgba(0, 0, 0, 0.72);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
}

.platform-cover-badge--douyu {
  color: #fff;
  background: #ff6b00;
}

.platform-cover-badge--huya {
  color: #1a1a1a;
  background: #ffcc00;
  text-shadow: none;
}

.platform-cover-badge--douyin {
  color: #fff;
  background: #fe2c55;
}

.platform-cover-badge--bilibili {
  color: #fff;
  background: var(--platform-bilibili, #00a1d6);
}
</style>
