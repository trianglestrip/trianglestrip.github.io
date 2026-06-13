import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appRoot } from "../config/load-config.js";

export interface StoredFollowItem {
  site: string;
  id: string;
  title: string;
  anchor: string;
  cover: string;
  avatar: string;
  addedAt: number;
  super: boolean;
  clientUpdatedAt: number;
}

export interface FollowStorePayload {
  updatedAt: number;
  follows: StoredFollowItem[];
}

const STORE_DIR = path.join(appRoot(), "data");
const STORE_FILE = path.join(STORE_DIR, "follows-store.json");

function followKey(site: string, id: string): string {
  return `${site}:${id}`;
}

export function normalizeStoredFollow(item: Record<string, unknown>): StoredFollowItem | null {
  const site = String(item.site || "").trim();
  const id = String(item.id || "").trim();
  if (!site || !id) return null;
  const clientUpdatedAt = Number(item.clientUpdatedAt) || Number(item.addedAt) || Date.now();
  return {
    site,
    id,
    title: item.title ? String(item.title) : "",
    anchor: item.anchor ? String(item.anchor) : "",
    cover: item.cover ? String(item.cover) : "",
    avatar: item.avatar ? String(item.avatar) : "",
    addedAt: Number(item.addedAt) || clientUpdatedAt,
    super: Boolean(item.super),
    clientUpdatedAt,
  };
}

export function mergeStoredFollows(
  a: StoredFollowItem[],
  b: StoredFollowItem[],
): StoredFollowItem[] {
  const map = new Map<string, StoredFollowItem>();
  for (const raw of [...a, ...b]) {
    const key = followKey(raw.site, raw.id);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, raw);
      continue;
    }
    const takeIncoming = raw.clientUpdatedAt >= prev.clientUpdatedAt;
    const base = takeIncoming ? raw : prev;
    const other = takeIncoming ? prev : raw;
    map.set(key, {
      ...base,
      super: Boolean(base.super || other.super),
      addedAt: Math.min(prev.addedAt || Date.now(), raw.addedAt || Date.now()),
    });
  }
  return [...map.values()].sort(
    (x, y) => (y.clientUpdatedAt || 0) - (x.clientUpdatedAt || 0),
  );
}

function readStoreFile(): FollowStorePayload {
  if (!existsSync(STORE_FILE)) {
    return { updatedAt: 0, follows: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(STORE_FILE, "utf8").replace(/^\uFEFF/, "")) as FollowStorePayload;
    const follows = Array.isArray(raw.follows)
      ? raw.follows
          .map((item) => normalizeStoredFollow(item as unknown as Record<string, unknown>))
          .filter((item): item is StoredFollowItem => Boolean(item))
      : [];
    return {
      updatedAt: Number(raw.updatedAt) || 0,
      follows,
    };
  } catch {
    return { updatedAt: 0, follows: [] };
  }
}

function writeStoreFile(payload: FollowStorePayload): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tmp, STORE_FILE);
}

export function loadFollowStore(): FollowStorePayload {
  return readStoreFile();
}

export function syncFollowStore(incoming: StoredFollowItem[]): FollowStorePayload {
  const current = readStoreFile();
  const merged = mergeStoredFollows(current.follows, incoming);
  const payload: FollowStorePayload = {
    updatedAt: Date.now(),
    follows: merged,
  };
  writeStoreFile(payload);
  return payload;
}
