<template>
  <div class="group-tabs">
    <button
      v-for="(group, index) in groups"
      :key="group.id ?? group.name ?? index"
      type="button"
      class="group-tab"
      :class="{ active: index === activeIndex }"
      @click="$emit('update:activeIndex', index)"
    >
      {{ displayCategoryGroupName(site, group.name, group.id) }}
    </button>
  </div>
</template>

<script setup>
import { displayCategoryGroupName } from "../utils/categoryDisplay.js";

defineProps({
  site: { type: String, required: true },
  groups: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: 0 },
});

defineEmits(["update:activeIndex"]);
</script>

<style scoped>
.group-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
  justify-content: center;
  padding: .35rem .5rem .65rem;
  border-bottom: 1px solid var(--chrome-border);
}

.group-tab {
  padding: .35rem .75rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: .82rem;
  cursor: pointer;
  transition: color .12s, background .12s;
}

.group-tab:hover {
  color: var(--text);
}

.group-tab.active {
  color: var(--amber);
  background: var(--primary-soft-10);
}
</style>
