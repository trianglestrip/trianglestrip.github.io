<template>
  <button
    v-if="eligible"
    type="button"
    class="directory-drawer__toggle"
    :class="{ 'directory-drawer__toggle--open': open }"
    :title="open ? '收起' : '展开分类'"
    :aria-label="open ? '收起分类' : '展开分类'"
    @click="open ? $emit('close') : $emit('open')"
  >
    <Icon :name="open ? 'chevron-left' : 'chevron-right'" />
  </button>

  <aside
    class="directory-drawer"
    :class="{ 'directory-drawer--open': open && eligible }"
    aria-label="分类导航"
  >
    <div
      class="directory-drawer__follow-wrap"
      @mouseenter="followHover = true"
      @mouseleave="followHover = false"
    >
      <RouterLink
        v-if="open"
        to="/follow"
        class="directory-drawer__follow"
      >
        <Icon name="heart" class="directory-drawer__follow-icon" />
        <span>我的关注</span>
      </RouterLink>
      <RouterLink
        v-else
        to="/follow"
        class="directory-drawer__rail-follow"
        title="我的关注"
      >
        <Icon name="heart" class="directory-drawer__follow-icon" />
      </RouterLink>
      <div
        v-if="followHover"
        class="directory-drawer__follow-flyout scrolly"
        role="tooltip"
        @mouseenter="followHover = true"
        @mouseleave="followHover = false"
      >
        <p class="directory-drawer__flyout-title">开播中</p>
        <p v-if="!liveFollows.length" class="directory-drawer__flyout-empty">暂无开播</p>
        <FollowPreviewGrid
          v-else
          drawer
          :show-stats="false"
          :rooms="liveFollows"
          @select="onDrawerFollowSelect"
        />
      </div>
    </div>

    <template v-if="open">
      <div class="directory-drawer__platform-tabs" role="tablist" aria-label="平台">
        <button
          v-for="platform in enabledPlatforms"
          :key="platform.id"
          type="button"
          role="tab"
          class="directory-drawer__platform-tab"
          :class="{
            'directory-drawer__platform-tab--active': platform.id === drawerSite,
            'directory-drawer__platform-tab--all': platform.id === 'all',
          }"
          :title="platform.label"
          :aria-label="platform.label"
          :aria-selected="platform.id === drawerSite"
          @click="drawerSite = platform.id"
        >
          <PlatformIcon v-if="platform.id !== 'all'" :id="platform.id" size="md" />
          <span v-else class="directory-drawer__platform-all">
            <Icon name="apps" class="directory-drawer__platform-all-icon" />
          </span>
        </button>
      </div>

      <div class="directory-drawer__body scrolly">
        <p v-if="!browseEnabled" class="directory-drawer__hint">该平台暂无分类</p>
        <p v-else-if="drawerLoading" class="directory-drawer__hint">加载分类…</p>
        <p v-else-if="drawerError" class="directory-drawer__hint directory-drawer__hint--err">{{ drawerError }}</p>
        <template v-else>
          <template v-if="isCrossDrawer">
            <div v-if="crossDrawerItems.length" class="directory-drawer__cat-grid">
              <RouterLink
                v-for="item in crossDrawerItems"
                :key="drawerItemKey(item)"
                :to="categoryLink(item)"
                class="directory-drawer__cat-item"
                :title="item.name"
              >
                <span class="directory-drawer__cat-name">{{ item.name }}</span>
              </RouterLink>
            </div>
            <p v-else class="directory-drawer__hint">暂无分类数据</p>
          </template>
          <template v-else>
            <section
              v-for="section in drawerSections"
              :key="section.id"
              class="directory-drawer__section"
            >
              <h3 class="directory-drawer__section-title">{{ section.name }}</h3>
              <div class="directory-drawer__cat-grid">
                <RouterLink
                  v-for="item in section.items"
                  :key="drawerItemKey(item)"
                  :to="categoryLink(item)"
                  class="directory-drawer__cat-item"
                  :title="item.name"
                >
                  <span class="directory-drawer__cat-name">{{ item.name }}</span>
                </RouterLink>
              </div>
            </section>
            <p v-if="!drawerSections.length" class="directory-drawer__hint">暂无分类数据</p>
          </template>
        </template>
      </div>
    </template>

    <template v-else>
      <div class="directory-drawer__rail-main">
        <div class="directory-drawer__rail-platforms" role="tablist" aria-label="平台">
          <div
            v-for="platform in enabledPlatforms"
            :key="platform.id"
            class="directory-drawer__rail-platform-wrap"
            @mouseenter="onRailPlatformEnter(platform.id)"
            @mouseleave="onRailPlatformLeave"
          >
            <button
              type="button"
              role="tab"
              class="directory-drawer__rail-platform"
              :class="{
                'directory-drawer__rail-platform--active': platform.id === drawerSite,
                'directory-drawer__rail-platform--all': platform.id === 'all',
              }"
              :title="platform.label"
              :aria-label="platform.label"
              :aria-selected="platform.id === drawerSite"
              @click="drawerSite = platform.id"
            >
              <PlatformIcon v-if="platform.id !== 'all'" :id="platform.id" size="md" />
              <span v-else class="directory-drawer__platform-all">
                <Icon name="apps" class="directory-drawer__platform-all-icon" />
              </span>
            </button>
            <div
              v-if="platform.id === 'all' && hoveredRailPlatform === 'all'"
              class="directory-drawer__cat-flyout directory-drawer__cat-flyout--cross scrolly"
              role="tooltip"
              @mouseenter="onRailPlatformEnter('all')"
              @mouseleave="onRailPlatformLeave"
            >
              <p v-if="crossFlyoutLoading" class="directory-drawer__rail-hint">加载分类…</p>
              <p v-else-if="crossFlyoutError" class="directory-drawer__hint directory-drawer__hint--err">{{ crossFlyoutError }}</p>
              <div v-else-if="crossDrawerItems.length" class="directory-drawer__cat-grid">
                <RouterLink
                  v-for="item in crossDrawerItems"
                  :key="drawerItemKey(item)"
                  :to="categoryLink(item)"
                  class="directory-drawer__cat-item"
                  :title="item.name"
                >
                  <span class="directory-drawer__cat-name">{{ item.name }}</span>
                </RouterLink>
              </div>
              <p v-else class="directory-drawer__rail-hint">暂无分类数据</p>
            </div>
          </div>
        </div>

        <div v-if="!isCrossDrawer" class="directory-drawer__rail-body">
          <p v-if="!browseEnabled" class="directory-drawer__rail-hint">—</p>
          <p v-else-if="drawerLoading" class="directory-drawer__rail-hint">…</p>
          <template v-else>
            <div
              v-for="section in drawerSections"
              :key="section.id"
              class="directory-drawer__rail-section"
              @mouseenter="hoveredSection = section.id"
              @mouseleave="hoveredSection = ''"
            >
              <span class="directory-drawer__rail-label">{{ section.short }}</span>
              <div
                v-if="hoveredSection === section.id"
                class="directory-drawer__cat-flyout scrolly"
                role="tooltip"
                @mouseenter="hoveredSection = section.id"
                @mouseleave="hoveredSection = ''"
              >
                <p class="directory-drawer__cat-flyout-title">{{ section.name }}</p>
                <div class="directory-drawer__cat-grid">
                  <RouterLink
                    v-for="item in section.items"
                    :key="drawerItemKey(item)"
                    :to="categoryLink(item)"
                    class="directory-drawer__cat-item"
                    :title="item.name"
                  >
                    <span class="directory-drawer__cat-name">{{ item.name }}</span>
                  </RouterLink>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import Icon from "./Icon.vue";
