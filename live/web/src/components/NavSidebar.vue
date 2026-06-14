<template>
  <nav
    class="nav-sidebar"
    :class="{ 'nav-sidebar--home': showCenterPlatforms }"
    aria-label="主导航"
  >
    <div class="nav-group nav-group--top">
      <RouterLink
        v-for="item in topItems"
        :key="item.link"
        :to="item.link"
        class="nav-item"
        :class="{ active: isActive(item) }"
        :title="item.title"
      >
        <Icon :name="item.icon" aria-hidden="true" />
        <span class="nav-label">{{ item.title }}</span>
      </RouterLink>
    </div>

    <div v-if="showCenterPlatforms" class="nav-group nav-group--center" role="tablist" aria-label="平台">
      <RouterLink
        v-for="platform in navPlatforms"
        :key="platform.id"
        :to="platformNavLink(platform.id)"
        role="tab"
        class="nav-platform-tab"
        :class="{ active: platform.id === site }"
        :aria-selected="platform.id === site"
      >
        <PlatformIcon :id="platform.id" size="sm" />
        <span class="nav-platform-label">{{ platform.label }}</span>
      </RouterLink>
    </div>

    <div class="nav-group nav-group--bottom">
      <button
        type="button"
        class="nav-item nav-theme"
        :title="theme === 'dark' ? '切换浅色模式' : '切换深色模式'"
        :aria-label="theme === 'dark' ? '切换浅色模式' : '切换深色模式'"
        @click="onToggleTheme"
      >
        <Icon :name="theme === 'dark' ? 'sun' : 'moon'" aria-hidden="true" />
        <span class="nav-label">{{ theme === 'dark' ? '浅色' : '深色' }}</span>
      </button>
      <AccentColorPicker />
      <button
        type="button"
        class="nav-item"
        title="搜索"
        aria-label="搜索进房"
        @click="onOpenSearch"
      >
        <Icon name="search" aria-hidden="true" />
        <span class="nav-label">搜索</span>
      </button>
      <RouterLink
        v-for="item in bottomItems"
        :key="item.link"
        :to="item.link"
        class="nav-item"
        :class="{ active: isActive(item) }"
        :title="item.title"
      >
        <Icon :name="item.icon" aria-hidden="true" />
        <span class="nav-label">{{ item.title }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { PLATFORMS, supportsBrowse } from "../config/platforms";
import { getTheme, toggleTheme } from "../utils/theme.js";
import { useSearchDialog } from "../composables/useSearchDialog.js";
import AccentColorPicker from "./AccentColorPicker.vue";
import Icon from "./Icon.vue";
import PlatformIcon from "./PlatformIcon.vue";

const props = defineProps({
  site: { type: String, default: "douyu" },
});

const route = useRoute();
const theme = ref("dark");
const { openSearch } = useSearchDialog();

const showCenterPlatforms = computed(
  () => route.name === "site-home" || route.name === "category-index" || route.name === "category-rooms",
);

const categoryNavMode = computed(
  () => route.name === "category-index" || route.name === "category-rooms",
);

function platformNavLink(platformId) {
  if (categoryNavMode.value && supportsBrowse(platformId)) {
    return `/${platformId}/category`;
  }
  return `/${platformId}`;
}

onMounted(() => {
  theme.value = getTheme();
});

function onToggleTheme() {
  theme.value = toggleTheme();
}

function onOpenSearch() {
  openSearch(props.site || "douyu");
}

const navPlatforms = computed(() => PLATFORMS.filter((p) => p.enabled));

const allItems = computed(() => {
  const site = props.site || "douyu";
  const list = [
    { icon: "home", link: `/${site}`, title: "首页", zone: "top" },
    { icon: "apps", link: `/${site}/category`, title: "分类", browse: true, zone: "top" },
    { icon: "heart", link: "/follow", title: "关注", zone: "top" },
  ];
  return list.filter((item) => item.browse !== true || supportsBrowse(site));
});

const topItems = computed(() => allItems.value.filter((item) => item.zone === "top"));
const bottomItems = computed(() => allItems.value.filter((item) => item.zone === "bottom"));

function isActive(item) {
  if (item.link === "/follow") {
    return route.path === item.link;
  }
  if (item.link.endsWith("/category")) {
    return route.path.includes("/category");
  }
  const site = props.site || "douyu";
  return route.path === `/${site}` || route.path === `/${site}/`;
}
</script>

<style scoped>
.nav-sidebar {
  position: fixed;
  z-index: 10;
  top: auto;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--nav-height);
  padding: 0 .35rem;
  border-top: 1px solid var(--chrome-border);
  border-bottom: none;
  background: var(--dark-7);
}

.nav-sidebar--home {
  position: relative;
}

.nav-group {
  display: flex;
  align-items: center;
}

.nav-group--top {
  flex: 1;
  justify-content: center;
  gap: .15rem;
}

.nav-sidebar--home .nav-group--top {
  flex: 0 1 auto;
  justify-content: flex-start;
}

.nav-group--center {
  display: none;
  gap: .15rem;
}

.nav-sidebar--home .nav-group--center {
  display: flex;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  gap: .12rem;
}

.nav-group--bottom {
  flex-shrink: 0;
  gap: .15rem;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 44px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  font-size: 1.35rem;
  transition: color .15s, background .15s;
}

.nav-label {
  display: none;
}

.nav-item:hover {
  color: var(--amber);
}

.nav-item.active {
  color: var(--amber);
}

.nav-theme {
  cursor: pointer;
}

.nav-theme:hover {
  background: var(--bg-soft);
}

.nav-platform-tab {
  display: inline-flex;
  align-items: center;
  gap: .32rem;
  padding: .22rem .28rem;
  border: none;
  border-bottom: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: .84rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  transition: color .15s, border-color .15s, background .15s;
}

.nav-platform-tab:hover:not(.disabled) {
  color: var(--text);
  background: var(--bg-soft);
}

.nav-platform-tab.active {
  color: var(--amber);
  border-bottom-color: var(--amber);
}

.nav-platform-tab.disabled {
  opacity: .35;
  cursor: not-allowed;
}

.nav-platform-label {
  display: none;
}

@media (min-width: 768px) {
  .nav-sidebar {
    top: 0;
    bottom: auto;
    padding: 0 .75rem;
    border-top: none;
    border-bottom: 1px solid var(--chrome-border);
  }

  .nav-sidebar--home {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    position: static;
  }

  .nav-sidebar--home .nav-group--top {
    flex: none;
    justify-self: start;
    justify-content: flex-start;
    gap: .2rem;
    padding-left: .15rem;
  }

  .nav-sidebar--home .nav-group--center {
    position: static;
    transform: none;
    justify-self: center;
    gap: .2rem;
  }

  .nav-sidebar--home .nav-group--bottom {
    justify-self: end;
    gap: .2rem;
    padding-right: .15rem;
  }

  .nav-group--top {
    justify-content: flex-start;
    gap: .2rem;
    padding-left: .15rem;
  }

  .nav-group--bottom {
    gap: .2rem;
    padding-right: .15rem;
  }

  .nav-item {
    width: auto;
    height: 40px;
    padding: 0 .7rem;
    gap: .38rem;
    font-size: 1.15rem;
  }

  .nav-label {
    display: inline;
    font-size: .84rem;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }

  .nav-platform-tab {
    padding: .28rem .5rem;
  }

  .nav-platform-label {
    display: inline;
  }
}
</style>
