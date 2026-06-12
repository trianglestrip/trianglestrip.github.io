<template>
  <div ref="rootEl" class="infinite-list" @scroll="onScroll">
    <slot />
    <p v-if="loading" class="infinite-status">加载中...</p>
    <p v-else-if="finished" class="infinite-status">没有更多了</p>
    <p v-else-if="error" class="infinite-status infinite-error" @click="$emit('load')">{{ errorText }}</p>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  loading: { type: Boolean, default: false },
  finished: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  errorText: { type: String, default: "加载失败，点击重新加载" },
  offset: { type: Number, default: 80 },
});

const emit = defineEmits(["load"]);
const rootEl = ref(null);

function onScroll() {
  const el = rootEl.value;
  if (!el || props.loading || props.finished || props.error) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - props.offset) {
    emit("load");
  }
}
</script>

<style scoped>
.infinite-list {
  height: 100%;
  min-height: 0;
}

.infinite-status {
  margin: 1rem 0;
  text-align: center;
  font-size: .85rem;
  color: var(--muted);
}

.infinite-error {
  cursor: pointer;
  color: var(--danger);
}
</style>