import PlatformIcon from "./PlatformIcon.vue";
import FollowPreviewGrid from "./FollowPreviewGrid.vue";
import { PLATFORMS, supportsBrowse, supportsCrossBrowse } from "../config/platforms.js";
import {
  buildCategorySections,
  normalizeBrowseCategoryGroups,
} from "../utils/drawerCategories.js";
import { fetchHotCategories } from "../api/crossBrowse.js";
import { useBrowse } from "../composables/useBrowse.js";
import { useFollow } from "../composables/useFollow.js";
import { useFollowStatus } from "../composables/useFollowStatus.js";

const DRAWER_ITEMS_PER_SECTION = 18;

function buildNativeDrawerSections(groups, site) {
  return buildCategorySections(groups, site, DRAWER_ITEMS_PER_SECTION);
}

const props = defineProps({
  open: { type: Boolean, default: false },
  eligible: { type: Boolean, default: false },
  initialSite: { type: String, default: "douyu" },
});

defineEmits(["close", "open"]);

const router = useRouter();
const drawerSite = ref(props.initialSite || "douyu");
const followHover = ref(false);
const hoveredSection = ref("");
const hoveredRailPlatform = ref("");
const drawerActive = computed(() => props.eligible);
const isCrossDrawer = computed(() => drawerSite.value === "all");
const browseSiteRef = computed(() => (isCrossDrawer.value ? "douyu" : drawerSite.value));

