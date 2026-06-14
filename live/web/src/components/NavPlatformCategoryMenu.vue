<template>
  <div
    class="nav-platform-menu"
    :class="{
      'nav-platform-menu--cross': isCrossSite,
      'nav-platform-menu--embedded': embedded,
      'nav-platform-menu--dense': isCompactNav,
    }"
    :role="embedded ? 'region' : 'tooltip'"
    @mouseenter="!embedded && $emit('pointerenter')"
    @mouseleave="!embedded && $emit('pointerleave')"
  >
    <p v-if="loading" class="nav-platform-menu__hint">加载分类…</p>
    <p v-else-if="error" class="nav-platform-menu__hint nav-platform-menu__hint--err">{{ error }}</p>
    <template v-else-if="isCrossSite">
      <div class="nav-platform-menu__hot scrolly">
        <RouterLink
          v-for="item in crossItems"
          :key="item.key"
          :to="crossLink(item)"
          class="nav-platform-menu__hot-item"
          :class="{ active: item.key === activeCrossKey }"
          @click="onNavigate"
        >
          {{ item.name }}
        </RouterLink>
      </div>
    </template>
    <template v-else-if="sections.length">
      <div class="nav-platform-menu__columns scrolly">
        <div
          v-for="section in sections"
          :key="section.id"
          class="nav-platform-menu__column"
        >
          <p class="nav-platform-menu__column-title" :title="section.name">
            {{ isCompactNav ? section.short : section.name }}
          </p>
          <div class="nav-platform-menu__items">
            <RouterLink
              v-for="item in section.items"
              :key="`${item.cid}-${item.pid ?? ''}`"
              :to="categoryLink(item)"
              class="nav-platform-menu__item"
              :title="item.name"
              @click="onNavigate"
            >
              {{ item.name }}
            </RouterLink>
          </div>
        </div>
      </div>
    </template>
    <p v-else class="nav-platform-menu__hint">暂无分类</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { supportsBrowse, supportsCrossBrowse } from "../config/platforms.js";
import {
  buildCategorySections,
  normalizeBrowseCategoryGroups,
} from "../utils/drawerCategories.js";
import { fetchCategories } from "../api/browse.js";
import { fetchHotCategories } from "../api/crossBrowse.js";

const props = defineProps({
  platformId: { type: String, required: true },
  embedded: { type: Boolean, default: false },
});

const emit = defineEmits(["pointerenter", "pointerleave", "navigate"]);

const route = useRoute();
const loading = ref(false);
const error = ref("");
const sections = ref([]);
const crossItems = ref([]);

const categoryCache = new Map();
const hotCache = { data: null, promise: null };

const isCrossSite = computed(() => props.platformId === "all");
const isCompactNav = computed(() => props.platformId === "douyin" && !props.embedded);
const activeCrossKey = computed(() => {
  if (route.name === "all-category-rooms") {
    return String(route.params.key || "").trim();
  }
  return "";
});

function categoryLink(item) {
  const query = item.pid != null ? { pid: String(item.pid) } : undefined;
  return {
    name: "category-rooms",
    params: { site: props.platformId, cid: String(item.cid) },
    query,
  };
}

function crossLink(item) {
  return {
    name: "all-category-rooms",
    params: { key: String(item.key || "") },
  };
}

function onNavigate() {
  if (props.embedded) emit("navigate");
}

