<template>
  <template v-for="platform in PLATFORMS" :key="platform.id">
    <RouterLink
      v-if="platform.enabled"
      :to="watchLink(platform)"
      class="nav-tab"
      :class="{ active: platform.id === activeSite }"
    >
      {{ platform.tabLabel }}
    </RouterLink>
    <span
      v-else
      class="nav-tab disabled"
      :title="platform.description"
    >
      {{ platform.tabLabel }}
    </span>
  </template>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { PLATFORMS } from "../config/platforms";

defineProps({
  activeSite: { type: String, default: "" },
});

function watchLink(platform) {
  return {
    name: "watch",
    params: { site: platform.id, room: platform.defaultRoom || undefined },
  };
}
</script>

<style scoped>
.nav-tab {
  display: inline-flex;
  align-items: center;
  height: 52px;
  padding: 0 1rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted);
  text-decoration: none;
  font: inherit;
  font-size: .92rem;
  white-space: nowrap;
  transition: color .15s, border-color .15s;
  cursor: pointer;
}

.nav-tab:hover:not(.disabled) {
  color: var(--text);
}

.nav-tab.active {
  color: var(--lemon);
  border-bottom-color: var(--lemon);
}

.nav-tab.disabled {
  opacity: .4;
  cursor: not-allowed;
}
</style>
