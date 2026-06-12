<template>
  <div class="category-grid">
    <RouterLink
      v-for="item in items"
      :key="`${item.cid}-${item.pid ?? ''}`"
      :to="categoryLink(item)"
      class="category-item"
    >
      <img v-if="item.pic" :src="item.pic" class="category-icon" alt="" loading="lazy">
      <div v-else class="category-icon category-icon--empty">{{ item.name?.slice(0, 1) }}</div>
      <p class="category-name">{{ item.name }}</p>
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";

const props = defineProps({
  site: { type: String, required: true },
  items: { type: Array, default: () => [] },
});

function categoryLink(item) {
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
  gap: 1rem;
  padding: .5rem 1rem 1rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (min-width: 640px) {
  .category-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}

@media (min-width: 768px) {
  .category-grid { grid-template-columns: repeat(8, minmax(0, 1fr)); padding-inline: .5rem; }
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

.category-icon--empty {
  display: grid;
  place-items: center;
  font-size: 1.2rem;
  color: var(--amber);
}

.category-name {
  margin: .35rem 0 0;
  font-size: .72rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .category-name { font-size: .82rem; }
}
</style>
