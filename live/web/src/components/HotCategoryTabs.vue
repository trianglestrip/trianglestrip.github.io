<template>
  <div class="hot-category-tabs scrolly" role="tablist" aria-label="热门游戏">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      role="tab"
      class="hot-category-tab"
      :class="{ active: item.key === activeKey }"
      :aria-selected="item.key === activeKey"
      @click="$emit('select', item.key)"
    >
      {{ item.name }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  activeKey: { type: String, default: "" },
});

defineEmits(["select"]);
</script>

<style scoped>
.hot-category-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: .4rem;
  overflow-x: auto;
  padding: .5rem .5rem .65rem;
  border-bottom: 1px solid var(--chrome-border);
  scrollbar-width: thin;
}

.hot-category-tab {
  flex-shrink: 0;
  padding: .38rem .85rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: .84rem;
  font-weight: 500;
  cursor: pointer;
  transition: color .12s, background .12s;
}

.hot-category-tab:hover {
  color: var(--text);
  background: var(--bg-soft);
}

.hot-category-tab.active {
  color: var(--amber);
  background: var(--primary-soft-10);
}
</style>