const enabledPlatforms = computed(() =>
  PLATFORMS.filter((p) => p.enabled && (p.crossBrowse || supportsBrowse(p.id))),
);
const browseEnabled = computed(() =>
  isCrossDrawer.value ? supportsCrossBrowse("all") : supportsBrowse(drawerSite.value),
);

const hotCategories = ref([]);
const loadingHot = ref(false);
const hotError = ref("");

const { follows } = useFollow();
const { sortedFollows, refresh: refreshFollowStatus } = useFollowStatus(follows, {
  active: drawerActive,
  pollInterval: 90000,
});

const liveFollows = computed(() =>
  sortedFollows.value.filter((room) => room.state === "live"),
);

const {
  categories,
  loadingCategories,
  listError,
  loadCategories,
} = useBrowse(browseSiteRef);

const drawerLoading = computed(() =>
  isCrossDrawer.value ? loadingHot.value : loadingCategories.value,
);
const drawerError = computed(() =>
  isCrossDrawer.value ? hotError.value : listError.value,
);
const crossFlyoutLoading = computed(() => loadingHot.value);
const crossFlyoutError = computed(() => hotError.value);

async function loadHotCategories() {
  loadingHot.value = true;
  hotError.value = "";
  try {
    const data = await fetchHotCategories();
    hotCategories.value = data.categories || [];
  } catch (err) {
    hotCategories.value = [];
    hotError.value = err.message;
  } finally {
    loadingHot.value = false;
  }
}

const crossDrawerItems = computed(() =>
  (hotCategories.value || []).map((item) => ({
    key: item.key,
    name: item.name,
  })),
);

const drawerSections = computed(() => {
  const site = drawerSite.value;
  const groups = normalizeBrowseCategoryGroups(categories.value || [], site);
  return buildNativeDrawerSections(groups, site);
});

function drawerItemKey(item) {
  if (item.key != null) return item.key;
  return `${item.cid}-${item.pid ?? ""}`;
}

function onRailPlatformEnter(platformId) {
  hoveredRailPlatform.value = platformId;
  if (platformId === "all" && supportsCrossBrowse("all")) {
    void loadHotCategories();
  }
}

function onRailPlatformLeave() {
  hoveredRailPlatform.value = "";
}

function categoryLink(item) {
  if (item.key != null) {
    return {
      name: "all-category-rooms",
      params: { key: String(item.key || "") },
    };
  }
  const query = item.pid != null ? { pid: String(item.pid) } : undefined;
  return {
    name: "category-rooms",
    params: { site: drawerSite.value, cid: String(item.cid) },
    query,
  };
}

function onDrawerFollowSelect(room) {
  if (!room.site || !room.id) return;
  router.push({ name: "play", params: { site: room.site, id: room.id } });
}

watch(
  () => props.initialSite,
  (site) => {
    if (site) drawerSite.value = site;
  },
);

