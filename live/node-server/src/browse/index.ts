import { sanitizeUnicode } from "../middleware/sanitize-json.js";
import {
  crossCategoryMapPayload,
  findCrossCategory,
  type CrossCategoryEntry,
} from "./category-cross-map.js";
import { fetchDouyuCategories, fetchDouyuRooms, type RoomItem } from "./douyu.js";
import { fetchHuyaCategories, fetchHuyaLiveList } from "./huya.js";
import type { CategoryGroup, RoomsPayload } from "./douyu.js";

export type { CategoryGroup, RoomsPayload, CrossCategoryEntry };
export { crossCategoryMapPayload, findCrossCategory };

const BROWSE_SITES = ["douyu", "huya"] as const;

function interleaveRoomLists(lists: RoomItem[][]): RoomItem[] {
  const merged: RoomItem[] = [];
  const maxLen = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const list of lists) {
      if (list[i]) merged.push(list[i]);
    }
  }
  return merged;
}

export interface BrowseApi {
  fetchCategories(site: string): Promise<CategoryGroup[]>;
  fetchRecommendRooms(site: string, page: number): Promise<RoomsPayload>;
  fetchCategoryRooms(site: string, cid: string, page: number, pid?: string): Promise<RoomsPayload>;
  fetchRelatedRecommendRooms(
    contextSite: string,
    categoryName: string,
    contextCid?: string,
    page?: number,
    perSite?: number,
  ): Promise<{
    list: RoomItem[];
    categoryKey: string | null;
    categoryName: string | null;
  }>;
}
export const browseApi: BrowseApi = {
  async fetchCategories(site: string): Promise<CategoryGroup[]> {
    if (site === "huya") {
      return sanitizeUnicode(await fetchHuyaCategories());
    }
    if (site === "douyu") {
      return sanitizeUnicode(await fetchDouyuCategories());
    }
    throw new Error(`暂不支持平台: ${site}`);
  },

  async fetchRecommendRooms(site: string, page: number): Promise<RoomsPayload> {
    if (site === "huya") {
      return sanitizeUnicode(await fetchHuyaLiveList(0, page));
    }
    if (site === "douyu") {
      return sanitizeUnicode(await fetchDouyuRooms(null, page));
    }
    throw new Error(`暂不支持平台: ${site}`);
  },

  async fetchCategoryRooms(site: string, cid: string, page: number, pid?: string): Promise<RoomsPayload> {
    void pid;
    if (site === "huya") {
      const result = await fetchHuyaLiveList(cid, page);
      return sanitizeUnicode({ ...result, cid: String(cid) });
    }
    if (site === "douyu") {
      const result = await fetchDouyuRooms(cid, page);
      return sanitizeUnicode({ ...result, cid: String(cid) });
    }
    throw new Error(`暂不支持平台: ${site}`);
  },

  async fetchRelatedRecommendRooms(
    contextSite: string,
    categoryName: string,
    contextCid = "",
    page = 1,
    perSite = 5,
  ) {
    const entry = findCrossCategory(contextSite, categoryName, contextCid);
    const lists: RoomItem[][] = [];

    for (const site of BROWSE_SITES) {
      try {
        let payload: RoomsPayload;
        const mappedCid =
          entry && site === "douyu"
            ? entry.douyu
            : entry && site === "huya"
              ? entry.huya
              : undefined;

        if (mappedCid) {
          payload = await browseApi.fetchCategoryRooms(site, mappedCid, page);
        } else if (site === contextSite && contextCid) {
          payload = await browseApi.fetchCategoryRooms(site, contextCid, page);
        } else {
          payload = await browseApi.fetchRecommendRooms(site, page);
        }

        const tagged = (payload.list || [])
          .slice(0, perSite)
          .map((room) => ({ ...room, siteId: site }));
        lists.push(tagged);
      } catch {
        lists.push([]);
      }
    }

    const list = interleaveRoomLists(lists);
    return {
      list: sanitizeUnicode(list),
      categoryKey: entry?.key ?? null,
      categoryName: entry?.name ?? (categoryName || null),
    };
  },
};
