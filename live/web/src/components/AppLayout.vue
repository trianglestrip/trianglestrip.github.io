<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--drawer-rail': drawerEligible,
      'app-shell--drawer-open': drawerEligible && drawerOpen,
    }"
  >
    <NavSidebar :site="activeSite" />
    <DirectoryDrawer
      v-if="drawerEligible"
      :open="drawerOpen"
      eligible
      :initial-site="activeSite"
      @close="setDrawerOpen(false)"
      @open="setDrawerOpen(true)"
    />
    <main
      class="app-main"
      :class="{
        'app-main--home': usesDrawerLayout,
        'app-main--home-drawer': drawerEligible,
        'app-main--drawer-open': drawerEligible && drawerOpen,
        'app-main--mobile-strip': showMobilePlatformStrip,
      }"
    >
      <NavPlatformStrip v-if="showMobilePlatformStrip" :site="activeSite" />
      <div class="app-main-inner">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import NavSidebar from "./NavSidebar.vue";
import NavPlatformStrip from "./NavPlatformStrip.vue";
import DirectoryDrawer from "./DirectoryDrawer.vue";
import { loadDrawerPref, saveDrawerOpen } from "../utils/drawerPref.js";

defineProps({
  activeSite: { type: String, default: "douyu" },
});

const route = useRoute();
const desktopNav = ref(false);
const drawerOpen = ref(loadDrawerPref().open);

const usesDrawerLayout = computed(
  () =>
    route.name === "all-home" ||
    route.name === "all-category-rooms" ||
    route.name === "site-home" ||
    route.name === "category-index" ||
    route.name === "category-rooms",
);

const drawerEligible = computed(() => desktopNav.value);
const showMobilePlatformStrip = computed(() => !desktopNav.value && usesDrawerLayout.value);

function setDrawerOpen(open) {
  drawerOpen.value = open;
  saveDrawerOpen(open);
}

function syncDesktopNav() {
  desktopNav.value = window.matchMedia("(min-width: 768px)").matches;
}

let mediaQuery = null;

onMounted(() => {
  syncDesktopNav();
  mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", syncDesktopNav);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener("change", syncDesktopNav);
});
</script>

<style scoped>
.app-shell {
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  --room-grid-cols-wide: 6;
}

.app-shell--drawer-open {
  --room-grid-cols-wide: 5;
}

.app-main {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0 .35rem var(--nav-height);
}

.app-main--mobile-strip {
  padding-top: 0;
}

.app-main-inner {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-main-inner > :deep(*) {
  flex: 1;
  min-height: 0;
}

@media (min-width: 768px) {
  .app-main {
    padding: var(--nav-height) .35rem 0;
    transition: margin-left .22s ease;
  }

  .app-main--home {
    padding-top: 0;
    height: calc(100vh - var(--nav-height));
  }

  .app-main--home-drawer {
    margin-left: var(--directory-rail-width);
  }

  .app-main--home-drawer.app-main--drawer-open {
    margin-left: var(--directory-drawer-width);
  }
}
</style>
