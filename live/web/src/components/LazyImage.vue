<template>
  <span
    class="lazy-image"
    :class="{
      'lazy-image--loaded': loaded,
      'lazy-image--has-src': !!(src || fallback),
    }"
  >
    <span v-if="!loaded && (src || fallback)" class="lazy-image__skeleton" aria-hidden="true" />
    <img
      v-if="src || fallback"
      ref="imgRef"
      :alt="alt"
      :class="imageClass"
      decoding="async"
      :fetchpriority="fetchPriority"
    >
  </span>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { findScrollRoot } from "../utils/scrollRoot.js";

const props = defineProps({
  src: { type: String, default: "" },
  /** 主图加载失败时回退 */
  fallback: { type: String, default: "" },
  alt: { type: String, default: "" },
  imageClass: { type: [String, Object, Array], default: "" },
  /** 进入视口前预加载的距离 */
  rootMargin: { type: String, default: "120px" },
  /** 首屏可见图可设为 true，跳过错峰加载 */
  eager: { type: Boolean, default: false },
  /** high | low | auto — 映射 fetchpriority */
  priority: { type: String, default: "auto" },
});

const imgRef = ref(null);
const loaded = ref(false);
let observer = null;
let usingFallback = false;

const fetchPriority = computed(() => {
  if (props.priority === "high") return "high";
  if (props.priority === "low") return "low";
  if (props.eager) return "high";
  return "auto";
});

function marginPx() {
  const parsed = parseInt(String(props.rootMargin), 10);
  return Number.isFinite(parsed) ? parsed : 120;
}

function teardown() {
  observer?.disconnect();
  observer = null;
}

function primarySrc() {
  return String(props.src || "").trim();
}

function fallbackSrc() {
  return String(props.fallback || "").trim();
}

function onImageLoad() {
  loaded.value = true;
}

function onImageError() {
  const el = imgRef.value;
  if (!el) return;
  const fb = fallbackSrc();
  if (fb && !usingFallback) {
    usingFallback = true;
    el.src = fb;
    return;
  }
  loaded.value = false;
  el.removeAttribute("src");
}

function loadNow() {
  const el = imgRef.value;
  const url = primarySrc() || fallbackSrc();
  if (!el || !url) return;
  usingFallback = !primarySrc() && !!fallbackSrc();
  if (el.src !== url) {
    loaded.value = false;
    el.onload = onImageLoad;
    el.onerror = onImageError;
    el.src = url;
  } else if (el.complete && el.naturalWidth) {
    loaded.value = true;
  }
  teardown();
}

function isNearViewport(el) {
  const root = findScrollRoot(el);
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return true;
  const margin = marginPx();
  if (!root) {
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }
  const rootRect = root.getBoundingClientRect();
  return rect.bottom >= rootRect.top - margin && rect.top <= rootRect.bottom + margin;
}

async function setup() {
  teardown();
  loaded.value = false;
  await nextTick();
  const el = imgRef.value;
  if (!el || (!props.src && !props.fallback)) return;

  if (props.eager || isNearViewport(el)) {
    loadNow();
    return;
  }

  const root = findScrollRoot(el);
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNow();
    },
    { root, rootMargin: props.rootMargin, threshold: 0 },
  );
  observer.observe(el);
}

onMounted(setup);
onBeforeUnmount(teardown);

watch(
  () => [props.src, props.fallback, props.eager, props.rootMargin, props.priority],
  () => {
    usingFallback = false;
    loaded.value = false;
    const el = imgRef.value;
    if (el) el.removeAttribute("src");
    setup();
  },
);
</script>

<style scoped>
.lazy-image {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
}

.lazy-image__skeleton {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    110deg,
    var(--surface-2, rgba(255, 255, 255, 0.06)) 8%,
    var(--surface-3, rgba(255, 255, 255, 0.12)) 18%,
    var(--surface-2, rgba(255, 255, 255, 0.06)) 33%
  );
  background-size: 200% 100%;
  animation: lazy-image-shimmer 1.2s ease-in-out infinite;
}

.lazy-image img {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.lazy-image--loaded img {
  opacity: 1;
}

@keyframes lazy-image-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
</style>
