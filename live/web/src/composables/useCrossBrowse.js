import { ref } from "vue";
import { fetchCrossCategoryRooms } from "../api/crossBrowse.js";
import { loadCrossCategoryItems } from "../utils/crossCategoryItems.js";
import { resolveCrossCategoryKey } from "../utils/categoryDisplay.js";
import { scheduleIdleTask } from "../utils/runIdle.js";

export function useCrossBrowse() {
  const hotCategories = ref([]);
  const activeKey = ref("");
  const rooms = ref([]);
  const listTitle = ref("");
  const loadingCategories = ref(false);
  const loadingRooms = ref(false);
  const hasMore = ref(false);
  const page = ref(1);
  const listError = ref("");

  async function loadHotCategories() {
    loadingCategories.value = true;
    listError.value = "";
    try {
      hotCategories.value = await loadCrossCategoryItems();
      if (!activeKey.value && hotCategories.value.length) {
        activeKey.value = hotCategories.value[0].key;
      } else if (activeKey.value) {
        activeKey.value = resolveCrossCategoryKey(activeKey.value);
      }
    } catch (err) {
      hotCategories.value = [];
      listError.value = err.message;
    } finally {
      loadingCategories.value = false;
    }
  }

  async function loadCrossRooms(reset = true) {
    const key = resolveCrossCategoryKey(activeKey.value);
    if (!key) {
      rooms.value = [];
      hasMore.value = false;
      return;
    }
    if (reset) {
      page.value = 1;
      rooms.value = [];
    }
    loadingRooms.value = true;
    listError.value = "";
    try {
      const data = await fetchCrossCategoryRooms(key, page.value);
      const batch = (data.list || []).map((room) => ({
        ...room,
        site: room.siteId || room.site,
      }));
      rooms.value = reset ? batch : rooms.value.concat(batch);
      hasMore.value = !!data.hasMore;
      listTitle.value = data.categoryName || "热门";
    } catch (err) {
      if (reset) rooms.value = [];
      hasMore.value = false;
      listError.value = err.message;
    } finally {
      loadingRooms.value = false;
    }
    if (reset) scheduleIdleTask(() => { void prefetchUntil(12); });
  }

  async function loadMore() {
    if (loadingRooms.value || !hasMore.value) return;
    page.value += 1;
    await loadCrossRooms(false);
  }

  async function prefetchUntil(minItems = 21) {
    while (hasMore.value && rooms.value.length < minItems && !loadingRooms.value) {
      await loadMore();
    }
  }

  async function selectCategory(key) {
    activeKey.value = resolveCrossCategoryKey(key);
    await loadCrossRooms(true);
  }

  return {
    hotCategories,
    activeKey,
    rooms,
    listTitle,
    loadingCategories,
    loadingRooms,
    hasMore,
    listError,
    loadHotCategories,
    loadCrossRooms,
    loadMore,
    selectCategory,
  };
}
