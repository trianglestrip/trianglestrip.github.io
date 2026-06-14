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
        priority="low"
        root-margin="120px"
      />
      <p class="category-name">{{ categoryLabel(item) }}</p>
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
import LazyImage from "./LazyImage.vue";
import { DEFAULT_CATEGORY_ICON } from "../utils/categoryIcon.js";
import { displayCategoryName } from "../utils/categoryDisplay.js";

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

function categoryLabel(item) {
  if (props.cross) return displayCategoryName("huya", item.name, item.huyaCid || item.cid);
  return displayCategoryName(props.site, item.name, item.cid);
}
</script>

<style scoped>
.category-grid {
  display: grid;
  align-items: start;
  justify-content: start;
  gap: .5rem;
  padding: .5rem .65rem 1rem;
  grid-template-columns: repeat(auto-fill, calc(88px + .5rem));
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: .28rem;
  width: calc(88px + .5rem);
  padding: .25rem;
  box-sizing: border-box;
  color: var(--text);
  text-align: center;
  cursor: pointer;
}

.category-item:hover .category-name {
  color: var(--amber);
}

.category-item :deep(.lazy-image) {
  display: block;
  width: 88px;
  height: 88px;
  flex: 0 0 auto;
}

.category-item :deep(.lazy-image img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-icon {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  object-fit: cover;
  background: var(--dark-6);
  display: block;
}

.category-name {
  margin: 0;
  width: 100%;
  flex: 0 0 auto;
  color: var(--text);
  font-size: .72rem;
  line-height: 1.15;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-word;
}
</style>