watch(
  drawerActive,
  (active) => {
    if (active && supportsCrossBrowse("all")) {
      void loadHotCategories();
    }
  },
  { immediate: true },
);

watch(
  [drawerSite, drawerActive],
  ([site, active]) => {
    if (!active) return;
    hoveredSection.value = "";
    hoveredRailPlatform.value = "";
    if (site === "all") {
      if (!supportsCrossBrowse("all")) return;
      void loadHotCategories();
    } else if (supportsBrowse(site)) {
      void loadCategories();
    }
    refreshFollowStatus();
  },
  { immediate: true },
);
</script>

<style scoped>
.directory-drawer,
.directory-drawer__toggle {
  --drawer-accent: var(--primary);
  --drawer-accent-35: var(--primary-border);
  --drawer-accent-14: var(--primary-soft);
  --drawer-accent-10: var(--primary-soft);
}

.directory-drawer {
  position: fixed;
  top: var(--nav-chrome-height, var(--nav-height));
  left: 0;
  z-index: 11;
  display: flex;
  flex-direction: column;
  width: var(--directory-rail-width);
  height: calc(var(--app-height) - var(--nav-chrome-height, var(--nav-height)));
  border-right: 1px solid var(--chrome-border);
  box-shadow: 4px 0 16px rgba(0, 0, 0, .18);
  overflow: visible;
  transition: width .22s ease, box-shadow .22s ease;
}

.directory-drawer--open {
  width: var(--directory-drawer-width);
  box-shadow: 8px 0 24px rgba(0, 0, 0, .28);
}

.directory-drawer__toggle {
  position: fixed;
  top: calc(var(--nav-chrome-height, var(--nav-height)) + (var(--app-height) - var(--nav-chrome-height, var(--nav-height))) / 2);
  left: var(--directory-rail-width);
  z-index: 12;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 2.6rem;
  padding: 0;
  border: 1px solid var(--chrome-border);
  border-left: none;
  border-radius: 0 6px 6px 0;
  color: var(--muted);
  font-size: .82rem;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
  transition: left .22s ease, color .15s, background .15s, border-color .15s;
}

.directory-drawer__toggle--open {
  left: var(--directory-drawer-width);
}

.directory-drawer__toggle:hover {
  color: var(--drawer-accent);
  background: var(--bg-soft);
  border-color: var(--drawer-accent-35);
}

.directory-drawer__follow-wrap {
  position: relative;
  flex-shrink: 0;
  border-bottom: 1px solid var(--chrome-border);
}

.directory-drawer__follow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  padding: .5rem 0;
  color: var(--text);
  font-size: .9rem;
  font-weight: 600;
  transition: color .15s, background .15s;
}

.directory-drawer__follow:hover {
  color: var(--drawer-accent);
  background: transparent;
}

.directory-drawer__follow-icon {
  font-size: 1.75rem;
  color: var(--drawer-accent);
  line-height: 1;
}

.directory-drawer__follow-flyout {
  position: absolute;
  top: 0;
  left: 100%;
  z-index: 12;
  width: 16.5rem;
  max-width: 16.5rem;
  max-height: min(70vh, 28rem);
  overflow-y: auto;
  overflow-x: hidden;
  padding: .3rem .32rem .32rem;
  text-align: left;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
}

.directory-drawer__follow-flyout::before {
  content: "";
  position: absolute;
  top: 0;
  left: -10px;
  width: 10px;
  height: 100%;
}

.directory-drawer__flyout-title {
  margin: 0;
  padding: .35rem .38rem .3rem;
  border-bottom: 1px solid var(--chrome-border);
  font-size: .72rem;
  font-weight: 600;
  color: var(--muted);
}

.directory-drawer__flyout-empty {
  margin: 0;
  padding: .25rem 0;
  font-size: .78rem;
  color: var(--muted);
  text-align: left;
}

.directory-drawer__platform-tabs {
  display: flex;
  flex-shrink: 0;
  justify-content: stretch;
  gap: .35rem;
  padding: .45rem .35rem;
  border-bottom: 1px solid var(--chrome-border);
}

