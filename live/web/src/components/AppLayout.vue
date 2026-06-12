<template>
  <div class="app-shell">
    <NavSidebar :site="activeSite" />
    <main class="app-main">
      <div class="app-main-inner scrolly">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup>
import NavSidebar from "./NavSidebar.vue";

defineProps({
  activeSite: { type: String, default: "douyu" },
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--bg);
}

.app-main {
  min-height: 100vh;
  padding: .5rem .75rem calc(var(--nav-height) + .5rem);
  box-sizing: border-box;
}

.app-main-inner {
  height: 100%;
  min-height: calc(100vh - var(--nav-height) - 1rem);
}

@media (min-width: 768px) {
  .app-main {
    margin-left: var(--nav-width);
    padding: .5rem .75rem .5rem 0;
    height: 100vh;
  }

  .app-main-inner {
    min-height: calc(100vh - 1rem);
    max-height: calc(100vh - 1rem);
  }
}
</style>
