import { fetchHotCategories } from "../api/crossBrowse.js";
import {
  findCrossCategoryByKey,
  huyaCidForCrossKey,
  loadCategoryCrossMap,
} from "./categoryDisplay.js";
import { getHuyaPicIndex, lookupHuyaPic } from "./huyaCategoryPic.js";

let cachedItems = null;
let loadingPromise = null;

/** 全平台热门分类，图标以虎牙分类图为准 */
export async function loadCrossCategoryItems() {
  if (cachedItems) return cachedItems;
  if (!loadingPromise) {
    loadingPromise = Promise.all([
      fetchHotCategories(),
      getHuyaPicIndex(),
      loadCategoryCrossMap(),
    ])
      .then(([hotData, huyaIndex]) => {
        cachedItems = (hotData.categories || []).map((item) => {
          const mapped = findCrossCategoryByKey(item.key);
          const huyaCid = huyaCidForCrossKey(item.key, item.huya);
          const name = mapped?.name || item.name;
          const pic = lookupHuyaPic({ huyaCid, name }, huyaIndex);
          return {
            key: item.key,
            name,
            huyaCid,
            pic,
          };
        });
        return cachedItems;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}
