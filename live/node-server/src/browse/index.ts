import { sanitizeUnicode } from "../middleware/sanitize-json.js";
import { fetchDouyuCategories, fetchDouyuRooms } from "./douyu.js";
import { fetchHuyaCategories, fetchHuyaLiveList } from "./huya.js";
import type { CategoryGroup, RoomsPayload } from "./douyu.js";

export type { CategoryGroup, RoomsPayload };

export interface BrowseApi {
  fetchCategories(site: string): Promise<CategoryGroup[]>;
  fetchRecommendRooms(site: string, page: number): Promise<RoomsPayload>;
  fetchCategoryRooms(site: string, cid: string, page: number, pid?: string): Promise<RoomsPayload>;
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
};
