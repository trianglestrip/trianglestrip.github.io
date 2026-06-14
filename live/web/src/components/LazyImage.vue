<template>
  <img
    v-if="src || fallback"
    ref="imgRef"
    :alt="alt"
    :class="imageClass"
    decoding="async"
  >
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { findScrollRoot } from "../utils/scrollRoot.js";

const props = defineProps({
  src: { type: String, default: "" },
  /** 主图加载失败时回退 */
  fallback: { type: String, default: "" },
  alt: { type: String, default: "" },
  imageClass: { type: [String, Object, Array], default: "" },
  /** 进入视口前预加载的距离 */
  rootMargin: { type: String, default: "240px" },
  /** 首屏可见图可设为 true，跳过错峰加载 */
  eager: { type: Boolean, default: false },
});

const imgRef = ref(null);
let observer = null;
let usingFallback = false;

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

function onImageError() {
  const el = imgRef.value;
  if (!el) return;
  const fb = fallbackSrc();
  if (fb && !usingFallback) {
    usingFallback = true;
    el.src = fb;
    return;
  }
  el.removeAttribute("src");
}

function loadNow() {
  const el = imgRef.value;
  const url = primarySrc() || fallbackSrc();
  if (!el || !url) return;
  usingFallback = !primarySrc() && !!fallbackSrc();
  if (el.src !== url) {
    el.onerror = onImageError;
    el.src = url;
  }
  teardown();
}

function isNearViewport(el) {
  const root = findScrollRoot(el);
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return true;
  const margin = 240;
  if (!root) {
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }
  const rootRect = root.getBoundingClientRect();
  return rect.bottom >= rootRect.top - margin && rect.top <= rootRect.bottom + margin;
}

async function setup() {
  teardown();
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
  () => [props.src, props.fallback, props.eager],
  () => {
    usingFallback = false;
    const el = imgRef.value;
    if (el) el.removeAttribute("src");
    setup();
  },
);
</script>