.directory-drawer__platform-tab {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: .35rem .25rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
}

.directory-drawer__platform-tab:hover {
  background: transparent;
}

.directory-drawer__platform-tab--active {
  border-color: var(--primary);
  background: var(--sidebar-chip-active-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 55%, transparent);
}

.directory-drawer__platform-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  flex-shrink: 0;
}

.directory-drawer__platform-all-icon {
  font-size: 1.35rem;
  line-height: 1;
  color: var(--text);
}

.directory-drawer__body {
  flex: 1;
  min-height: 0;
  padding: .45rem .55rem .75rem;
}

.directory-drawer__hint {
  margin: 0;
  padding: .75rem .25rem;
  text-align: center;
  font-size: .78rem;
  color: var(--muted);
}

.directory-drawer__hint--err {
  color: var(--danger);
}

.directory-drawer__section + .directory-drawer__section {
  margin-top: .65rem;
}

.directory-drawer__section-title {
  margin: 0 0 .35rem;
  padding-left: .15rem;
  font-size: .76rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: .02em;
}

.directory-drawer__cat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .28rem .22rem;
}

.directory-drawer__cat-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 1.45rem;
  padding: .08rem .22rem;
  border-radius: 4px;
  color: inherit;
  background: var(--sidebar-chip-bg);
  transition: color .12s, background .12s;
}

.directory-drawer__cat-item:hover {
  color: var(--drawer-accent);
  background: var(--sidebar-chip-hover-bg);
}

.directory-drawer__cat-name {
  width: 100%;
  font-size: .76rem;
  line-height: 1.2;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-drawer__rail-follow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: .5rem 0;
  color: var(--drawer-accent);
  transition: background .15s;
}

.directory-drawer__rail-follow:hover {
  background: transparent;
}

.directory-drawer__rail-platforms {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-bottom: 1px solid var(--chrome-border);
}

.directory-drawer__rail-platform-wrap {
  position: relative;
  flex-shrink: 0;
}

.directory-drawer__rail-platform {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: .5rem 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
}

.directory-drawer__rail-platform:hover {
  background: transparent;
}

.directory-drawer__rail-platform--active {
  border-color: var(--primary);
  background: var(--sidebar-chip-active-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 55%, transparent);
}

.directory-drawer__rail-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.directory-drawer__cat-flyout--cross {
  top: 0;
  width: calc(var(--directory-drawer-width) - var(--directory-rail-width) + 3.5rem);
}

.directory-drawer__rail-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.directory-drawer__rail-hint {
  margin: 0;
  padding: .6rem 0;
  text-align: center;
  font-size: .72rem;
  color: var(--muted);
}

.directory-drawer__rail-section {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.65rem;
  padding: .62rem 2px;
  border-bottom: 1px solid var(--chrome-border);
  cursor: default;
}

.directory-drawer__rail-section:last-child {
  border-bottom: none;
}

.directory-drawer__rail-label {
  font: inherit;
  font-size: .84rem;
  font-weight: 500;
  line-height: 1;
  color: var(--text);
  text-align: center;
  white-space: nowrap;
  transition: color .15s;
}

.directory-drawer__rail-section:hover .directory-drawer__rail-label {
  color: var(--drawer-accent);
}

.directory-drawer__cat-flyout {
  position: absolute;
  top: 0;
  left: 100%;
  z-index: 12;
  width: calc(var(--directory-drawer-width) - var(--directory-rail-width) + 3.5rem);
  min-width: 13rem;
  max-height: min(70vh, 24rem);
  overflow-y: auto;
  padding: .45rem .5rem;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
}

.directory-drawer__cat-flyout::before {
  content: "";
  position: absolute;
  top: 0;
  left: -10px;
  width: 10px;
  height: 100%;
}

.directory-drawer__cat-flyout-title {
  margin: 0 0 .35rem;
  padding-bottom: .3rem;
  border-bottom: 1px solid var(--chrome-border);
  font-size: .72rem;
  font-weight: 600;
  color: var(--muted);
}
</style>
