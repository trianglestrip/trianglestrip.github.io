<template>
  <div class="infinite-list">
    <slot />
    <p v-if="loading" class="infinite-status">加载中...</p>
    <p v-else-if="finished" class="infinite-status">没有更多了</p>
    <p v-else-if="error" class="infinite-status infinite-error" @click="$emit('load')">{{ errorText }}</p>
    <div v-else ref="sentinelEl" class="infinite-sentinel" aria-hidden="true" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  loading: { type: Boolean, default: false },
  finished: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  errorText: { type: String, default: "加载失败，点击重新加载" },
  rootMargin: { type: String, default: "120px" },
});

const emit = defineEmits(["load"]);
const sentinelEl = ref(null);
let observer = null;

function tryLoad() {
  if (props.loading || props.finished || props.error) return;
  emit("load");
}

function setupObserver() {
  teardownObserver();
  if (!sentinelEl.value || props.finished || props.error) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) tryLoad();
    },
    { root: null, rootMargin: props.rootMargin, threshold: 0 },
  );
  observer.observe(sentinelEl.value);
}

function teardownObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

onMounted(setupObserver);
onBeforeUnmount(teardownObserver);

watch(
  () => [props.loading, props.finished, props.error],
  () => {
    setupObserver();
  },
);
</script>

<style scoped>
.infinite-list {
  min-height: 0;
}

.infinite-sentinel {
  width: 100%;
  height: 1px;
  pointer-events: none;
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
