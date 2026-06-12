import { ref } from "vue";
import { fetchCategories, fetchCategoryRooms, fetchRecommendRooms } from "../api/browse.js";

export function useBrowse(siteRef) {
  const categories = ref([]);
  const rooms = ref([]);
  const listTitle = ref("推荐");
  const activeCategory = ref(null);
  const loadingCategories = ref(false);
  const loadingRooms = ref(false);
  const hasMore = ref(false);
  const page = ref(1);
  const listError = ref("");

  async function loadCategories() {
    const site = siteRef.value;
    if (!site) return;
    loadingCategories.value = true;
    try {
      const data = await fetchCategories(site);
      categories.value = data.categories || [];
    } catch (err) {
      categories.value = [];
      listError.value = err.message;
    } finally {
      loadingCategories.value = false;
    }
  }

  async function loadRecommend(reset = true) {
    const site = siteRef.value;
    if (!site) return;
    if (reset) {
      page.value = 1;
      rooms.value = [];
      activeCategory.value = null;
      listTitle.value = "推荐";
    }
    loadingRooms.value = true;
    listError.value = "";
    try {
      const data = await fetchRecommendRooms(site, page.value);
      rooms.value = reset ? data.list || [] : rooms.value.concat(data.list || []);
      hasMore.value = !!data.hasMore;
    } catch (err) {
      if (reset) rooms.value = [];
      listError.value = err.message;
    } finally {
      loadingRooms.value = false;
    }
    if (reset) await prefetchUntil();
  }

  async function loadCategoryRooms(category, reset = true) {
    const site = siteRef.value;
    if (!site || !category) return;
    if (reset) {
      page.value = 1;
      rooms.value = [];
      activeCategory.value = category;
      listTitle.value = category.name || "分类";
    }
    loadingRooms.value = true;
    listError.value = "";
    try {
      const data = await fetchCategoryRooms(site, {
        cid: category.cid,
        pid: category.pid,
        page: page.value,
      });
      rooms.value = reset ? data.list || [] : rooms.value.concat(data.list || []);
      hasMore.value = !!data.hasMore;
    } catch (err) {
      if (reset) rooms.value = [];
      listError.value = err.message;
    } finally {
      loadingRooms.value = false;
    }
    if (reset) await prefetchUntil();
  }

  async function loadMore() {
    if (loadingRooms.value || !hasMore.value) return;
    page.value += 1;
    if (activeCategory.value) {
      await loadCategoryRooms(activeCategory.value, false);
    } else {
      await loadRecommend(false);
    }
  }

  /** 首屏不足时自动预取，避免哨兵在滚动容器外无法触发 */
  async function prefetchUntil(minItems = 24) {
    while (hasMore.value && rooms.value.length < minItems && !loadingRooms.value) {
      await loadMore();
    }
  }

  function findCategory(cid, pid) {
    const targetCid = String(cid);
    const targetPid = pid != null && pid !== "" ? String(pid) : "";
    for (const group of categories.value) {
      for (const item of group.list || []) {
        if (String(item.cid) !== targetCid) continue;
        if (targetPid && String(item.pid ?? "") !== targetPid) continue;
        return { ...item, groupName: group.name };
      }
    }
    return { cid, pid: pid || undefined, name: "分类" };
  }

  return {
    categories,
    rooms,
    listTitle,
    activeCategory,
    loadingCategories,
    loadingRooms,
    hasMore,
    listError,
    loadCategories,
    loadRecommend,
    loadCategoryRooms,
    loadMore,
    findCategory,
  };
}
