<template>
  <div class="nav-platform-strip" role="tablist" aria-label="平台">
    <div class="nav-platform-strip__scroll scrolly">
      <div
        v-for="platform in navPlatforms"
        :key="platform.id"
        class="nav-platform-strip__item"
      >
        <RouterLink
          :to="platformNavLink(platform.id)"
          role="tab"
          class="nav-platform-strip__tab"
          :class="{
            active: platform.id === activePlatformId,
            'nav-platform-strip__tab--all': platform.id === 'all',
          }"
          :aria-selected="platform.id === activePlatformId"
        >
          <PlatformIcon v-if="platform.id !== 'all'" :id="platform.id" size="xs" />
          <Icon v-else name="apps" class="nav-platform-strip__all-icon" />
          <span class="nav-platform-strip__label">{{ platform.label }}</span>
        </RouterLink>
        <button
          type="button"
          class="nav-platform-strip__cat"
          :aria-label="`${platform.label}分类`"
          @click="openSheet(platform.id)"
        >
          <Icon name="list" />
        </button>
      </div>
    </div>
    <NavPlatformCategorySheet
      :open="!!sheetPlatform"
      :platform-id="sheetPlatform || 'douyu'"
      @close="sheetPlatform = ''"
    />
  </div>
</template>

<script setup>
import { ref, toRef } from "vue";
import { RouterLink } from "vue-router";
import Icon from "./Icon.vue";
import PlatformIcon from "./PlatformIcon.vue";
import NavPlatformCategorySheet from "./NavPlatformCategorySheet.vue";
import { useNavPlatforms } from "../composables/useNavPlatforms.js";

const props = defineProps({
  site: { type: String, default: "douyu" },
});

const sheetPlatform = ref("");
const siteRef = toRef(props, "site");
const { navPlatforms, activePlatformId, platformNavLink } = useNavPlatforms(siteRef);

function openSheet(platformId) {
  sheetPlatform.value = platformId;
}
</script>

<style scoped>
.nav-platform-strip {
  flex-shrink: 0;
  border-bottom: 1px solid var(--chrome-border);
  background: var(--dark-7);
}

.nav-platform-strip__scroll {
  display: flex;
  gap: .35rem;
  padding: .38rem .45rem .42rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-platform-strip__scroll::-webkit-scrollbar {
  display: none;
}

.nav-platform-strip__item {
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--chrome-border);
  background: var(--bg-soft);
}

.nav-platform-strip__tab {
  display: inline-flex;
  align-items: center;
  gap: .28rem;
  padding: .32rem .5rem .32rem .42rem;
  color: var(--muted);
  font-size: .78rem;
  font-weight: 500;
  white-space: nowrap;
}

.nav-platform-strip__tab.active {
  color: var(--amber);
}

.nav-platform-strip__all-icon {
  font-size: 1rem;
  line-height: 1;
}

.nav-platform-strip__cat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  padding: 0;
  border: none;
  border-left: 1px solid var(--chrome-border);
  background: transparent;
  color: var(--muted);
  font-size: .88rem;
  cursor: pointer;
}

.nav-platform-strip__cat:active,
.nav-platform-strip__tab:active {
  background: var(--sidebar-chip-hover-bg);
}

.nav-platform-strip__item:has(.nav-platform-strip__tab.active) {
  border-color: color-mix(in srgb, var(--amber) 55%, var(--chrome-border));
}
</style>
