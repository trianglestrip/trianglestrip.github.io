<template>
  <span
    class="platform-icon"
    :class="[`platform-icon--${id}`, `platform-icon--${size}`]"
    :title="label"
  >
    <img
      v-if="iconSrc"
      class="platform-icon__img"
      :src="iconSrc"
      :alt="label"
      loading="lazy"
      decoding="async"
    />
    <span v-else class="platform-icon__fallback">{{ fallbackText }}</span>
  </span>
</template>

<script setup>
import { computed } from "vue";
import { getPlatform } from "../config/platforms.js";

const ICON_SRC = {
  douyu: "/platform-icons/douyu.ico",
  huya: "/platform-icons/huya.ico",
  douyin: "/platform-icons/douyin.ico",
  bilibili: "/platform-icons/bilibili.ico",
};

const props = defineProps({
  id: { type: String, required: true },
  size: { type: String, default: "md" },
});

const label = computed(() => getPlatform(props.id)?.label || props.id);
const iconSrc = computed(() => ICON_SRC[props.id] || "");
const fallbackText = computed(() => label.value.slice(0, 1));
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
  overflow: hidden;
  background: transparent;
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

.platform-icon__img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.platform-icon__fallback {
  font-size: .72rem;
  font-weight: 700;
  color: var(--muted);
  line-height: 1;
}
</style>
