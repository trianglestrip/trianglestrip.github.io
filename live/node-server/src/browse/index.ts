import { sanitizeUnicode } from "../middleware/sanitize-json.js";
import {
  crossCategoryMapPayload,
  douyinPidForEntry,
  findCrossCategory,
  isGroupCategoryEntry,
  type CrossCategoryEntry,
} from "./category-cross-map.js";
import { fetchDouyuCategories, fetchDouyuGroupRooms, fetchDouyuRooms, type RoomItem } from "./douyu.js";
import { fetchDouyinGameCategories, fetchDouyinGameRooms, fetchDouyinRecommendRooms } from "./douyin.js";
import { fetchHuyaCategories, fetchHuyaLiveList } from "./huya.js";
import type { CategoryGroup, RoomsPayload } from "./douyu.js";

export type { CategoryGroup, RoomsPayload, CrossCategoryEntry };
export { crossCategoryMapPayload, findCrossCategory };

const BROWSE_SITES = ["douyu", "huya", "douyin"] as const;

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

async function fetchGroupRoomsForSite(
  site: string,
  entry: CrossCategoryEntry,
  page: number,
  limit: number,
): Promise<RoomItem[]> {
  if (site === "douyu" && entry.douyuGroup) {
    return (await fetchDouyuGroupRooms(entry.douyuGroup, page, limit)).list;
  }
  if (site === "huya" && entry.huyaGroup) {
    return (await fetchHuyaLiveList(entry.huyaGroup, page, limit)).list;
  }
  if (site === "douyin" && entry.douyinPartitions?.length) {
    const parts = entry.douyinPartitions.slice(0, 3);
    const perPart = Math.max(2, Math.ceil(limit / parts.length));
    const lists = await Promise.all(
      parts.map((part) =>
        fetchDouyinGameRooms(part.cid, page, part.pid || "1", "").then((payload) =>
          (payload.list || []).slice(0, perPart),
        ),
      ),
    );
    return interleaveRoomLists(lists).slice(0, limit);
  }
  return [];
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
    limit?: number,
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
    if (site === "douyin") {
      return sanitizeUnicode(await fetchDouyinGameCategories());
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
    if (site === "douyin") {
      return sanitizeUnicode(await fetchDouyinRecommendRooms(page));
    }
    throw new Error(`暂不支持平台: ${site}`);
  },

  async fetchCategoryRooms(site: string, cid: string, page: number, pid?: string): Promise<RoomsPayload> {
    if (site === "huya") {
      const result = await fetchHuyaLiveList(cid, page);
      return sanitizeUnicode({ ...result, cid: String(cid) });
    }
    if (site === "douyu") {
      const result = await fetchDouyuRooms(cid, page);
      return sanitizeUnicode({ ...result, cid: String(cid) });
    }
    if (site === "douyin") {
      const groups = await fetchDouyinGameCategories();
      let partitionName = "";
      for (const group of groups) {
        const hit = group.list.find((item) => String(item.cid) === String(cid));
        if (hit) {
          partitionName = hit.name;
          break;
        }
      }
      const result = await fetchDouyinGameRooms(cid, page, pid || "1", partitionName);
      return sanitizeUnicode({ ...result, cid: String(cid) });
    }
    throw new Error(`暂不支持平台: ${site}`);
  },

  async fetchRelatedRecommendRooms(
    contextSite: string,
    categoryName: string,
    contextCid = "",
    page = 1,
    perSite = 10,
    limit = 20,
  ) {
    const entry = findCrossCategory(contextSite, categoryName, contextCid);
    const lists: RoomItem[][] = [];
    const perSiteCount =
      perSite > 0 ? perSite : Math.max(1, Math.ceil(limit / BROWSE_SITES.length));

    for (const site of BROWSE_SITES) {
      try {
        let tagged: RoomItem[] = [];

        if (entry && isGroupCategoryEntry(entry)) {
          tagged = (await fetchGroupRoomsForSite(site, entry, page, perSiteCount)).map((room) => ({
            ...room,
            siteId: site,
          }));
        } else {
          let payload: RoomsPayload;
          const mappedCid =
            entry && site === "douyu"
              ? entry.douyu
              : entry && site === "huya"
                ? entry.huya
                : entry && site === "douyin"
                  ? entry.douyin
                  : undefined;

          if (mappedCid) {
            const pid = site === "douyin" && entry ? douyinPidForEntry(entry) : undefined;
            payload = await browseApi.fetchCategoryRooms(site, mappedCid, page, pid);
          } else if (site === contextSite && contextCid) {
            payload = await browseApi.fetchCategoryRooms(site, contextCid, page);
          } else if (entry) {
            lists.push([]);
            continue;
          } else {
            payload = await browseApi.fetchRecommendRooms(site, page);
          }

          tagged = (payload.list || [])
            .filter((room) => {
              if (!mappedCid) return true;
              const roomCid = String(room.cid || "").trim();
              return !roomCid || roomCid === mappedCid;
            })
            .slice(0, perSiteCount)
            .map((room) => ({ ...room, siteId: site }));
        }

        lists.push(tagged);
      } catch {
        lists.push([]);
      }
    }

    let list = interleaveRoomLists(lists);
    if (limit > 0) {
      list = list.slice(0, limit);
    }
    return {
      list: sanitizeUnicode(list),
      categoryKey: entry?.key ?? null,
      categoryName: entry?.name ?? (categoryName || null),
    };
  },
};
