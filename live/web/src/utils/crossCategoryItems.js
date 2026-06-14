import { fetchHotCategories } from "../api/crossBrowse.js";
import { getDouyuPicIndex, lookupDouyuPic } from "./douyuCategoryPic.js";

let cachedItems = null;
let loadingPromise = null;

/** 全平台热门分类，图标以斗鱼分类图为准 */
export async function loadCrossCategoryItems() {
  if (cachedItems) return cachedItems;
  if (!loadingPromise) {
    loadingPromise = Promise.all([fetchHotCategories(), getDouyuPicIndex()])
      .then(([hotData, douyuIndex]) => {
        cachedItems = (hotData.categories || []).map((item) => ({
          key: item.key,
          name: item.name,
          pic: lookupDouyuPic(
            { douyuCid: item.douyu, name: item.name },
            douyuIndex,
          ),
        }));
        return cachedItems;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}
