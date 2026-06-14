<template>
  <AppLayout :active-site="site">
    <PlatformTabs :active-site="site" hide-headers>
      <p v-if="!platform?.enabled" class="page-msg">该平台尚未接入</p>
      <section v-else-if="isCrossSite && !crossBrowseEnabled" class="page-msg">
        <p>全平台分类暂不可用。</p>
        <RouterLink to="/all">返回全平台首页</RouterLink>
      </section>
      <section v-else-if="!isCrossSite && !browseEnabled" class="page-msg">
        <p>该平台暂不支持分类浏览。</p>
        <RouterLink :to="`/${site}`">返回首页输入房间号</RouterLink>
      </section>
      <p v-else-if="pageLoading" class="page-msg">加载游戏分类...</p>
      <p v-else-if="pageError" class="page-msg page-msg--err">{{ pageError }}</p>
      <template v-else-if="isCrossSite">
        <CategoryGrid cross :site="site" :items="crossItems" />
      </template>
      <template v-else>
        <CategoryGroupTabs
          v-if="categories.length > 1"
          v-model:active-index="activeGroupIndex"
          :site="site"
          :groups="categories"
        />
        <CategoryGrid :site="site" :items="activeItems" />
      </template>
    </PlatformTabs>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { RouterLink } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import PlatformTabs from "../components/PlatformTabs.vue";
import CategoryGroupTabs from "../components/CategoryGroupTabs.vue";
import CategoryGrid from "../components/CategoryGrid.vue";
import { getPlatform, supportsBrowse, supportsCrossBrowse } from "../config/platforms";
import { useBrowse } from "../composables/useBrowse.js";
import { loadCrossCategoryItems } from "../utils/crossCategoryItems.js";

const props = defineProps({
  site: { type: String, required: true },
});

const siteRef = ref(props.site);
const platform = computed(() => getPlatform(props.site));
const isCrossSite = computed(() => props.site === "all");
const browseEnabled = computed(() => supportsBrowse(props.site));
const crossBrowseEnabled = computed(() => supportsCrossBrowse("all"));
const activeGroupIndex = ref(0);

const crossItems = ref([]);
const loadingCross = ref(false);
const crossError = ref("");

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

const pageLoading = computed(() =>
  isCrossSite.value ? loadingCross.value : loadingCategories.value,
);
const pageError = computed(() =>
  isCrossSite.value ? crossError.value : listError.value,
);

async function loadCrossCategories() {
  loadingCross.value = true;
  crossError.value = "";
  try {
    crossItems.value = await loadCrossCategoryItems();
  } catch (err) {
    crossItems.value = [];
    crossError.value = err.message;
  } finally {
    loadingCross.value = false;
  }
}

watch(
  () => props.site,
  (value) => {
    siteRef.value = value;
    activeGroupIndex.value = 0;
    if (value === "all") {
      if (supportsCrossBrowse("all")) void loadCrossCategories();
      return;
    }
    if (getPlatform(value)?.enabled && supportsBrowse(value)) loadCategories();
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
