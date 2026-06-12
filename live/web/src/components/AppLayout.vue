<template>
  <div class="layout">
    <header class="topbar">
      <RouterLink to="/" class="brand brand-link">
        <span class="brand-mark">🍋</span>
        <div>
          <h1>Live</h1>
          <p>聚合直播 · streamget 解析</p>
        </div>
      </RouterLink>
      <nav class="platforms" aria-label="平台">
        <PlatformTabs :active-site="activeSite" />
      </nav>
    </header>
    <slot />
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
import PlatformTabs from "./PlatformTabs.vue";

defineProps({
  activeSite: { type: String, default: "" },
});
</script>

<style scoped>
.brand-link {
  display: flex;
  align-items: center;
  gap: .75rem;
  text-decoration: none;
  color: inherit;
}
</style>
