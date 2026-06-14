import { sanitizeUnicode } from "../middleware/sanitize-json.js";

import { BROWSE_SITE_IDS, CROSS_SITE_WEIGHTS, getPlatform } from "../platforms/registry.js";

import {

  crossCategoryMapPayload,

  crossGameCidForSite,

  crossGroupCidForSite,

  douyinPidForEntry,

  findCrossCategory,

  isGroupCategoryEntry,

  sitePidForEntry,

  type CrossCategoryEntry,

} from "./category-cross-map.js";

import { findCrossCategoryByKey, listHotCrossCategories } from "./hot-cross-categories.js";

import { fetchDouyinGameRooms } from "./douyin.js";

import type { CategoryGroup, RoomItem, RoomsPayload } from "./douyu.js";



export type { CategoryGroup, RoomsPayload, CrossCategoryEntry };

export { crossCategoryMapPayload, findCrossCategory, listHotCrossCategories };



function siteCountsForLimit(limit: number): Record<string, number> {

  const totalWeight = BROWSE_SITE_IDS.reduce((sum, id) => sum + (CROSS_SITE_WEIGHTS[id] ?? 1), 0);

  const counts: Record<string, number> = {};

  let assigned = 0;

  for (let i = 0; i < BROWSE_SITE_IDS.length; i += 1) {

    const site = BROWSE_SITE_IDS[i];

    const weight = CROSS_SITE_WEIGHTS[site] ?? 1;

    if (i === BROWSE_SITE_IDS.length - 1) {

      counts[site] = Math.max(1, limit - assigned);

    } else {

      const n = Math.max(1, Math.round((limit * weight) / totalWeight));

      counts[site] = n;

      assigned += n;

    }

  }

  return counts;

}



function interleaveWeightedRooms(

  buckets: Record<string, RoomItem[]>,

  weights: Record<string, number>,

): RoomItem[] {

  const indices: Record<string, number> = Object.fromEntries(BROWSE_SITE_IDS.map((id) => [id, 0]));

  const merged: RoomItem[] = [];

  while (true) {

    let roundAdded = false;

    for (const site of BROWSE_SITE_IDS) {

      const weight = weights[site] || 0;

      const list = buckets[site] || [];

      for (let w = 0; w < weight; w += 1) {

        const idx = indices[site];

        if (idx < list.length) {

          merged.push(list[idx]);

          indices[site] = idx + 1;

          roundAdded = true;

        }

      }

    }

    if (!roundAdded) break;

  }

  return merged;

}



async function fetchCrossRoomsForSite(

  site: string,

  entry: CrossCategoryEntry,

  page: number,

  limit: number,

): Promise<{ list: RoomItem[]; hasMore: boolean }> {

  const mappedCid = crossGameCidForSite(entry, site);

  if (!mappedCid) return { list: [], hasMore: false };



  const pid = site === "douyin" || site === "bilibili" ? sitePidForEntry(entry, site) : undefined;

  const payload = await browseApi.fetchCategoryRooms(site, mappedCid, page, pid);

  const list = (payload.list || [])

    .filter((room) => {

      const roomCid = String(room.cid || "").trim();

      return !roomCid || roomCid === mappedCid;

    })

    .slice(0, limit)

    .map((room) => ({ ...room, siteId: site }));

  return { list, hasMore: Boolean(payload.hasMore) || list.length >= limit };

}



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

  const groupId = crossGroupCidForSite(entry, site);

  const fetchGroupRooms = getPlatform(site)?.browse?.fetchGroupRooms;

  if (fetchGroupRooms && groupId) {

    return (await fetchGroupRooms(groupId, page, limit)).list;

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

  fetchHotCrossCategoryRooms(

    crossKey: string,

    page?: number,

    limit?: number,

  ): Promise<{

    list: RoomItem[];

    categoryKey: string;

    categoryName: string;

    hasMore: boolean;

    page: number;

  }>;

}

export const browseApi: BrowseApi = {

  async fetchCategories(site: string): Promise<CategoryGroup[]> {

    const browse = getPlatform(site)?.browse;

    if (!browse) {

      throw new Error(`暂不支持平台: ${site}`);

    }

    return sanitizeUnicode(await browse.fetchCategories());

  },



  async fetchRecommendRooms(site: string, page: number): Promise<RoomsPayload> {

    const browse = getPlatform(site)?.browse;

    if (!browse) {

      throw new Error(`暂不支持平台: ${site}`);

    }

    return sanitizeUnicode(await browse.fetchRecommendRooms(page));

  },



  async fetchCategoryRooms(site: string, cid: string, page: number, pid?: string): Promise<RoomsPayload> {

    const browse = getPlatform(site)?.browse;

    if (!browse) {

      throw new Error(`暂不支持平台: ${site}`);

    }

    const result = await browse.fetchCategoryRooms(cid, page, pid);

    return sanitizeUnicode({ ...result, cid: String(cid) });

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

      perSite > 0 ? perSite : Math.max(1, Math.ceil(limit / BROWSE_SITE_IDS.length));



    for (const site of BROWSE_SITE_IDS) {

      try {

        let tagged: RoomItem[] = [];



        if (entry && isGroupCategoryEntry(entry)) {

          tagged = (await fetchGroupRoomsForSite(site, entry, page, perSiteCount)).map((room) => ({

            ...room,

            siteId: site,

          }));

        } else {

          let payload: RoomsPayload;

          const mappedCid = entry ? crossGameCidForSite(entry, site) : undefined;



          if (mappedCid) {

            const pid =
              entry && (site === "douyin" || site === "bilibili") ? sitePidForEntry(entry, site) : undefined;

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



  async fetchHotCrossCategoryRooms(crossKey: string, page = 1, limit = 21) {

    const entry = findCrossCategoryByKey(crossKey);

    if (!entry || isGroupCategoryEntry(entry)) {

      throw new Error("无效的热门分类");

    }



    const counts = siteCountsForLimit(Math.max(7, limit));

    const buckets: Record<string, RoomItem[]> = {};

    let hasMore = false;



    await Promise.all(

      BROWSE_SITE_IDS.map(async (site) => {

        const need = counts[site];

        if (!need) {

          buckets[site] = [];

          return;

        }

        try {

          const result = await fetchCrossRoomsForSite(site, entry, page, need);

          buckets[site] = result.list;

          if (result.hasMore) hasMore = true;

        } catch {

          buckets[site] = [];

        }

      }),

    );



    let list = interleaveWeightedRooms(buckets, CROSS_SITE_WEIGHTS);

    if (limit > 0) list = list.slice(0, limit);

    if (list.length >= limit) hasMore = true;



    return {

      list: sanitizeUnicode(list),

      categoryKey: entry.key,

      categoryName: entry.name,

      hasMore,

      page,

    };

  },

};


