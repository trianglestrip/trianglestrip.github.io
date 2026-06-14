<template>
  <div class="category-grid">
    <RouterLink
      v-for="item in items"
      :key="itemKey(item)"
      :to="categoryLink(item)"
      class="category-item"
    >
      <LazyImage
        :src="item.pic"
        :fallback="defaultIcon"
        image-class="category-icon"
      />
      <p class="category-name">{{ item.name }}</p>
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
import LazyImage from "./LazyImage.vue";
import { DEFAULT_CATEGORY_ICON } from "../utils/categoryIcon.js";

const defaultIcon = DEFAULT_CATEGORY_ICON;

const props = defineProps({
  site: { type: String, required: true },
  items: { type: Array, default: () => [] },
  cross: { type: Boolean, default: false },
});

function itemKey(item) {
  if (props.cross) return item.key;
  return `${item.cid}-${item.pid ?? ""}`;
}

function categoryLink(item) {
  if (props.cross) {
    return {
      name: "all-category-rooms",
      params: { key: String(item.key || "") },
    };
  }
  const query = item.pid != null ? { pid: String(item.pid) } : undefined;
  return {
    name: "category-rooms",
    params: { site: props.site, cid: String(item.cid) },
    query,
  };
}
</script>

<style scoped>
.category-grid {
  display: grid;
  gap: .85rem .75rem;
  padding: .5rem .65rem 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (min-width: 640px) {
  .category-grid {
    gap: 1rem;
    padding: .5rem 1rem 1rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .category-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); padding-inline: .5rem; }
}

@media (min-width: 1024px) {
  .category-grid { grid-template-columns: repeat(10, minmax(0, 1fr)); }
}

@media (min-width: 1280px) {
  .category-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
}

.category-item {
  color: inherit;
  text-align: center;
  cursor: pointer;
}

.category-item:hover .category-name {
  color: var(--amber);
}

.category-icon {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  object-fit: cover;
  background: var(--dark-6);
  display: block;
}

.category-name {
  margin: .35rem 0 0;
  font-size: .8rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .category-name { font-size: .82rem; }
}
</style>
