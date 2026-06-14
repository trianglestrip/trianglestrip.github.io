import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appRoot } from "../config/load-config.js";
import { BROWSE_SITE_IDS } from "../platforms/registry.js";
import type { CategoryGroup } from "./douyu.js";

export const CATEGORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CATEGORY_CACHE_TTL_SEC = CATEGORY_CACHE_TTL_MS / 1000;

export const BROWSE_CATEGORY_SITES = BROWSE_SITE_IDS as readonly string[];
export type BrowseCategorySite = (typeof BROWSE_CATEGORY_SITES)[number];

export interface SiteCategoryCache {
  fetchedAt: number;
  categories: CategoryGroup[];
}

export interface CategoryCachePayload {
  updatedAt: number;
  sites: Partial<Record<BrowseCategorySite, SiteCategoryCache>>;
}

const STORE_DIR = path.join(appRoot(), "data");
const STORE_FILE = path.join(STORE_DIR, "categories-cache.json");

function emptyPayload(): CategoryCachePayload {
  return { updatedAt: 0, sites: {} };
}

function readStoreFile(): CategoryCachePayload {
  if (!existsSync(STORE_FILE)) {
    return emptyPayload();
  }
  try {
    const raw = JSON.parse(readFileSync(STORE_FILE, "utf8").replace(/^\uFEFF/, "")) as CategoryCachePayload;
    return {
      updatedAt: Number(raw.updatedAt) || 0,
      sites: raw.sites && typeof raw.sites === "object" ? raw.sites : {},
    };
  } catch {
    return emptyPayload();
  }
}

function writeStoreFile(payload: CategoryCachePayload): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tmp, STORE_FILE);
}

export function isBrowseCategorySite(site: string): site is BrowseCategorySite {
  return (BROWSE_CATEGORY_SITES as readonly string[]).includes(site);
}

export function getCachedCategories(
  site: BrowseCategorySite,
  opts?: { maxAgeMs?: number },
): SiteCategoryCache | null {
  const entry = readStoreFile().sites[site];
  if (!entry || !Array.isArray(entry.categories) || entry.categories.length === 0) {
    return null;
  }
  const maxAgeMs = opts?.maxAgeMs ?? CATEGORY_CACHE_TTL_MS;
  if (maxAgeMs >= 0 && Date.now() - Number(entry.fetchedAt) > maxAgeMs) {
    return null;
  }
  return entry;
}

export function saveCachedCategories(site: BrowseCategorySite, categories: CategoryGroup[]): SiteCategoryCache {
  const payload = readStoreFile();
  const entry: SiteCategoryCache = {
    fetchedAt: Date.now(),
    categories,
  };
  payload.sites[site] = entry;
  payload.updatedAt = Date.now();
  writeStoreFile(payload);
  return entry;
}

export function loadCategoryCachePayload(): CategoryCachePayload {
  return readStoreFile();
}
