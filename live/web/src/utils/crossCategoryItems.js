import { fetchHotCategories } from "../api/crossBrowse.js";
import { HOT_CROSS_CATEGORY_KEYS } from "../config/hotCrossCategories.js";
import {
  findCrossCategoryByKey,
  huyaCidForCrossKey,
  loadCategoryCrossMap,
  resolveCrossCategoryKey,
} from "./categoryDisplay.js";
import { getHuyaPicIndex, lookupHuyaPic } from "./huyaCategoryPic.js";

let cachedItems = null;
let loadingPromise = null;

function mapCrossCategoryItem(key, apiItem, huyaIndex) {
  const resolvedKey = resolveCrossCategoryKey(key);
  const mapped = findCrossCategoryByKey(resolvedKey);
  if (!mapped && !apiItem) return null;
  const huyaCid = huyaCidForCrossKey(resolvedKey, apiItem?.huya || mapped?.huya);
  const name = mapped?.name || apiItem?.name || resolvedKey;
  const pic = lookupHuyaPic({ huyaCid, name }, huyaIndex);
  return {
    key: resolvedKey,
    name,
    huyaCid,
    pic,
  };
}

/** 按 HOT_CROSS_CATEGORY_KEYS 构建全平台分类列表（API 不可用时的兜底） */
export function buildCrossCategoryItems(hotData, huyaIndex) {
  const apiByKey = new Map(
    (hotData?.categories || []).map((item) => [
      resolveCrossCategoryKey(item.key),
      item,
    ]),
  );
  const items = [];
  for (const key of HOT_CROSS_CATEGORY_KEYS) {
    const item = mapCrossCategoryItem(key, apiByKey.get(key), huyaIndex);
    if (item) items.push(item);
  }
  return items;
}

/** 全平台热门分类，图标以虎牙分类图为准 */
export async function loadCrossCategoryItems({ force = false } = {}) {
  if (force) {
    cachedItems = null;
    loadingPromise = null;
  }
  if (cachedItems) return cachedItems;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      await loadCategoryCrossMap();
      const huyaIndex = await getHuyaPicIndex();
      let hotData = { categories: [] };
      try {
        hotData = await fetchHotCategories();
      } catch {
        /* 使用本地映射兜底 */
      }
      cachedItems = buildCrossCategoryItems(hotData, huyaIndex);
      return cachedItems;
    })().finally(() => {
      loadingPromise = null;
    });
  }
  return loadingPromise;
}
