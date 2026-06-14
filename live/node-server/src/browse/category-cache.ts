import type { BrowseApi } from "./index.js";
import {
  BROWSE_CATEGORY_SITES,
  CATEGORY_CACHE_TTL_MS,
  getCachedCategories,
  isBrowseCategorySite,
  saveCachedCategories,
  type BrowseCategorySite,
} from "./category-cache-store.js";
import { clearDouyuCate2NameCache } from "./douyu.js";
import { clearDouyinCategoryCache } from "./douyin.js";
import { clearHuyaCategoryCache } from "./huya.js";
import type { CategoryGroup } from "./douyu.js";

export interface CategoryFetchResult {
  categories: CategoryGroup[];
  cached: boolean;
  stale?: boolean;
  fetchedAt?: number;
}

export function clearPlatformCategoryMemoryCache(site?: string): void {
  if (!site || site === "huya") clearHuyaCategoryCache();
  if (!site || site === "douyin") clearDouyinCategoryCache();
  if (!site || site === "douyu") clearDouyuCate2NameCache();
}

export async function resolveCategories(
  browseApi: BrowseApi,
  site: string,
  opts?: { force?: boolean },
): Promise<CategoryFetchResult> {
  if (!isBrowseCategorySite(site)) {
    throw new Error(`暂不支持平台: ${site}`);
  }

  if (!opts?.force) {
    const cached = getCachedCategories(site);
    if (cached) {
      return {
        categories: cached.categories,
        cached: true,
        fetchedAt: cached.fetchedAt,
      };
    }
  } else {
    clearPlatformCategoryMemoryCache(site);
  }

  try {
    const categories = await browseApi.fetchCategories(site);
    const saved = saveCachedCategories(site, categories);
    return {
      categories,
      cached: false,
      fetchedAt: saved.fetchedAt,
    };
  } catch (err) {
    const stale = getCachedCategories(site, { maxAgeMs: -1 });
    if (stale) {
      return {
        categories: stale.categories,
        cached: true,
        stale: true,
        fetchedAt: stale.fetchedAt,
      };
    }
    throw err;
  }
}

export async function refreshCategoryCaches(
  browseApi: BrowseApi,
  sites?: string[],
): Promise<{ refreshed: BrowseCategorySite[]; failed: Record<string, string> }> {
  const targets = (sites?.length ? sites : [...BROWSE_CATEGORY_SITES]).filter(isBrowseCategorySite);
  const refreshed: BrowseCategorySite[] = [];
  const failed: Record<string, string> = {};

  await Promise.all(
    targets.map(async (site) => {
      try {
        clearPlatformCategoryMemoryCache(site);
        const categories = await browseApi.fetchCategories(site);
        saveCachedCategories(site, categories);
        refreshed.push(site);
      } catch (err) {
        failed[site] = err instanceof Error ? err.message : String(err);
      }
    }),
  );

  return { refreshed, failed };
}

export { CATEGORY_CACHE_TTL_MS, CATEGORY_CACHE_TTL_SEC } from "./category-cache-store.js";
