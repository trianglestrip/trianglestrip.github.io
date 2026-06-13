<template>
  <nav class="nav-sidebar" aria-label="主导航">
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
      </RouterLink>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { supportsBrowse } from "../config/platforms";
import { getTheme, toggleTheme } from "../utils/theme.js";
import Icon from "./Icon.vue";

const props = defineProps({
  site: { type: String, default: "douyu" },
});

const route = useRoute();
const theme = ref("dark");

onMounted(() => {
  theme.value = getTheme();
});

function onToggleTheme() {
  theme.value = toggleTheme();
}

const allItems = computed(() => {
  const site = props.site || "douyu";
  const list = [
    { icon: "home", link: `/${site}`, title: "首页", zone: "top" },
    { icon: "apps", link: `/${site}/category`, title: "分类", browse: true, zone: "top" },
    { icon: "heart", link: "/follow", title: "关注", zone: "top" },
    { icon: "timer", link: "/time", title: "耗时", zone: "top" },
    { icon: "search", link: "/search", title: "搜索", zone: "bottom" },
    { icon: "user", link: "/user", title: "用户", zone: "bottom" },
  ];
  return list.filter((item) => item.browse !== true || supportsBrowse(site));
});

const topItems = computed(() => allItems.value.filter((item) => item.zone === "top"));
const bottomItems = computed(() => allItems.value.filter((item) => item.zone === "bottom"));

function isActive(item) {
  if (item.link === "/follow" || item.link === "/search" || item.link === "/user" || item.link === "/time") {
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
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--nav-height);
  padding: 0 .35rem;
  border-top: 1px solid var(--gray-7);
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
}

.nav-group--bottom {
  flex-shrink: 0;
  gap: .15rem;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
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

@media (min-width: 768px) {
  .nav-sidebar {
    top: 0;
    right: auto;
    bottom: 0;
    width: var(--nav-width);
    height: 100vh;
    flex-direction: column;
    justify-content: space-between;
    align-items: stretch;
    padding: .5rem 0;
    border-top: none;
    border-right: 1px solid var(--gray-7);
  }

  .nav-group {
    flex-direction: column;
    width: 100%;
  }

  .nav-group--top {
    flex: 0 0 auto;
    justify-content: flex-start;
  }

  .nav-group--bottom {
    flex: 0 0 auto;
    margin-top: auto;
    justify-content: flex-end;
  }

  .nav-item {
    width: calc(100% - 1rem);
    height: 44px;
    margin: .35rem .5rem;
  }
}
</style>
