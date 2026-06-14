<template>
  <div class="platform-tabs">
    <div v-if="!hideHeaders" class="tab-headers">
      <RouterLink
        v-for="platform in visiblePlatforms"
        :key="platform.id"
        :to="tabLink(platform)"
        class="tab-header"
        :class="{ active: platform.id === activeSite }"
      >
        {{ platform.tabLabel }}
      </RouterLink>
    </div>
    <div class="tab-body scrolly" :class="{ 'tab-body--full': hideHeaders }">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { PLATFORMS, supportsBrowse } from "../config/platforms";

const props = defineProps({
  activeSite: { type: String, required: true },
  categoryMode: { type: Boolean, default: false },
  hideHeaders: { type: Boolean, default: false },
});

const visiblePlatforms = computed(() => PLATFORMS.filter((p) => p.enabled));

function tabLink(platform) {
  if (props.categoryMode && supportsBrowse(platform.id)) return `/${platform.id}/category`;
  return `/${platform.id}`;
}
</script>

<style scoped>
.platform-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.tab-headers {
  display: flex;
  flex-wrap: nowrap;
  gap: .25rem;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 0 .25rem .35rem;
  border-bottom: 1px solid var(--chrome-border);
  font-size: .92rem;
  flex-shrink: 0;
}

.tab-header {
  flex: 1;
  min-width: 0;
  max-width: 9rem;
  padding: .45rem .35rem;
  text-align: center;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s;
}

.tab-header:hover:not(.disabled) {
  color: var(--text);
}

.tab-header.active {
  color: var(--amber);
  border-bottom-color: var(--amber);
}

.tab-header.disabled {
  opacity: .35;
  cursor: not-allowed;
}

.tab-body {
  flex: 1;
  min-height: 0;
  height: calc(100% - 2.4rem);
  padding-top: .35rem;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}

.platform-tabs--home {
  margin-top: 0;
}

.tab-body--full {
  height: 100%;
  padding: 0;
  margin: 0;
}
</style>
