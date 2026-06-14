/** 抽屉 / 分类页不展示的非游戏一级分区 */
export const DRAWER_EXCLUDED_GROUP = /颜值|正能量|语音|科技文化/;

/** 一级分区排序（其余非排除分区排在后面） */
export const DRAWER_GROUP_ORDER = {
  douyu: ["1", "15", "9", "22", "2"],
  huya: ["1", "3", "8", "2"],
};

/** 收起侧栏缩写（按平台原生一级 id） */
export const DRAWER_GROUP_SHORT = {
  douyu: {
    1: "网游",
    15: "单机",
    9: "手游",
    22: "赛车",
    2: "娱乐",
  },
  huya: {
    1: "网游",
    2: "单机",
    3: "手游",
    8: "娱乐",
  },
};

export function sectionShortName(name) {
  const text = String(name || "").trim();
  if (!text) return "—";
  const compact = text.replace(/游戏$/u, "").replace(/热游$/u, "");
  const source = compact.length >= 2 ? compact : text;
  return source.slice(0, 2);
}

export function drawerGroupShort(site, group) {
  const id = String(group.id);
  return DRAWER_GROUP_SHORT[site]?.[id] || sectionShortName(group.name);
}

export function filterDrawerCategoryGroups(groups, site) {
  return (groups || []).filter((group) => {
    const name = String(group.name || "");
    if (DRAWER_EXCLUDED_GROUP.test(name)) return false;
    return (group.list?.length || 0) > 0;
  });
}

export function sortDrawerCategoryGroups(groups, site) {
  const order = DRAWER_GROUP_ORDER[site];
  if (!order?.length) return groups;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...groups].sort((a, b) => {
    const left = rank.get(String(a.id)) ?? 999;
    const right = rank.get(String(b.id)) ?? 999;
    if (left !== right) return left - right;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh");
  });
}

/** 斗鱼 / 虎牙 / 抖音游戏分类：过滤并排序 */
export function normalizeBrowseCategoryGroups(groups, site) {
  if (site === "douyin") return groups || [];
  if (site !== "douyu" && site !== "huya") return groups || [];
  const filtered = filterDrawerCategoryGroups(groups, site);
  return sortDrawerCategoryGroups(filtered, site);
}
