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
      <div
        v-for="platform in navPlatforms"
        :key="platform.id"
        class="nav-platform-wrap"
        v-bind="platformWrapListeners(platform.id)"
      >
        <RouterLink
          :to="platformNavLink(platform.id)"
          role="tab"
          class="nav-platform-tab"
          :class="{
            active: platform.id === activePlatformId,
          }"
          :aria-selected="platform.id === activePlatformId"
        >
          <PlatformIcon :id="platform.id" size="sm" />
          <span class="nav-platform-label">{{ platform.label }}</span>
        </RouterLink>
        <NavPlatformCategoryMenu
          v-if="hoverUi && hoveredPlatform === platform.id"
          :platform-id="platform.id"
          @pointerenter="hoveredPlatform = platform.id"
          @pointerleave="hoveredPlatform = ''"
        />
      </div>
    </div>

    <div class="nav-group nav-group--tools">
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
    </div>
  </nav>
</template>

<script setup>
import { computed, ref, onMounted, toRef } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { getTheme, toggleTheme } from "../utils/theme.js";
import { useSearchDialog } from "../composables/useSearchDialog.js";
import { useNavPlatforms } from "../composables/useNavPlatforms.js";
import { useHoverUi } from "../composables/useHoverUi.js";
import AccentColorPicker from "./AccentColorPicker.vue";
import Icon from "./Icon.vue";
import PlatformIcon from "./PlatformIcon.vue";
import NavPlatformCategoryMenu from "./NavPlatformCategoryMenu.vue";

const props = defineProps({
  site: { type: String, default: "douyu" },
});

const route = useRoute();
const theme = ref("dark");
const hoveredPlatform = ref("");
const { hoverUi } = useHoverUi();
const { openSearch } = useSearchDialog();
const siteRef = toRef(props, "site");

const {
  showCenterPlatforms,
  activePlatformId,
  navPlatforms,
  platformNavLink,
} = useNavPlatforms(siteRef);

onMounted(() => {
  theme.value = getTheme();
});

function onToggleTheme() {
  theme.value = toggleTheme();
}

function onOpenSearch() {
  openSearch(props.site || "douyu");
}

function platformWrapListeners(platformId) {
  if (!hoverUi.value) return {};
  return {
    onMouseenter: () => { hoveredPlatform.value = platformId; },
    onMouseleave: () => { hoveredPlatform.value = ""; },
  };
}

const allItems = computed(() => {
  const site = props.site || "douyu";
  const homeLink = site === "all" ? "/all" : `/${site}`;
  return [
    { icon: "home", link: homeLink, title: "首页", zone: "top" },
    { icon: "apps", link: `/${site}/category`, title: "分类", zone: "top" },
    { icon: "heart", link: "/follow", title: "关注", zone: "top" },
  ];
});

const topItems = computed(() => allItems.value.filter((item) => item.zone === "top"));

function isActive(item) {
  if (item.link === "/follow") {
    return route.path === item.link;
  }
  if (item.title === "首页") {
    if (route.name === "all-home") return true;
    const site = props.site || "douyu";
    if (site === "all") return false;
    return route.path === `/${site}` || route.path === `/${site}/`;
  }
  if (item.title === "分类") {
    return route.path.includes("/category");
  }
  if (item.link === "/all") {
    return route.name === "all-home";
  }
  const site = props.site || "douyu";
  if (site === "all") {
    return route.name === "all-home";
  }
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
  box-sizing: border-box;
  min-height: var(--nav-chrome-height);
  padding: 0 .35rem var(--nav-safe-bottom);
  border-top: 1px solid var(--chrome-border);
  border-bottom: none;
  background: var(--dark-7);
}

.nav-group {
  display: flex;
  align-items: center;
}

.nav-group--top {
  flex: 1;
  justify-content: center;
  gap: .15rem;
  min-width: 0;
}

.nav-group--center {
  display: none;
}

.nav-group--tools {
  flex-shrink: 0;
  gap: .15rem;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 44px;
  height: 44px;
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

.nav-item.active {
  color: var(--amber);
}

.nav-theme {
  cursor: pointer;
}

.nav-platform-wrap {
  position: relative;
  flex: 0 0 auto;
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
    display: flex;
    position: static;
    transform: none;
    justify-self: center;
    gap: .2rem;
  }

  .nav-sidebar--home .nav-group--tools {
    justify-self: end;
    gap: .2rem;
    padding-right: .15rem;
  }

  .nav-group--top {
    flex: none;
    justify-content: flex-start;
    gap: .2rem;
    padding-left: .15rem;
  }

  .nav-group--tools {
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

@media (hover: hover) and (pointer: fine) {
  .nav-item:hover {
    color: var(--amber);
  }

  .nav-theme:hover {
    background: var(--bg-soft);
  }

  .nav-platform-tab:hover:not(.disabled) {
    color: var(--text);
    background: var(--bg-soft);
  }
}
</style>