async function loadSections(platformId) {
  if (categoryCache.has(platformId)) {
    sections.value = categoryCache.get(platformId);
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchCategories(platformId);
    const groups = normalizeBrowseCategoryGroups(data.categories || [], platformId);
    const built = buildCategorySections(groups, platformId);
    categoryCache.set(platformId, built);
    sections.value = built;
  } catch (err) {
    sections.value = [];
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadHot() {
  if (hotCache.data) {
    crossItems.value = hotCache.data;
    return;
  }
  if (!hotCache.promise) {
    hotCache.promise = fetchHotCategories()
      .then((data) => (data.categories || []).map((item) => ({
        key: item.key,
        name: item.name,
      })))
      .finally(() => {
        hotCache.promise = null;
      });
  }
  loading.value = true;
  error.value = "";
  try {
    const items = await hotCache.promise;
    hotCache.data = items;
    crossItems.value = items;
  } catch (err) {
    crossItems.value = [];
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadMenu() {
  const platformId = props.platformId;
  if (platformId === "all") {
    if (!supportsCrossBrowse("all")) return;
    await loadHot();
    return;
  }
  if (!supportsBrowse(platformId)) return;
  await loadSections(platformId);
}

watch(
  () => props.platformId,
  () => {
    void loadMenu();
  },
  { immediate: true },
);
</script>

<style scoped>
.nav-platform-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  z-index: 20;
  transform: translateX(-50%);
  min-width: 12rem;
  max-width: min(92vw, 56rem);
  max-height: min(70dvh, 26rem);
  padding: .55rem .6rem .6rem;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .38);
}

.nav-platform-menu::before {
  content: "";
  position: absolute;
  top: -8px;
  left: 0;
  width: 100%;
  height: 8px;
}

.nav-platform-menu__hint {
  margin: 0;
  padding: .35rem .2rem;
  font-size: .78rem;
  color: var(--muted);
  text-align: center;
}

.nav-platform-menu__hint--err {
  color: var(--danger);
}

.nav-platform-menu__columns {
  display: flex;
  flex-wrap: nowrap;
  gap: .35rem;
  overflow-x: auto;
  scrollbar-width: thin;
}

.nav-platform-menu__column {
  flex: 0 0 auto;
  width: 5.5rem;
  min-width: 0;
}

.nav-platform-menu--dense .nav-platform-menu__column {
  width: 6.75rem;
}

.nav-platform-menu--dense {
  padding: .4rem .4rem .45rem;
}

.nav-platform-menu--dense .nav-platform-menu__columns {
  scrollbar-width: none;
}

.nav-platform-menu--dense .nav-platform-menu__columns::-webkit-scrollbar {
  display: none;
}

.nav-platform-menu__column-title {
  margin: 0 0 .28rem;
  padding: 0 .06rem .28rem;
  border-bottom: 1px solid var(--chrome-border);
  font-size: .78rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-platform-menu--dense .nav-platform-menu__column-title {
  font-size: .72rem;
  text-align: center;
  padding-inline: 0;
}

.nav-platform-menu__items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.nav-platform-menu__item {
  display: block;
  margin: 0;
  min-width: 0;
  padding: .14rem .06rem;
  border-radius: 4px;
  color: var(--text);
  font-size: .76rem;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color .12s, background .12s;
}

.nav-platform-menu--dense .nav-platform-menu__item {
  font-size: .74rem;
  padding: .12rem .06rem;
}

.nav-platform-menu__item:hover {
  color: var(--amber);
  background: var(--sidebar-chip-hover-bg);
}

.nav-platform-menu__hot {
  display: grid;
  grid-template-columns: repeat(3, minmax(4.75rem, 1fr));
  gap: 0;
  max-height: min(60dvh, 22rem);
  overflow-y: auto;
  scrollbar-width: thin;
}

.nav-platform-menu--cross {
  min-width: 14rem;
  width: auto;
  max-width: min(92vw, 22rem);
  padding: .45rem .5rem .45rem;
}

.nav-platform-menu__hot-item {
  display: block;
  margin: 0;
  padding: .16rem .14rem;
  border-radius: 4px;
  color: var(--text);
  font-size: .76rem;
  font-weight: 400;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color .12s, background .12s;
}

.nav-platform-menu__hot-item:hover {
  color: var(--amber);
  background: var(--sidebar-chip-hover-bg);
}

.nav-platform-menu--embedded {
  position: static;
  transform: none;
  min-width: 0;
  max-width: none;
  width: 100%;
  max-height: none;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: .45rem .55rem .65rem;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.nav-platform-menu--embedded::before {
  display: none;
}

.nav-platform-menu--embedded .nav-platform-menu__columns,
.nav-platform-menu--embedded .nav-platform-menu__hot {
  flex: 1;
  min-height: 0;
  max-height: none;
}

.nav-platform-menu--embedded.nav-platform-menu--cross {
  min-width: 0;
  max-width: none;
  padding-inline: .55rem;
}

.nav-platform-menu--embedded .nav-platform-menu__hot {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .12rem .2rem;
}

.nav-platform-menu--embedded .nav-platform-menu__item,
.nav-platform-menu--embedded .nav-platform-menu__hot-item {
  padding: .28rem .2rem;
  font-size: .82rem;
}

.nav-platform-menu__hot-item.active {
  color: var(--amber);
  background: var(--sidebar-chip-hover-bg);
}
</style>
