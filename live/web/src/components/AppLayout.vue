<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink to="/" class="logo" title="Lemon live">
        <img class="logo-icon" src="https://registry.npmmirror.com/lemon-mse/0.7.4/files/dist/lemon/logo.svg" alt="">
        <span class="logo-text">Lemon live</span>
      </RouterLink>
      <nav class="platform-nav" aria-label="平台">
        <PlatformTabs :active-site="activeSite" />
      </nav>
    </header>
    <div class="site-body">
      <slot />
    </div>
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
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.site-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 1.25rem;
  height: 52px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: .5rem;
  text-decoration: none;
  color: var(--text);
  flex-shrink: 0;
}

.logo-icon {
  width: 28px;
  height: 28px;
}

.logo-text {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: .02em;
}

.platform-nav {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.site-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
