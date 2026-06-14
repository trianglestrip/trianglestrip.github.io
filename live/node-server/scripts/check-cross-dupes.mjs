/**
 * 检查 cross-categories.data.ts 中的重复项（仅读本地数据）
 */
import { CROSS_CATEGORIES } from "../src/browse/cross-categories.data.ts";

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

const issues = [];

// 1. key 重复
const keyMap = new Map();
for (const e of CROSS_CATEGORIES) {
  if (keyMap.has(e.key)) {
    issues.push({ type: "dup_key", key: e.key, entries: [keyMap.get(e.key), e.name] });
  } else {
    keyMap.set(e.key, e.name);
  }
}

// 2. name 重复
const nameMap = new Map();
for (const e of CROSS_CATEGORIES) {
  const n = norm(e.name);
  if (nameMap.has(n)) {
    issues.push({ type: "dup_name", name: e.name, keys: [nameMap.get(n), e.key] });
  } else {
    nameMap.set(n, e.key);
  }
}

// 3. alias 跨条目重复
const aliasMap = new Map();
for (const e of CROSS_CATEGORIES) {
  for (const a of e.aliases || []) {
    const n = norm(a);
    if (!n) continue;
    if (aliasMap.has(n)) {
      const prev = aliasMap.get(n);
      if (prev.key !== e.key) {
        issues.push({
          type: "dup_alias",
          alias: a,
          keys: [prev.key, e.key],
          names: [prev.name, e.name],
        });
      }
    } else {
      aliasMap.set(n, { key: e.key, name: e.name });
    }
  }
}

// 4. 各平台游戏 cid 重复
const gameSites = ["douyu", "huya", "douyin", "bilibili"];
for (const site of gameSites) {
  const cidMap = new Map();
  for (const e of CROSS_CATEGORIES) {
    if (e.kind === "group") continue;
    let cid;
    let pid;
    if (site === "bilibili") {
      cid = e.sites?.bilibili?.cid;
      pid = e.sites?.bilibili?.pid;
    } else if (site === "douyu") {
      cid = e.sites?.douyu?.cid ?? e.douyu;
    } else if (site === "huya") {
      cid = e.sites?.huya?.cid ?? e.huya;
    } else if (site === "douyin") {
      cid = e.sites?.douyin?.cid ?? e.douyin;
      pid = e.sites?.douyin?.pid ?? e.douyinPid ?? "1";
    }
    if (!cid) continue;
    const k =
      site === "bilibili"
        ? pid + ":" + cid
        : site === "douyin"
          ? cid + ":" + pid
          : String(cid);
    if (cidMap.has(k)) {
      const prev = cidMap.get(k);
      issues.push({
        type: "dup_game_cid",
        site,
        cid: k,
        keys: [prev.key, e.key],
        names: [prev.name, e.name],
      });
    } else {
      cidMap.set(k, { key: e.key, name: e.name });
    }
  }
}

// 5. 大类 group 引用重复
const groupSites = ["douyu", "huya", "douyin", "bilibili"];
for (const site of groupSites) {
  const gMap = new Map();
  for (const e of CROSS_CATEGORIES) {
    if (e.kind !== "group") continue;
    const ids = [];
    if (site === "douyu" && e.douyuGroup) ids.push("group:" + e.douyuGroup);
    if (site === "huya") {
      if (e.huyaGroup) ids.push("group:" + e.huyaGroup);
      if (e.huyaTabId) ids.push("tab:" + e.huyaTabId);
    }
    if (site === "douyin" && e.douyinGroupIds) {
      for (const id of e.douyinGroupIds) ids.push("dgroup:" + id);
    }
    if (site === "bilibili" && e.sites?.bilibili?.groupId) {
      ids.push("group:" + e.sites.bilibili.groupId);
    }
    if (site === "douyin" && e.douyinPartitions) {
      for (const p of e.douyinPartitions) ids.push("part:" + p.cid + ":" + (p.pid || "1"));
    }
    for (const id of ids) {
      if (gMap.has(id)) {
        const prev = gMap.get(id);
        issues.push({
          type: "dup_group_ref",
          site,
          ref: id,
          keys: [prev.key, e.key],
          names: [prev.name, e.name],
        });
      } else {
        gMap.set(id, { key: e.key, name: e.name });
      }
    }
  }
}

// 6. sites 与 legacy 字段不一致
for (const e of CROSS_CATEGORIES) {
  for (const site of ["douyu", "huya", "douyin"]) {
    const ref = e.sites?.[site];
    if (ref?.cid && e[site] && e[site] !== ref.cid) {
      issues.push({
        type: "sites_legacy_mismatch",
        site,
        key: e.key,
        name: e.name,
        sites: ref.cid,
        legacy: e[site],
      });
    }
  }
}

// 7. 抖音 partition 与游戏 cid 重复
{
  const dyMap = new Map();
  for (const e of CROSS_CATEGORIES) {
    if (e.kind === "group") continue;
    const cid = e.sites?.douyin?.cid ?? e.douyin;
    const pid = e.sites?.douyin?.pid ?? e.douyinPid ?? "1";
    if (cid) dyMap.set(cid + ":" + pid, { key: e.key, name: e.name, kind: "game" });
  }
  for (const e of CROSS_CATEGORIES) {
    if (e.kind !== "group") continue;
    for (const p of e.douyinPartitions || []) {
      const k = p.cid + ":" + (p.pid || "1");
      if (dyMap.has(k)) {
        const prev = dyMap.get(k);
        issues.push({
          type: "douyin_part_vs_game",
          cid: k,
          game: prev,
          group: { key: e.key, name: e.name },
        });
      }
    }
  }
}

console.log(
  "Total:",
  CROSS_CATEGORIES.length,
  "| games:",
  CROSS_CATEGORIES.filter((e) => e.kind !== "group").length,
  "| groups:",
  CROSS_CATEGORIES.filter((e) => e.kind === "group").length,
);
console.log("Issues:", issues.length);
for (const i of issues) console.log(JSON.stringify(i, null, 0));
