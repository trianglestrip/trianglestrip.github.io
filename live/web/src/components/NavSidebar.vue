<template>
  <nav class="nav-sidebar" aria-label="主导航">
    <RouterLink
      v-for="item in items"
      :key="item.link"
      :to="item.link"
      class="nav-item"
      :class="{ active: isActive(item) }"
      :title="item.title"
    >
      <i :class="item.icon" aria-hidden="true"></i>
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { getPlatform } from "../config/platforms";

const props = defineProps({
  site: { type: String, default: "douyu" },
});

const route = useRoute();

const items = computed(() => {
  const site = props.site || "douyu";
  return [
    { icon: "ri-home-smile-line", link: `/${site}`, title: "首页" },
    { icon: "ri-apps-2-line", link: `/${site}/category`, title: "分类" },
    { icon: "ri-heart-line", link: "/follow", title: "关注" },
    { icon: "ri-search-line", link: "/search", title: "搜索" },
    { icon: "ri-user-smile-line", link: "/user", title: "用户" },
  ];
});

function isActive(item) {
  if (item.link === "/follow" || item.link === "/search" || item.link === "/user") {
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
  justify-content: space-around;
  align-items: center;
  height: var(--nav-height);
  border-top: 1px solid var(--gray-7);
  background: var(--dark-7);
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 40px;
  margin: 0 .35rem;
  border-radius: 12px;
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

@media (min-width: 768px) {
  .nav-sidebar {
    top: 0;
    right: auto;
    bottom: 0;
    width: var(--nav-width);
    height: 100vh;
    flex-direction: column;
    justify-content: flex-start;
    padding: .5rem 0;
    border-top: none;
    border-right: 1px solid var(--gray-7);
  }

  .nav-item {
    width: calc(100% - 1rem);
    margin: .35rem .5rem;
    height: 44px;
  }
}
</style>
