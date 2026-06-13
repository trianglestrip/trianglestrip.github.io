<template>
  <i
    class="ui-icon"
    :class="iconClasses"
    aria-hidden="true"
    v-bind="$attrs"
  />
</template>

<script setup>
import { computed } from "vue";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  name: { type: String, required: true },
  filled: { type: Boolean, default: false },
});

const FA_ICONS = {
  home: "fa-house",
  apps: "fa-table-cells",
  heart: "fa-heart",
  search: "fa-magnifying-glass",
  user: "fa-user",
  users: "fa-users",
  "arrow-left": "fa-arrow-left",
  play: "fa-play",
  pause: "fa-pause",
  refresh: "fa-arrows-rotate",
  subtitles: "fa-closed-captioning",
  chat: "fa-comment",
  pip: "fa-clone",
  "pip-exit": "fa-down-left-and-up-right-to-center",
  webscreen: "fa-up-right-and-down-left-from-center",
  fullscreen: "fa-expand",
  "fullscreen-exit": "fa-compress",
  "play-circle": "fa-circle-play",
  "volume-up": "fa-volume-high",
  "volume-off": "fa-volume-xmark",
  timer: "fa-clock",
  "timer-outline": "fa-clock",
  eye: "fa-eye",
  "eye-off": "fa-eye-slash",
  list: "fa-list",
  delete: "fa-trash-can",
  close: "fa-xmark",
  star: "fa-star",
  film: "fa-film",
  sun: "fa-sun",
  moon: "fa-moon",
};

const OUTLINE_WHEN_EMPTY = new Set(["star", "heart", "timer-outline"]);

const iconClasses = computed(() => {
  const fa = FA_ICONS[props.name] || FA_ICONS.home;
  const style = OUTLINE_WHEN_EMPTY.has(props.name) && !props.filled ? "fa-regular" : "fa-solid";
  return [style, fa];
});
</script>

<style scoped>
.ui-icon {
  width: 1em;
  height: 1em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: inherit;
  line-height: 1;
  vertical-align: -0.05em;
}
</style>
