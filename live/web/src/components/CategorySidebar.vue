<template>
  <aside class="category-sidebar scrolly">
    <button
      type="button"
      class="cat-item cat-item--recommend"
      :class="{ active: !activeCid }"
      @click="$emit('select-recommend')"
    >
      推荐
    </button>

    <div v-if="loading" class="cat-loading">加载分类…</div>

    <template v-for="group in categories" :key="group.id ?? group.name">
      <p class="cat-group-title">{{ group.name }}</p>
      <button
        v-for="item in group.list || []"
        :key="`${item.cid}-${item.pid ?? ''}`"
        type="button"
        class="cat-item"
        :class="{ active: isActive(item) }"
        @click="$emit('select', item)"
      >
        <img v-if="item.pic" :src="item.pic" class="cat-icon" alt="">
        <span class="cat-name">{{ item.name }}</span>
      </button>
    </template>
  </aside>
</template>

<script setup>
const props = defineProps({
  categories: { type: Array, default: () => [] },
  activeCid: { type: [String, Number], default: "" },
  activePid: { type: [String, Number], default: "" },
  loading: { type: Boolean, default: false },
});

defineEmits(["select", "select-recommend"]);

function isActive(item) {
  if (String(item.cid) !== String(props.activeCid)) return false;
  if (props.activePid === "" || props.activePid == null) return true;
  return String(item.pid ?? "") === String(props.activePid);
}
</script>

<style scoped>
.category-sidebar {
  width: var(--category-width);
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
  padding: .5rem 0;
}

.cat-group-title {
  margin: .65rem .75rem .25rem;
  font-size: .72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .04em;
}

.cat-item {
  display: flex;
  align-items: center;
  gap: .45rem;
  width: 100%;
  padding: .45rem .75rem;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  font: inherit;
  font-size: .84rem;
  cursor: pointer;
  transition: background .12s, color .12s;
}

.cat-item:hover {
  background: rgba(255, 255, 255, .04);
}

.cat-item.active {
  background: rgba(243, 208, 78, .12);
  color: var(--lemon);
}

.cat-item--recommend {
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding-bottom: .55rem;
  margin-bottom: .15rem;
}

.cat-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.cat-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-loading {
  padding: .75rem;
  font-size: .8rem;
  color: var(--muted);
}
</style>
