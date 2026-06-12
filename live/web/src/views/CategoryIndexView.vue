<template>
  <AppLayout :active-site="site">
    <PlatformTabs :active-site="site" category-mode>
      <p v-if="!platform?.enabled" class="page-msg">该平台尚未接入</p>
      <p v-else-if="loadingCategories" class="page-msg">加载分类...</p>
      <p v-else-if="listError" class="page-msg page-msg--err">{{ listError }}</p>
      <template v-else>
        <CategoryGroupTabs
          v-if="categories.length > 1"
          v-model:active-index="activeGroupIndex"
          :groups="categories"
        />
        <CategoryGrid :site="site" :items="activeItems" />
      </template>
    </PlatformTabs>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import AppLayout from "../components/AppLayout.vue";
import PlatformTabs from "../components/PlatformTabs.vue";
import CategoryGroupTabs from "../components/CategoryGroupTabs.vue";
import CategoryGrid from "../components/CategoryGrid.vue";
import { getPlatform } from "../config/platforms";
import { useBrowse } from "../composables/useBrowse.js";

const props = defineProps({
  site: { type: String, required: true },
});

const siteRef = ref(props.site);
const platform = computed(() => getPlatform(props.site));
const activeGroupIndex = ref(0);

const {
  categories,
  loadingCategories,
  listError,
  loadCategories,
} = useBrowse(siteRef);

const activeItems = computed(() => {
  const group = categories.value[activeGroupIndex.value];
  return group?.list || [];
});

watch(
  () => props.site,
  (value) => {
    siteRef.value = value;
    activeGroupIndex.value = 0;
    if (getPlatform(value)?.enabled) loadCategories();
  },
  { immediate: true },
);
</script>

<style scoped>
.page-msg {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
}

.page-msg--err {
  color: var(--danger);
}
</style>
