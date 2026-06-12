<template>
  <svg
    class="ui-icon"
    :class="[`ui-icon--${name}`, { 'ui-icon--filled': filled }]"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    v-bind="$attrs"
  >
    <path :d="path" />
  </svg>
</template>

<script setup>
import { computed } from "vue";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  name: { type: String, required: true },
  filled: { type: Boolean, default: false },
});

const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z",
  apps: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  heart: "M12 20.5s-7-4.35-7-9.5a4 4 0 0 1 7-2.2 4 4 0 0 1 7 2.2c0 5.15-7 9.5-7 9.5Z",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm6.8 9.7 3.5 3.5-1.4 1.4-3.5-3.5 1.4-1.4Z",
  user: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z",
  "arrow-left": "M10.8 5.5 4.3 12l6.5 6.5 1.4-1.4-4.4-4.4H20v-2H7.8l4.4-4.4-1.4-1.2Z",
  play: "M8 5.5v13l11-6.5L8 5.5Z",
  pause: "M7 6h4v12H7V6Zm6 0h4v12h-4V6Z",
  refresh: "M12 4a8 8 0 0 1 7.4 5h-2.3A6 6 0 1 0 18 12h2a8 8 0 1 1-8-8Zm-1 2v4.5H6l1.8-1.8L6 7l5 1Z",
  chat: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm2 3v2h3V8H6Zm5 0v2h7V8h-7Z",
  pip: "M4 5h16v10H4V5Zm2 2v6h8v-4h4V7H6Zm10 6h2v2h-2v-2Z",
  "pip-exit": "M4 5h16v10H4V5Zm2 2v6h8v-4h4V7H6Zm8 4h4v4h-4v-4Z",
  webscreen: "M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4",
  fullscreen: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  "fullscreen-exit": "M9 4H4v5M20 9h-5V4M9 20H4v-5M20 15h-5v5",
  "play-circle": "M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-1.2 4.5v7l6.5-3.5-6.5-3.5Z",
  "volume-up": "M11 5 6 9H3v6h3l5 4V5Zm4.5 4.5a4.5 4.5 0 0 1 0 3M16.5 7.5a7.5 7.5 0 0 1 0 9",
  "volume-off": "M11 5 6 9H3v6h3l5 4V5Zm7-1.4-1.4 1.4M18 12l1.4 1.4M16.5 7.5 18 6",
  timer: "M12 8v5l3 1.5M12 3a9 9 0 1 0 9 9",
  delete: "M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9h2v11a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V9Z",
};

const path = computed(() => PATHS[props.name] || PATHS.home);
</script>

<style scoped>
.ui-icon {
  width: 1em;
  height: 1em;
  display: inline-block;
  vertical-align: -0.125em;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ui-icon--heart.ui-icon--filled,
.ui-icon--play,
.ui-icon--pause,
.ui-icon--play-circle {
  fill: currentColor;
  stroke: none;
}

.ui-icon--webscreen,
.ui-icon--fullscreen,
.ui-icon--fullscreen-exit {
  stroke-width: 2;
}
</style>
